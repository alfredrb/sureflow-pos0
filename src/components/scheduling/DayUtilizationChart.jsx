import React from "react";

// Per-hour utilization for a single day (operating 06:00–22:00).
// Shows scheduled staff count vs peak-time required staff for each hour.
export default function DayUtilizationChart({ dayDate, dayShifts, peakTimes }) {
  const dow = dayDate.getDay();
  const hours = [];
  for (let h = 6; h <= 21; h++) {
    const required = peakTimes.find(p => p.day_of_week === dow && p.hour === h)?.required_staff || 0;
    const scheduled = dayShifts.filter(s => {
      if (!s.start_time || !s.end_time) return false;
      const [shh, shm] = s.start_time.split(":").map(Number);
      const [ehh, em] = s.end_time.split(":").map(Number);
      const start = shh + shm / 60;
      let end = ehh + em / 60;
      if (end <= start) end += 24;
      return start <= h && end > h;
    }).length;
    hours.push({ h, required, scheduled });
  }
  const max = Math.max(1, ...hours.map(x => Math.max(x.required, x.scheduled)));

  return (
    <div className="px-2 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
      <p className="text-[10px] font-semibold text-gray-500 mb-1.5">Hourly utilization</p>
      <div className="space-y-1">
        {hours.map(x => {
          const tone = x.required === 0 ? "text-gray-300" : x.scheduled < x.required ? "text-red-500" : x.scheduled > x.required ? "text-amber-500" : "text-emerald-600";
          return (
            <div key={x.h} className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-9">{String(x.h).padStart(2, "0")}:00</span>
              <div className="flex-1 flex gap-0.5">
                <div className="h-3 bg-gray-100 rounded-sm flex-1 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-blue-400 rounded-sm" style={{ width: `${(x.scheduled / max) * 100}%` }} />
                </div>
                <div className="h-3 bg-gray-100 rounded-sm flex-1 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-emerald-400 rounded-sm" style={{ width: `${(x.required / max) * 100}%` }} />
                </div>
              </div>
              <span className={`text-[9px] w-9 text-right font-medium ${tone}`}>{x.scheduled}/{x.required}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-gray-100 text-[9px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-sm" />Scheduled</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm" />Required</span>
      </div>
    </div>
  );
}