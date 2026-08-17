import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Automated time-theft check: scans TimeClockEntry records for missing clock-outs
// and inconsistent shifts (overlong, overlapping, short, future clock-in), then logs
// any new findings as open TimeClockDiscrepancy records ("Action Required") so they
// surface in the Loss Prevention workbench (Time Theft tab + Overview report).
// Runs on a schedule via a scheduled automation. Admin-only when invoked directly.

const hoursBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
const dayOf = (e) => e.date || (e.clock_in ? e.clock_in.slice(0, 10) : "");
const round2 = (n) => Math.round(n * 100) / 100;

const entryNetHours = (entry) => {
  if (!entry || !entry.clock_in || !entry.clock_out) return 0;
  const toMs = (s) => new Date(s).getTime();
  let ms = toMs(entry.clock_out) - toMs(entry.clock_in);
  if (ms < 0) return 0;
  const meal = (entry.meal_start && entry.meal_end) ? Math.max(0, toMs(entry.meal_end) - toMs(entry.meal_start)) : 0;
  const brk = (entry.break_start && entry.break_end) ? Math.max(0, toMs(entry.break_end) - toMs(entry.break_start)) : 0;
  return Math.max(0, (ms - meal - brk) / 3600000);
};

const SEVERITY = {
  manual_adjustment: "medium",
  missing_clockout: "high",
  overlong_shift: "medium",
  overlapping_entries: "high",
  short_shift: "low",
  future_clockin: "medium",
};

const discrepancyKey = (d) =>
  `${d.operator_id}|${d.discrepancy_type}|${(d.entry_ids || [])[0] || ""}`;

// Replicates src/lib/timeTheftUtils.js detectTimeDiscrepancies (backend can't import src/).
function detectTimeDiscrepancies(entries, now = new Date()) {
  const missingCutoffHours = 16;
  const overlongHours = 16;
  const shortShiftMinutes = 5;
  const found = [];
  const byOp = {};

  (entries || []).forEach((e) => {
    if (!e.clock_in) return;
    (byOp[e.operator_id] = byOp[e.operator_id] || []).push(e);

    if (new Date(e.clock_in).getTime() > now.getTime() + 60000) {
      found.push({
        operator_id: e.operator_id,
        operator_name: e.operator_name,
        date: dayOf(e),
        discrepancy_type: "future_clockin",
        severity: SEVERITY.future_clockin,
        description: `Clock-in timestamp is in the future (${new Date(e.clock_in).toLocaleString()}).`,
        hours_impact: 0,
        entry_ids: [e.id],
      });
    }

    if (e.status !== "closed" && !e.clock_out) {
      const elapsed = hoursBetween(e.clock_in, now);
      if (elapsed >= missingCutoffHours) {
        found.push({
          operator_id: e.operator_id,
          operator_name: e.operator_name,
          date: dayOf(e),
          discrepancy_type: "missing_clockout",
          severity: SEVERITY.missing_clockout,
          description: `Clocked in ${elapsed.toFixed(1)}h ago with no clock-out (open shift).`,
          hours_impact: round2(elapsed),
          entry_ids: [e.id],
        });
      }
    }

    if (e.clock_out) {
      const hrs = entryNetHours(e);
      if (hrs >= overlongHours) {
        found.push({
          operator_id: e.operator_id,
          operator_name: e.operator_name,
          date: dayOf(e),
          discrepancy_type: "overlong_shift",
          severity: SEVERITY.overlong_shift,
          description: `Shift ran ${hrs.toFixed(2)}h (exceeds ${overlongHours}h threshold).`,
          hours_impact: round2(hrs),
          entry_ids: [e.id],
        });
      }
      const spanHours = hoursBetween(e.clock_in, e.clock_out);
      if (spanHours > 0 && spanHours * 60 < shortShiftMinutes) {
        found.push({
          operator_id: e.operator_id,
          operator_name: e.operator_name,
          date: dayOf(e),
          discrepancy_type: "short_shift",
          severity: SEVERITY.short_shift,
          description: `Shift lasted only ${(spanHours * 60).toFixed(0)} min.`,
          hours_impact: round2(spanHours),
          entry_ids: [e.id],
        });
      }
    }
  });

  Object.entries(byOp).forEach(([opId, list]) => {
    const closed = list
      .filter((e) => e.clock_in && e.clock_out)
      .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
    for (let i = 0; i < closed.length - 1; i++) {
      const a = closed[i];
      const b = closed[i + 1];
      if (new Date(b.clock_in) < new Date(a.clock_out)) {
        const overlapHrs = (new Date(a.clock_out) - new Date(b.clock_in)) / 3600000;
        found.push({
          operator_id: opId,
          operator_name: a.operator_name,
          date: dayOf(b),
          discrepancy_type: "overlapping_entries",
          severity: SEVERITY.overlapping_entries,
          description: `Two entries overlap by ${overlapHrs.toFixed(2)}h (${new Date(b.clock_in).toLocaleString()} → ${new Date(a.clock_out).toLocaleString()}).`,
          hours_impact: round2(overlapHrs),
          entry_ids: [a.id, b.id],
        });
      }
    }
  });

  return found;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const [entries, existing, operators, payRates] = await Promise.all([
      base44.asServiceRole.entities.TimeClockEntry.list("-clock_in", 1000),
      base44.asServiceRole.entities.TimeClockDiscrepancy.list("-detected_at", 500),
      base44.asServiceRole.entities.Operator.list(),
      base44.asServiceRole.entities.PositionPayRate.list(),
    ]);

    const found = detectTimeDiscrepancies(entries);
    const existingKeys = new Set(existing.map(discrepancyKey));
    const toCreate = found.filter((f) => !existingKeys.has(discrepancyKey(f)));

    if (toCreate.length > 0) {
      const rateFor = (opId) => {
        const op = (operators || []).find((o) => o.operator_id === opId);
        const rate = (payRates || []).find((p) => p.role === (op?.role) && p.active !== false);
        return rate?.base_rate ?? 15;
      };
      const ts = new Date().toISOString();
      const records = toCreate.map((f) => ({
        operator_id: f.operator_id,
        operator_name: f.operator_name,
        date: f.date,
        discrepancy_type: f.discrepancy_type,
        severity: f.severity,
        description: f.description,
        hours_impact: f.hours_impact,
        amount_impact: round2((f.hours_impact || 0) * rateFor(f.operator_id)),
        entry_ids: f.entry_ids,
        detected_at: ts,
        detected_by: "System Scan",
        status: "open",
      }));
      await base44.asServiceRole.entities.TimeClockDiscrepancy.bulkCreate(records);
    }

    return Response.json({
      success: true,
      scanned: entries.length,
      found: found.length,
      created: toCreate.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});