import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authenticateRelay } from '../../shared/relayAuth.ts';

// The store side of nightly maintenance. Called BY the Local Relay VM with its
// per-store API key, because the cloud can never reach into the store LAN.
//
//   { store_id, api_key, action: "claim" }
//     -> tasks whose release time has passed; each is marked claimed so it fires once
//   { store_id, api_key, action: "report", results: [ { id, status, detail } ] }
//     -> the relay reports what actually happened; logged per lane for the audit
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    const storeId = String(body.store_id || '').trim();
    const action = String(body.action || '').trim();
    if (action !== 'claim' && action !== 'report') {
      return Response.json({ error: "action must be 'claim' or 'report'" }, { status: 400 });
    }

    const cred = await authenticateRelay(db, storeId, String(body.api_key || '').trim());
    if (!cred) return Response.json({ error: 'Invalid relay credentials for this store' }, { status: 401 });

    const now = new Date();

    // ---------------- CLAIM ----------------
    if (action === 'claim') {
      const pending = await db.LaneMaintenanceTask.filter({ store_id: storeId, status: 'pending' });
      const due = pending.filter((t: any) => !t.release_at || new Date(t.release_at) <= now);
      const claimed = [];
      for (const t of due) {
        await db.LaneMaintenanceTask.update(t.id, { status: 'claimed', claimed_at: now.toISOString() });
        claimed.push({
          id: t.id,
          task_type: t.task_type,
          register_id: t.register_id || '',
          register_name: t.register_name || '',
          detail: t.detail || '',
        });
      }
      return Response.json({ ok: true, tasks: claimed });
    }

    // ---------------- REPORT ----------------
    const reported = Array.isArray(body.results) ? body.results : [];
    const applied = [];
    for (const r of reported) {
      const id = String(r?.id || '');
      if (!id) continue;
      const status = ['completed', 'failed', 'skipped'].includes(r.status) ? r.status : 'completed';
      const task = await db.LaneMaintenanceTask.get(id);
      if (!task || task.store_id !== storeId) continue;

      await db.LaneMaintenanceTask.update(id, {
        status,
        completed_at: now.toISOString(),
        detail: String(r.detail || '').slice(0, 500),
      });

      if (task.task_type === 'lane_reboot' && task.register_id) {
        await db.RegisterLog.create({
          event_type: 'register_change',
          operator_id: 'SYSTEM',
          operator_name: 'Nightly Maintenance',
          operator_role: 'system',
          register_id: task.register_id,
          register_name: task.register_name || '',
          detail: `Scheduled nightly reboot ${status}${r.detail ? ` — ${r.detail}` : ''}. The lane reloads the shared NFS root on boot, so this is also how it picks up a new image.`,
        });
      }
      applied.push({ id, status });
    }

    if (applied.length > 0) {
      const failed = applied.filter((a) => a.status === 'failed').length;
      await db.AuditTrail.create({
        action: 'Nightly Lane Maintenance Results',
        category: 'system',
        description: `Store ${storeId} relay reported ${applied.length} maintenance task result(s) — ${applied.length - failed} carried out, ${failed} failed.`,
        actor_name: 'System',
        actor_role: 'system',
        page: '/admin/hardware',
      });
    }

    return Response.json({ ok: true, applied });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}