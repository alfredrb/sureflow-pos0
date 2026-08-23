// Nightly auto clock-out sweep.
// Closes any TimeClockEntry still open from a previous work day:
//  - clock_out is set to the operator's scheduled Shift end_time on the work date
//    (falls back to midnight after the work date when no shift was scheduled).
//  - Operators whose scheduled shift runs past midnight (overnight/closing) are
//    exempt for yesterday's date so they can keep working and clock out normally.
// Every close is flagged auto_closing and recorded in AuditTrail + RegisterLog.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const TZ = 'America/New_York';

// Current calendar date (YYYY-MM-DD) in store local time.
function localToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// Convert a local store-time "YYYY-MM-DD" + "HH:MM" into a real UTC Date.
function localToUtc(dateStr, timeStr) {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  const asLocal = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  const offset = guess.getTime() - asLocal.getTime();
  return new Date(guess.getTime() + offset);
}

// Midnight at the END of the given local work date (start of the next day).
function midnightAfter(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const next = d.toISOString().slice(0, 10);
  return localToUtc(next, '00:00');
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    const today = localToday();
    // Yesterday in local time
    const yd = new Date(`${today}T00:00:00Z`);
    yd.setUTCDate(yd.getUTCDate() - 1);
    const yesterday = yd.toISOString().slice(0, 10);

    // Every entry still on the clock
    const openEntries = await svc.entities.TimeClockEntry.filter({
      status: { $in: ['open', 'on_break', 'on_meal'] }
    }, '-clock_in', 500);

    const results = [];
    for (const entry of openEntries) {
      const workDate = entry.date || (entry.clock_in || '').slice(0, 10);
      // Only sweep entries whose work day has already ended
      if (!workDate || workDate >= today) continue;

      // Resolve the operator's scheduled shift for that work date
      const shifts = await svc.entities.Shift.filter({
        operator_id: entry.operator_id,
        date: workDate
      });
      const shift = shifts[0] || null;

      // Overnight exemption: shift scheduled to end after midnight — leave the
      // entry open so the operator can clock out normally. Only applies while
      // the shift could still plausibly be running (work date was yesterday).
      const overnight = shift && shift.start_time && shift.end_time && shift.end_time < shift.start_time;
      if (overnight && workDate === yesterday) {
        results.push({ id: entry.id, operator: entry.operator_name, skipped: 'overnight_shift' });
        continue;
      }

      // Clock-out time: scheduled shift end on the work date, else midnight
      let clockOut = shift && shift.end_time
        ? localToUtc(workDate, shift.end_time)
        : midnightAfter(workDate);
      if (overnight) clockOut = midnightAfter(workDate); // stale overnight entry from earlier days
      // Never close before the clock-in itself
      const clockIn = new Date(entry.clock_in);
      if (clockOut.getTime() <= clockIn.getTime()) clockOut = midnightAfter(workDate);
      const clockOutIso = clockOut.toISOString();

      const update = {
        clock_out: clockOutIso,
        status: 'closed',
        adjusted: true,
        auto_closing: true,
        closing_reason: 'auto_clock_out_midnight',
        adjustment_note: 'Auto clock-out at scheduled end — forgot to clock out'
      };
      // End any meal/break still open at the same time
      if (entry.meal_start && !entry.meal_end) update.meal_end = clockOutIso;
      if (entry.break_start && !entry.break_end) update.break_end = clockOutIso;

      await svc.entities.TimeClockEntry.update(entry.id, update);

      const outLabel = clockOut.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      await svc.entities.AuditTrail.create({
        action: 'Auto Clock-Out',
        category: 'operator',
        description: `${entry.operator_name || entry.operator_id} was auto clocked-out for ${workDate} — clock_out set to ${outLabel} (${shift ? 'scheduled shift end' : 'midnight, no scheduled shift'}). Operator forgot to clock out.`,
        actor_id: 'system',
        actor_name: 'Auto Clock-Out Sweep',
        actor_role: 'system',
        page: '/admin/payroll'
      });
      await svc.entities.RegisterLog.create({
        event_type: 'logout',
        operator_id: entry.operator_id,
        operator_name: entry.operator_name,
        operator_role: entry.role,
        register_id: entry.register_id || 'TIMECLOCK',
        detail: `Auto clock-out (forgot to clock out) — clock_out adjusted to ${outLabel} for ${workDate}${shift ? ' per scheduled shift end' : ''}`
      });

      results.push({ id: entry.id, operator: entry.operator_name, closed_at: clockOutIso, basis: shift ? 'scheduled_end' : 'midnight' });
    }

    return Response.json({ success: true, swept: results.length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}