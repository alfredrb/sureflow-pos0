import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Pushes SystemAlert records to a human by email.
// relayHealthWatch already raises and resolves alerts correctly; this is the part
// that makes someone actually notice one at 9am instead of at the first angry
// customer. Runs on a schedule, and can be invoked with { test: true } from the
// Infrastructure Command Center to prove the recipient list works.
const SEVERITY_RANK = { info: 0, warning: 1, critical: 2 };

function pickSettings(list) {
  return list.find((s) => !s.store_id) || list[0] || {};
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;

    // A test send is a human action, so it is admin-gated. The scheduled pass runs
    // with no user token and goes straight through on the service role.
    let actorName = 'System';
    if (isTest) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      actorName = user.full_name || 'Admin';
    }

    const settings = pickSettings(await svc.entities.StoreSettings.list());
    const recipients = (settings.ops_notification_emails || []).filter((e) => !!e);
    const minRank = SEVERITY_RANK[settings.ops_notify_min_severity || 'critical'] ?? 2;
    const renotifyHours = Number(settings.ops_renotify_hours ?? 12);
    const storeName = settings.store_name || 'SureFlow';

    if (recipients.length === 0) {
      return Response.json({ ok: false, error: 'No ops notification recipients are configured.' }, { status: 400 });
    }

    if (isTest) {
      for (const to of recipients) {
        await svc.integrations.Core.SendEmail({
          from_name: `${storeName} Operations`,
          to,
          subject: 'SureFlow ops notification test',
          body: `This is a test from the Infrastructure Command Center, sent by ${actorName}.\n\nIf you received this, critical system alerts (a store's relay stopping sync, a controller failover) will reach this address.\n\nMinimum severity: ${settings.ops_notify_min_severity || 'critical'}\nReminder interval while an alert stays open: every ${renotifyHours} hours`,
        });
      }
      return Response.json({ ok: true, test: true, sent_to: recipients.length });
    }

    const now = Date.now();
    const alerts = await svc.entities.SystemAlert.list('-created_date', 200);
    const dispatched = [];

    for (const a of alerts) {
      const rank = SEVERITY_RANK[a.severity] ?? 0;

      // --- Recovery notice: only for alerts a human was actually told about ---
      if (a.status === 'resolved') {
        if (!a.notified_at || a.recovery_notified_at) continue;
        for (const to of recipients) {
          await svc.integrations.Core.SendEmail({
            from_name: `${storeName} Operations`,
            to,
            subject: `RESOLVED: ${a.title}`,
            body: `The following system alert has cleared.\n\n${a.title}\nSource: ${a.source || 'System'}\nResolved: ${a.resolved_at || 'just now'}\n${a.resolution_notes ? `\n${a.resolution_notes}\n` : ''}\nNo further action is needed.`,
          });
        }
        await svc.entities.SystemAlert.update(a.id, { recovery_notified_at: new Date().toISOString() });
        dispatched.push({ id: a.id, title: a.title, kind: 'recovery' });
        continue;
      }

      // --- Active alerts at or above the configured severity ---
      if (a.status !== 'active' || rank < minRank) continue;
      const lastAt = a.notified_at ? new Date(a.notified_at).getTime() : 0;
      const due = !a.notified_at || now - lastAt >= renotifyHours * 3600000;
      if (!due) continue;

      const isReminder = !!a.notified_at;
      for (const to of recipients) {
        await svc.integrations.Core.SendEmail({
          from_name: `${storeName} Operations`,
          to,
          subject: `${isReminder ? 'STILL OPEN' : String(a.severity).toUpperCase()}: ${a.title}`,
          body: `${isReminder ? 'This alert is still open and has not been resolved.\n\n' : ''}${a.title}\n\nSeverity: ${a.severity}\nType: ${a.alert_type}\nSource: ${a.source || 'System'}\nRaised: ${a.created_date || 'unknown'}\n\n${a.description || ''}\n\nOpen the Infrastructure Command Center to investigate.`,
        });
      }
      await svc.entities.SystemAlert.update(a.id, {
        notified_at: new Date().toISOString(),
        notify_count: (a.notify_count || 0) + 1,
      });
      dispatched.push({ id: a.id, title: a.title, kind: isReminder ? 'reminder' : 'new' });
    }

    if (dispatched.length > 0) {
      const newCount = dispatched.filter((d) => d.kind === 'new').length;
      const reminders = dispatched.filter((d) => d.kind === 'reminder').length;
      const recoveries = dispatched.filter((d) => d.kind === 'recovery').length;
      await svc.entities.AuditTrail.create({
        action: 'Dispatched System Alert Notifications',
        category: 'system',
        description: `Emailed ${dispatched.length} system alert notification(s) to ${recipients.length} ops recipient(s) — ${newCount} new, ${reminders} reminder(s), ${recoveries} recovery notice(s). Alerts: ${dispatched.map((d) => d.title).join('; ')}.`,
        actor_name: 'System',
        actor_role: 'system',
        page: '/admin/hardware',
      });
    }

    return Response.json({
      ok: true,
      recipients: recipients.length,
      min_severity: settings.ops_notify_min_severity || 'critical',
      renotify_hours: renotifyHours,
      dispatched,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}