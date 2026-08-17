// Shared payroll / labor-cost helpers used by the Payroll admin page,
// the scheduling calendar labor-cost indicator, and the AI draft engine.

const DEFAULT_BASE_RATE = 15;
const DEFAULT_OT_MULTIPLIER = 1.5;
const DEFAULT_OT_THRESHOLD = 40;

// Position display labels keyed by operator role.
export const ROLE_POSITION_LABELS = {
  cashier: "Cashier",
  csm: "CSM",
  manager: "Manager",
  technician: "Technician",
  loss_prevention: "Loss Prevention",
  vendor: "Vendor"
};

// Resolve the pay-rate record for a given role, falling back to defaults.
export const getRateForRole = (payRates, role) => {
  const r = (payRates || []).find(p => p.role === role && p.active !== false);
  return {
    base_rate: r?.base_rate ?? DEFAULT_BASE_RATE,
    overtime_multiplier: r?.overtime_multiplier ?? DEFAULT_OT_MULTIPLIER
  };
};

// Net hours for a scheduled shift (HH:MM strings), subtracting break + lunch.
export const shiftNetHours = (shift) => {
  if (!shift || !shift.start_time || !shift.end_time) return 0;
  const toMin = (t) => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let mins = toMin(shift.end_time) - toMin(shift.start_time);
  if (mins < 0) mins += 24 * 60; // overnight
  const breakMins = (shift.break_start && shift.break_end) ? Math.abs(toMin(shift.break_end) - toMin(shift.break_start)) : 0;
  const lunchMins = (shift.lunch_start && shift.lunch_end) ? Math.abs(toMin(shift.lunch_end) - toMin(shift.lunch_start)) : 0;
  return Math.max(0, (mins - breakMins - lunchMins) / 60);
};

// Net worked hours for a time-clock entry (date-time strings).
export const entryNetHours = (entry) => {
  if (!entry || !entry.clock_in || !entry.clock_out) return 0;
  const toMs = (s) => new Date(s).getTime();
  let ms = toMs(entry.clock_out) - toMs(entry.clock_in);
  if (ms < 0) return 0;
  const meal = (entry.meal_start && entry.meal_end) ? Math.max(0, toMs(entry.meal_end) - toMs(entry.meal_start)) : 0;
  const brk = (entry.break_start && entry.break_end) ? Math.max(0, toMs(entry.break_end) - toMs(entry.break_start)) : 0;
  return Math.max(0, (ms - meal - brk) / 3600000);
};

// Total weekly labor cost from a set of shifts (one calendar week).
// Splits each operator's weekly hours into regular vs overtime using the
// configured threshold, then applies their position pay rate.
export const weekLaborCost = (weekShifts, operators, payRates, overtimeThreshold = DEFAULT_OT_THRESHOLD) => {
  const opById = {};
  (operators || []).forEach(o => { opById[o.operator_id] = o; });
  const hoursByOp = {};
  (weekShifts || []).forEach(s => {
    hoursByOp[s.operator_id] = (hoursByOp[s.operator_id] || 0) + shiftNetHours(s);
  });
  let total = 0;
  let regularHours = 0;
  let otHours = 0;
  const byOp = {};
  Object.entries(hoursByOp).forEach(([opId, hours]) => {
    const role = opById[opId]?.role;
    const { base_rate, overtime_multiplier } = getRateForRole(payRates, role);
    const ot = Math.max(0, hours - overtimeThreshold);
    const reg = hours - ot;
    const pay = reg * base_rate + ot * base_rate * overtime_multiplier;
    total += pay;
    regularHours += reg;
    otHours += ot;
    byOp[opId] = { hours, reg, ot, pay, base_rate, overtime_multiplier };
  });
  return { total: Math.round(total * 100) / 100, regularHours: Math.round(regularHours * 100) / 100, otHours: Math.round(otHours * 100) / 100, byOp };
};

// Per-operator weekly hours for a set of shifts (used by the AI engine to
// compute carried overtime from the previous week).
export const weeklyHoursByOperator = (weekShifts) => {
  const m = {};
  (weekShifts || []).forEach(s => { m[s.operator_id] = (m[s.operator_id] || 0) + shiftNetHours(s); });
  return m;
};

// Build payroll rows from time-clock entries for a date range.
export const payrollFromTimeClock = (entries, operators, payRates, overtimeThreshold = DEFAULT_OT_THRESHOLD) => {
  const opById = {};
  (operators || []).forEach(o => { opById[o.operator_id] = o; });
  // Group by ISO week (Monday-based) so OT thresholds apply per natural week.
  const weekKey = (iso) => {
    const d = new Date(iso);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Monday start
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  };
  const byOpWeek = {};
  (entries || []).forEach(e => {
    if (!e.clock_in || !e.clock_out) return;
    const op = opById[e.operator_id];
    const role = op?.role || e.role;
    const key = `${e.operator_id}|${weekKey(e.clock_in)}`;
    if (!byOpWeek[key]) byOpWeek[key] = { operator_id: e.operator_id, operator_name: op?.full_name || e.operator_name || e.operator_id, role, hours: 0, entries: 0 };
    byOpWeek[key].hours += entryNetHours(e);
    byOpWeek[key].entries += 1;
  });
  const rows = Object.values(byOpWeek).map(r => {
    const { base_rate, overtime_multiplier } = getRateForRole(payRates, r.role);
    const ot = Math.max(0, r.hours - overtimeThreshold);
    const reg = r.hours - ot;
    const regular_pay = reg * base_rate;
    const overtime_pay = ot * base_rate * overtime_multiplier;
    return {
      operator_id: r.operator_id,
      operator_name: r.operator_name,
      role: r.role,
      regular_hours: Math.round(reg * 100) / 100,
      overtime_hours: Math.round(ot * 100) / 100,
      total_hours: Math.round(r.hours * 100) / 100,
      shifts_count: r.entries,
      base_rate,
      overtime_multiplier,
      regular_pay: Math.round(regular_pay * 100) / 100,
      overtime_pay: Math.round(overtime_pay * 100) / 100,
      total_pay: Math.round((regular_pay + overtime_pay) * 100) / 100
    };
  }).sort((a, b) => a.operator_name.localeCompare(b.operator_name));
  return rows;
};