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
      } else if (!stale && existing) {
        await svc.entities.SystemAlert.update(existing.id, {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: 'System',
          resolution_notes: `Sync recovered — last successful sync ${minutesAgo} minutes ago.`,
        });
        results.push({ store_id: sid, action: 'alert_resolved', minutes_ago: minutesAgo });
      } else {
        results.push({ store_id: sid, action: stale ? 'already_alerted' : 'healthy', minutes_ago: minutesAgo });
      }
    }

    return Response.json({ ok: true, checked: results.length, threshold_minutes: STALE_MINUTES, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}