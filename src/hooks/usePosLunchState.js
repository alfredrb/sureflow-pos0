import { useState, useEffect } from "react";
import { base44 } from "@/api/data";

// Today's scheduled shift + active time-clock entry, plus the derived lunch
// enforcement state the register uses for reminders and the overdue lockout.
export function usePosLunchState(operator, currentTime) {
  const [todayShift, setTodayShift] = useState(null);
  const [activeEntry, setActiveEntry] = useState(null);

  useEffect(() => {
    if (!operator) return;
    const opId = operator.operator_id;
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const shifts = await base44.entities.Shift.filter({ operator_id: opId, date: today });
        setTodayShift(shifts[0] || null);
        const entries = await base44.entities.TimeClockEntry.filter({ operator_id: opId }, "-created_date", 50);
        const ae = entries.find(e => (e.date === today || (e.clock_in && e.clock_in.split("T")[0] === today)) && e.status !== "closed");
        setActiveEntry(ae || null);
      } catch (e) { /* non-fatal */ }
    };
    load();
    const unsub = base44.entities.TimeClockEntry.subscribe(load);
    return () => unsub();
  }, [operator?.operator_id]);

  const lunchState = (() => {
    if (!todayShift || !todayShift.lunch_start) return null;
    const now = currentTime;
    const [lh, lm] = todayShift.lunch_start.split(":").map(Number);
    const lunchStart = new Date(now); lunchStart.setHours(lh, lm, 0, 0);
    let lunchEnd = null;
    if (todayShift.lunch_end) {
      const [eh, em] = todayShift.lunch_end.split(":").map(Number);
      lunchEnd = new Date(now); lunchEnd.setHours(eh, em, 0, 0);
    }
    // Clean slate: lunch enforcement only applies while the operator is actually
    // on the clock. An entry closed by the auto clock-out sweep (or any close)
    // leaves no active entry, so no stale "Lunch Break Overdue" lockout.
    const clockedIn = !!activeEntry;
    // A fresh clock-in made after the scheduled lunch time (e.g. following an
    // auto clock-out) starts clean — that entry never owed this lunch window.
    const startedAfterLunch = clockedIn && activeEntry.clock_in && new Date(activeEntry.clock_in) >= lunchStart;
    const onLunch = activeEntry?.status === "on_meal";
    const lunchTaken = !!(activeEntry?.meal_start && activeEntry?.meal_end);
    const upcoming = clockedIn && !onLunch && !lunchTaken && now >= new Date(lunchStart.getTime() - 30 * 60000) && now < lunchStart;
    const past = clockedIn && !startedAfterLunch && !onLunch && !lunchTaken && now >= lunchStart;
    return { lunchStart, lunchEnd, onLunch, lunchTaken, upcoming, past };
  })();

  return { todayShift, activeEntry, lunchState };
}