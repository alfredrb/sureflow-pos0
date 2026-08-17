import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Archive lifecycle for closed Loss Prevention investigations:
//   - Archive (compress / hide) closed cases 30 days after they were closed.
//   - Permanently delete archived cases 90 days after they were closed.
// Runs nightly via a scheduled automation. Admin-only when invoked directly.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const now = new Date();
    const DAY = 24 * 60 * 60 * 1000;
    const ARCHIVE_AFTER = 30 * DAY;
    const DELETE_AFTER = 90 * DAY;

    const all = await base44.asServiceRole.entities.Investigation.list("-created_date", 1000);
    const refDate = (inv) => inv.closed_date || inv.updated_date || inv.created_date;

    // 1. Delete archived cases that have been closed 90+ days.
    const toDelete = all.filter((inv) =>
      inv.archived && refDate(inv) && (now - new Date(refDate(inv))) >= DELETE_AFTER
    );
    for (const inv of toDelete) {
      await base44.asServiceRole.entities.Investigation.delete(inv.id);
    }

    // 2. Archive closed cases that have been closed 30+ days and aren't archived yet.
    const toArchive = all.filter((inv) =>
      inv.status === 'closed' && !inv.archived && refDate(inv) && (now - new Date(refDate(inv))) >= ARCHIVE_AFTER
    );
    await Promise.all(toArchive.map((inv) => {
      const log = Array.isArray(inv.activity_log) ? inv.activity_log : [];
      const ts = now.toISOString();
      return base44.asServiceRole.entities.Investigation.update(inv.id, {
        archived: true,
        archived_date: ts,
        activity_log: [...log, { date: ts, by: 'System', action: 'Archived (auto, 30 days closed)', note: '' }]
      });
    }));

    return Response.json({
      success: true,
      archived: toArchive.length,
      deleted: toDelete.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});