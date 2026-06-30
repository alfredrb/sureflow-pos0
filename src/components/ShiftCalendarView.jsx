import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ShiftCalendarView() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      const allShifts = await base44.entities.Shift.list("-date", 500);
      setShifts(allShifts);
      setLoading(false);
    } catch (e) {
      console.error("Error loading shifts:", e);
      setLoading(false);
    }
  };

  // Get week start (Sunday) and end (Saturday)
  const getWeekRange = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return { start: weekStart, end: weekEnd };
  };

  const { start: weekStart, end: weekEnd } = getWeekRange(currentDate);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    days.push(date);
  }

  // Filter shifts for this week
  const weekShifts = shifts.filter(s => {
    const shiftDate = new Date(s.date);
    return shiftDate >= weekStart && shiftDate <= weekEnd;
  });

  // Get unique registers from shifts
  const registers = [...new Set(weekShifts.map(s => s.register_id))].sort();

  if (loading) return <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />;

  const prevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg sm:text-xl text-gray-900">Weekly Shift Schedule</h2>
          <div className="flex gap-2">
            <button
              onClick={prevWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Header with days */}
          <div className="grid gap-1 p-3 sm:p-4 bg-gray-50 border-b border-gray-200" style={{ gridTemplateColumns: `150px repeat(7, 1fr)` }}>
            <div className="font-semibold text-xs text-gray-600 uppercase">Register</div>
            {days.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="font-semibold text-xs sm:text-sm text-gray-900">{dayNames[idx]}</p>
                <p className="text-xs text-gray-500">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
            ))}
          </div>

          {/* Shift data by register */}
          {registers.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No shifts scheduled for this week</div>
          ) : (
            <div>
              {registers.map((registerId) => (
                <div key={registerId} className="grid gap-1 p-3 sm:p-4 border-b border-gray-100 hover:bg-gray-50 transition" style={{ gridTemplateColumns: `150px repeat(7, 1fr)` }}>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 truncate">{registerId}</p>
                  </div>
                  {days.map((day, dayIdx) => {
                    const dayStr = day.toISOString().split("T")[0];
                    const dayShifts = weekShifts.filter(
                      s => s.register_id === registerId && s.date === dayStr
                    );

                    return (
                      <div key={dayIdx} className="text-center">
                        {dayShifts.length === 0 ? (
                          <div className="text-xs text-gray-400">—</div>
                        ) : (
                          <div className="space-y-1">
                            {dayShifts.map((shift, idx) => (
                              <div
                                key={idx}
                                className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-xs"
                              >
                                <p className="font-semibold text-blue-900 truncate">{shift.operator_name}</p>
                                <p className="text-blue-700 text-[10px]">
                                  {shift.start_time} – {shift.end_time}
                                </p>
                                {shift.status === "overtime" && (
                                  <p className="text-red-600 text-[10px] font-bold">OT</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}