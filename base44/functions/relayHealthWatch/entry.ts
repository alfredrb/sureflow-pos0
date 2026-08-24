import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Phase 3 — cloud alerting when a store's relay stops syncing.
// Runs on a schedule: for every active store with a relay URL, checks the newest
// RelaySyncLog. No successful sync inside the threshold raises a SystemAlert; a
// recovered store resolves its own alert automatically.
const STALE_MINUTES = 20;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const stores = await svc.entities.Store.filter({ status: 'active' });
    const openAlerts = await svc.entities.SystemAlert.filter({ alert_type: 'sync', status: 'active' });
    const now = Date.now();
    const results = [];

    for (const store of stores) {
      const sid = store.store_number;
      if (!store.relay_url) continue;

      const logs = await svc.entities.RelaySyncLog.filter({ store_id: sid }, '-synced_at', 5);
      const lastOk = logs.find((l) => l.status === 'success');
      const lastAt = lastOk?.synced_at || lastOk?.created_date || null;
      const minutesAgo = lastAt ? Math.round((now - new Date(lastAt).getTime()) / 60000) : null;
      const stale = minutesAgo === null || minutesAgo > STALE_MINUTES;
      const existing = openAlerts.find((a) => a.source === `Store ${sid}`);

      if (stale && !existing) {
        const detail = minutesAgo === null
          ? 'This store has never reported a successful sync.'
          : `Last successful sync was ${minutesAgo} minutes ago.`;
        const err = logs[0]?.error ? ` Latest relay error: ${logs[0].error}` : '';
        await svc.entities.SystemAlert.create({
          alert_type: 'sync',
          severity: 'critical',
          title: `Store ${sid} has stopped syncing`,
          description: `${detail}${err} Offline sales may be queued on the store's Local Relay VM and not yet in the cloud.`,
          source: `Store ${sid}`,
          status: 'active',
        });
        results.push({ store_id: sid, action: 'alert_raised', minutes_ago: minutesAgo });
      }

      // Redundant stores: a stale relay behind the VIP means the acting primary is
      // gone, so record the promotion to the secondary. keepalived has already moved
      // the VIP on the store LAN — this mirrors that into the cloud so the command
      // center shows reality and an admin knows a failback is owed. Failback is
      // deliberately manual: auto-returning mid-DRBD-resync serves a half-copied root.
      if (stale && store.ha_enabled && store.acting_primary !== 'secondary') {
        const reason = minutesAgo === null
          ? 'Relay behind the floating VIP has never reported a successful sync.'
          : `Relay behind the floating VIP went stale (last successful sync ${minutesAgo} minutes ago, threshold ${STALE_MINUTES}).`;
        const at = new Date().toISOString();
        await svc.entities.Store.update(store.id, {
          acting_primary: 'secondary',
          last_failover_at: at,
          last_failover_reason: reason,
          failback_pending: true,
        });
        await svc.entities.AuditTrail.create({
          action: 'Controller Failover to Secondary',
          category: 'system',
          description: `${store.name} (#${sid}) was automatically promoted onto its secondary controller (${store.secondary_controller_host || 'unknown host'}). ${reason} Lanes that reboot come up on the secondary; lanes mid-transaction when the primary died must be rebooted. A controlled failback is owed once the primary is up and DRBD reads UpToDate on both boxes.`,
          actor_name: 'System',
          actor_role: 'system',
          page: '/admin/hardware',
          changes: [{ field: 'acting_primary', from: 'primary', to: 'secondary' }],
        });
        results.push({ store_id: sid, action: 'failed_over_to_secondary', minutes_ago: minutesAgo });
      }

      if (!stale && existing) {
        await svc.entities.SystemAlert.update(existing.id, {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'System',
          resolution_notes: `Sync recovered — last successful sync ${minutesAgo} minutes ago.`,
        });
        results.push({ store_id: sid, action: 'alert_resolved', minutes_ago: minutesAgo });
      } else if (existing || !stale) {
        // (a freshly raised alert already pushed its own result above)
        results.push({ store_id: sid, action: stale ? 'already_alerted' : 'healthy', minutes_ago: minutesAgo });
      }
    }

    return Response.json({ ok: true, checked: results.length, threshold_minutes: STALE_MINUTES, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}