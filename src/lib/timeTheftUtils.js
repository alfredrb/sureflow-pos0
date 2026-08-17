import { entryNetHours } from "./payrollUtils";

// Discrepancy types logged to the TimeClockDiscrepancy entity and surfaced in
// the Loss Prevention "Time Theft" tab. Each maps to a default severity and an
// investigation type (always time_theft).
export const DISCREPANCY_TYPES = {
  manual_adjustment: { label: "Manual Adjustment", severity: "medium" },
  missing_clockout: { label: "Missing Clock-Out", severity: "high" },
  overlong_shift: { label: "Overlong Shift", severity: "medium" },
  overlapping_entries: { label: "Overlapping Entries", severity: "high" },
  short_shift: { label: "Short Shift", severity: "low" },
  future_clockin: { label: "Future Clock-In", severity: "medium" },
};

const hoursBetween = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
const dayOf = (e) => e.date || (e.clock_in ? e.clock_in.slice(0, 10) : "");
const round2 = (n) => Math.round(n * 100) / 100;

// Detect time-clock discrepancies from a set of TimeClockEntry records.
// Returns an array of discrepancy descriptor objects (not yet persisted).
export function detectTimeDiscrepancies(entries, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const missingCutoffHours = opts.missingCutoffHours ?? 16;
  const overlongHours = opts.overlongHours ?? 16;
  const shortShiftMinutes = opts.shortShiftMinutes ?? 5;
  const found = [];

  const byOp = {};
  (entries || []).forEach((e) => {
    if (!e.clock_in) return;
    (byOp[e.operator_id] = byOp[e.operator_id] || []).push(e);

    // future clock-in
    if (new Date(e.clock_in).getTime() > now.getTime() + 60000) {
      found.push({
        operator_id: e.operator_id,
        operator_name: e.operator_name,
        date: dayOf(e),
        discrepancy_type: "future_clockin",
        severity: DISCREPANCY_TYPES.future_clockin.severity,
        description: `Clock-in timestamp is in the future (${new Date(e.clock_in).toLocaleString()}).`,
        hours_impact: 0,
        entry_ids: [e.id],
      });
    }

    // missing clock-out (still open after cutoff)
    if (e.status !== "closed" && !e.clock_out) {
      const elapsed = hoursBetween(e.clock_in, now);
      if (elapsed >= missingCutoffHours) {
        found.push({
          operator_id: e.operator_id,
          operator_name: e.operator_name,
          date: dayOf(e),
          discrepancy_type: "missing_clockout",
          severity: DISCREPANCY_TYPES.missing_clockout.severity,
          description: `Clocked in ${elapsed.toFixed(1)}h ago with no clock-out (open shift).`,
          hours_impact: round2(elapsed),
          entry_ids: [e.id],
        });
      }
    }

    // overlong / short shift (closed entries)
    if (e.clock_out) {
      const hrs = entryNetHours(e);
      if (hrs >= overlongHours) {
        found.push({
          operator_id: e.operator_id,
          operator_name: e.operator_name,
          date: dayOf(e),
          discrepancy_type: "overlong_shift",
          severity: DISCREPANCY_TYPES.overlong_shift.severity,
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
          severity: DISCREPANCY_TYPES.short_shift.severity,
          description: `Shift lasted only ${(spanHours * 60).toFixed(0)} min.`,
          hours_impact: round2(spanHours),
          entry_ids: [e.id],
        });
      }
    }
  });

  // overlapping entries per operator (closed entries sorted by clock_in)
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
          severity: DISCREPANCY_TYPES.overlapping_entries.severity,
          description: `Two entries overlap by ${overlapHrs.toFixed(2)}h (${new Date(b.clock_in).toLocaleString()} → ${new Date(a.clock_out).toLocaleString()}).`,
          hours_impact: round2(overlapHrs),
          entry_ids: [a.id, b.id],
        });
      }
    }
  });

  return found;
}

// Estimate dollar exposure for a discrepancy given pay rates + operators.
export const discrepancyAmount = (d, payRates, operators) => {
  const op = (operators || []).find((o) => o.operator_id === d.operator_id);
  const rate = (payRates || []).find((p) => p.role === (op?.role || d.role) && p.active !== false);
  const base = rate?.base_rate ?? 15;
  return round2((d.hours_impact || 0) * base);
};

// Build a dedupe key for a discrepancy (operator + type + first entry id).
export const discrepancyKey = (d) =>
  `${d.operator_id}|${d.discrepancy_type}|${(d.entry_ids || [])[0] || ""}`;