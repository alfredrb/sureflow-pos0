// Shared availability helpers used by the scheduling calendar, availability tab, and AI draft.

export const OPEN_AVAILABILITY = { start_time: "00:00", end_time: "23:59" };

const timeToMinutes = (t) => {
  if (!t) return null;
  const [h, m] = String(t).split(":").map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

// Returns { hasRecord, available, blocked, start, end } for a specific date.
export const dayAvailability = (record, dateStr) => {
  if (!record) return { hasRecord: false, available: true, blocked: false, start: null, end: null };
  const blocked = Array.isArray(record.unavailable_dates) && record.unavailable_dates.includes(dateStr);
  const dow = new Date(dateStr + "T00:00:00").getDay();
  const dayEntry = (record.days || []).find(d => d.day_of_week === dow);
  const available = !blocked && !!dayEntry && dayEntry.available;
  return { hasRecord: true, available, blocked, start: dayEntry?.start_time || null, end: dayEntry?.end_time || null };
};

// Total scheduled hours for an operator across the given week's shifts.
export const weeklyScheduledHours = (weekShifts, operatorId) => {
  return (weekShifts || []).filter(s => s.operator_id === operatorId).reduce((sum, s) => {
    if (!s.start_time || !s.end_time) return sum;
    const start = timeToMinutes(s.start_time);
    const end = timeToMinutes(s.end_time);
    if (start === null || end === null) return sum;
    let mins = end - start;
    if (mins < 0) mins += 1440;
    return sum + mins / 60;
  }, 0);
};

// Evaluate whether an existing shift conflicts with the operator's availability.
// Returns { conflict: bool, reasons: string[] }.
export const shiftAvailabilityConflict = (shift, record, weekShifts) => {
  const reasons = [];
  if (!record) return { conflict: false, reasons };
  const da = dayAvailability(record, shift.date);
  if (da.blocked) reasons.push("Blocked date");
  if (!da.available) {
    if (!reasons.length) reasons.push("Not available this day");
  } else if (da.start && da.end && shift.start_time && shift.end_time) {
    const ds = timeToMinutes(da.start);
    const de = timeToMinutes(da.end);
    const ss = timeToMinutes(shift.start_time);
    const se = timeToMinutes(shift.end_time);
    const deCap = de === 1439 ? 1440 : de; // treat 23:59 as end-of-day
    if (ss !== null && se !== null && (ss < ds || se > deCap)) {
      reasons.push("Outside available hours");
    }
  }
  if (record.weekly_max_hours && record.weekly_max_hours > 0) {
    const total = weeklyScheduledHours(weekShifts, shift.operator_id);
    if (total > record.weekly_max_hours) {
      reasons.push(`Over max hrs (${Math.round(total * 10) / 10}/${record.weekly_max_hours})`);
    }
  }
  return { conflict: reasons.length > 0, reasons };
};

export const employmentBadge = (record) => {
  if (!record) return null;
  return record.employment_type === "part_time" ? "PT" : "FT";
};