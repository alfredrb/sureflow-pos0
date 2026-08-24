import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Nightly lane reboot + controller update planner.
//
// WHY THIS ONLY PLANS AND NEVER PUSHES
// The lanes sit on the isolated PXE VLAN and the relay itself is a private LAN
// address — the cloud cannot open a connection to either. So this function decides
// WHAT should happen and writes LaneMaintenanceTask rows; the store's relay polls
// laneMaintenanceQueue, queues the reboots locally, and reports back.
//
// A diskless lane's reboot IS its update: replace the one shared NFS root on the
// controller and every lane picks it up on next boot, so there is no per-lane push.
//
// Two passes per night, both through this function:
//   pass=initial (00:20 local) — plan the store, defer busy lanes
//   pass=retry   (00:50 local) — re-check deferred lanes, then stop deferring:
//                                anything still busy is left alone, not forced.

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const pass = body?.pass === 'retry' ? 'retry' : 'initial';
    const runDate = today();

    const [stores, windows] = await Promise.all([
      db.Store.filter({ status: 'active' }),
      db.LaneMaintenanceWindow.list(),
    ]);

    const results = [];

    for (const store of stores) {
      const sid = store.store_number;
      const win = windows.find((w: any) => w.store_id === sid);
      if (!win || !win.enabled) continue;

      const batchSize = Math.max(1, Number(win.batch_size || 2));
      const interval = Math.max(1, Number(win.batch_interval_minutes || 5));

      const [registers, tasks, openShifts, suspends] = await Promise.all([
        db.Register.filter({ store_id: sid }),
        db.LaneMaintenanceTask.filter({ store_id: sid, run_date: runDate }),
        db.TimeClockEntry.filter({ status: 'open' }),
        db.SuspendedTransaction.filter({ store_id: sid, status: 'suspended' }),
      ]);

      // A lane is busy if a sale is parked on it or somebody is still clocked in on it.
      // Never reboot a lane mid-transaction — this is the whole safety rule.
      const busyReason = (reg: any) => {
        if (reg.paused) return 'Register is paused / locked from use';
        if (reg.status === 'maintenance') return 'Register is flagged for maintenance';
        if (suspends.some((s: any) => s.register_id === reg.register_id)) return 'A suspended sale is parked on this lane';
        if (openShifts.some((t: any) => t.register_id === reg.register_id)) return 'An operator is still clocked in on this lane';
        return '';
      };

      const created = [];
      const requeued = [];
      const stillBusy = [];

      if (pass === 'initial' && tasks.length === 0) {
        // ---- First pass: plan the whole store ----
        const plan = registers.map((r: any) => ({ reg: r, reason: busyReason(r) }));
        const due = plan.filter((p) => !p.reason);
        const start = Date.now();

        for (let i = 0; i < due.length; i++) {
          const batch = Math.floor(i / batchSize);
          const task = await db.LaneMaintenanceTask.create({
            store_id: sid,
            run_date: runDate,
            task_type: 'lane_reboot',
            register_id: due[i].reg.register_id,
            register_name: due[i].reg.name || '',
            status: 'pending',
            batch_index: batch,
            release_at: new Date(start + batch * interval * 60000).toISOString(),
          });
          created.push(task.register_id);
        }

        for (const p of plan.filter((x) => !!x.reason)) {
          await db.LaneMaintenanceTask.create({
            store_id: sid,
            run_date: runDate,
            task_type: 'lane_reboot',
            register_id: p.reg.register_id,
            register_name: p.reg.name || '',
            status: 'deferred',
            defer_reason: p.reason,
          });
          stillBusy.push(p.reg.register_id);
        }

        if (win.include_controller_update) {
          await db.LaneMaintenanceTask.create({
            store_id: sid,
            run_date: runDate,
            task_type: 'controller_update',
            status: 'pending',
            // Held back until after the last lane batch so a controller restart never
            // lands on a lane that is still coming up.
            release_at: new Date(start + (Math.ceil(due.length / batchSize) + 1) * interval * 60000).toISOString(),
            detail: store.ha_enabled
              ? 'HA store — rolling update: update secondary, fail over, update primary, fail back.'
              : 'Standalone controller — update in place while the lanes are already cycling.',
          });
        }
      } else {
        // ---- Retry pass: give the deferred lanes another chance ----
        for (const t of tasks.filter((x: any) => x.status === 'deferred' && x.task_type === 'lane_reboot')) {
          const reg = registers.find((r: any) => r.register_id === t.register_id);
          const reason = reg ? busyReason(reg) : 'Register no longer assigned to this store';
          if (!reason) {
            await db.LaneMaintenanceTask.update(t.id, {
              status: 'pending',
              defer_reason: '',
              release_at: new Date().toISOString(),
            });
            requeued.push(t.register_id);
          } else if (pass === 'retry') {
            // Cutoff: still busy, so leave it alone rather than force it down.
            await db.LaneMaintenanceTask.update(t.id, { status: 'skipped', defer_reason: reason });
            stillBusy.push(t.register_id);
          }
        }
      }

      const summary =
        pass === 'initial'
          ? `${created.length} lane(s) planned, ${stillBusy.length} deferred (busy)${win.include_controller_update ? ', controller update queued' : ''}.`
          : `Retry pass: ${requeued.length} lane(s) requeued, ${stillBusy.length} left alone at cutoff.`;

      if (created.length || requeued.length || stillBusy.length) {
        await db.LaneMaintenanceWindow.update(win.id, { last_run_date: runDate, last_run_summary: summary });
        await db.AuditTrail.create({
          action: pass === 'initial' ? 'Planned Nightly Lane Maintenance' : 'Retried Deferred Lane Maintenance',
          category: 'system',
          description: `${store.name} (#${sid}): ${summary} Lanes reboot in batches of ${batchSize} every ${interval} minute(s); a lane with a parked sale or an operator still clocked in is never rebooted.`,
          actor_name: 'System',
          actor_role: 'system',
          page: '/admin/hardware',
        });
      }

      results.push({ store_id: sid, pass, planned: created, requeued, deferred_or_skipped: stillBusy, summary });
    }

    return Response.json({ ok: true, run_date: runDate, pass, stores: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}