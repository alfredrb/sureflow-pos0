// Utility functions for shift management

export const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const getCurrentMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

export const isWithinTimeRange = (currentMins, startTime, endTime) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return currentMins >= start && currentMins <= end;
};

export const getShiftStatus = (shift) => {
  const now = getCurrentMinutes();
  const shiftStart = timeToMinutes(shift.start_time);
  const shiftEnd = timeToMinutes(shift.end_time);
  const breakStart = shift.break_start ? timeToMinutes(shift.break_start) : null;
  const breakEnd = shift.break_end ? timeToMinutes(shift.break_end) : null;
  const lunchStart = shift.lunch_start ? timeToMinutes(shift.lunch_start) : null;
  const lunchEnd = shift.lunch_end ? timeToMinutes(shift.lunch_end) : null;

  if (now < shiftStart) return { status: "not_started", message: "Shift hasn't started yet" };
  if (now > shiftEnd + 30) return { status: "overtime_lockout", message: "30+ minutes past shift end—overtime override required" };
  if (now > shiftEnd) return { status: "overtime", overtime_minutes: now - shiftEnd, message: `${now - shiftEnd} minutes overtime` };

  if (breakStart && breakEnd) {
    if (now >= breakStart && now <= breakEnd) return { status: "on_break", message: "On break" };
    if (now > breakEnd && now <= breakEnd + 30 && !shift.break_taken) return { status: "break_overdue", message: "Break overdue—must return within 30 min or override required" };
  }

  if (lunchStart && lunchEnd) {
    if (now >= lunchStart && now <= lunchEnd) return { status: "on_lunch", message: "On lunch" };
    if (now > lunchEnd && now <= lunchEnd + 30 && !shift.lunch_taken) return { status: "lunch_overdue", message: "Lunch overdue—must return within 30 min or override required" };
  }

  return { status: "on_shift", message: "On shift" };
};

export const getUpcomingAlerts = (shift) => {
  const now = getCurrentMinutes();
  const alerts = [];

  if (shift.break_start) {
    const breakStart = timeToMinutes(shift.break_start);
    if (now < breakStart && breakStart - now <= 5) {
      alerts.push({ type: "break_due", time: shift.break_start, message: "Break due soon" });
    }
  }

  if (shift.lunch_start) {
    const lunchStart = timeToMinutes(shift.lunch_start);
    if (now < lunchStart && lunchStart - now <= 5) {
      alerts.push({ type: "lunch_due", time: shift.lunch_start, message: "Lunch due soon" });
    }
  }

  const shiftEnd = timeToMinutes(shift.end_time);
  if (now < shiftEnd && shiftEnd - now <= 5) {
    alerts.push({ type: "shift_ending", time: shift.end_time, message: "Shift ending soon" });
  }

  return alerts;
};