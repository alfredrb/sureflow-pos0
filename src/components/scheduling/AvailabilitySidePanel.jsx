import React from "react";
import { UserCircle2, Clock, Ban } from "lucide-react";
import { employmentBadge } from "@/lib/availabilityUtils";

const DAY_DOTS = ["S", "M", "T", "W", "T", "F", "S"];

// Side panel listing each schedulable operator's preferred availability alongside the calendar.
export default function AvailabilitySidePanel({ operators, records, conflictMode, conflictsByOp }) {
  const recordByOp = React.useMemo(() => {
    const m = {};
    (records || []).forEach(r => { m[r.operator_id] = r; });
    return m;
  }, [records]);

  return (
    <div className="w-full lg:w-64 lg:border-r border-gray-100 border-b lg:border-b-0 bg-gray-50/50 flex-shrink-0 max-h-[640px] overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-gray-50/95 backdrop-blur z-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Availability</p>
        <p className="text-[11px] text-gray-400 mt-0.5">Preferred days & FT/PT status</p>
      </div>
      <div className="divide-y divide-gray-100">
        {operators.length === 0 && <div className="p-4 text-xs text-gray-400">No operators.</div>}
        {operators.map(op => {
          const rec = recordByOp[op.operator_id];
          const days = rec?.days || [];
          const hasConflict = conflictMode && conflictsByOp?.[op.operator_id];
          return (
            <div key={op.id} className={`px-4 py-3 ${hasConflict ? "bg-red-50/60" : ""}`}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                  <UserCircle2 className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{op.full_name}</p>
                    {rec && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${rec.employment_type === "part_time" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {employmentBadge(rec)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 capitalize">{op.role}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1">
                {DAY_DOTS.map((d, i) => {
                  const day = days.find(x => x.day_of_week === i);
                  const on = day?.available;
                  return (
                    <span
                      key={i}
                      title={day ? `${on ? "Available" : "Off"} ${day.start_time || ""}–${day.end_time || ""}` : "Not set"}
                      className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-medium ${on ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-400"}`}
                    >
                      {d}
                    </span>
                  );
                })}
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{rec?.weekly_max_hours ?? "—"}h/wk</span>
                {hasConflict && <span className="flex items-center gap-0.5 text-red-600 font-medium"><Ban className="w-3 h-3" />Conflict</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}