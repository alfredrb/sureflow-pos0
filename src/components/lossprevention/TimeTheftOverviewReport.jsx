import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/data";
import moment from "moment";
import { Clock, AlertTriangle, Timer, FolderSearch, ScanLine } from "lucide-react";
import { DISCREPANCY_TYPES } from "@/lib/timeTheftUtils";

const SEV_BADGE = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const SEV_ROW = {
  high: "border-l-4 border-l-orange-400 bg-orange-50/40",
  critical: "border-l-4 border-l-red-500 bg-red-50/40",
  medium: "border-l-4 border-l-amber-300 bg-amber-50/30",
  low: "",
};

const dateOf = (d) => d.date || (d.detected_at || "").slice(0, 10);

// Overview report that surfaces time-clock discrepancies requiring manager review.
export default function TimeTheftOverviewReport({ fromDate, toDate, onStartInvestigation }) {
  const [discrepancies, setDiscrepancies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await base44.entities.TimeClockDiscrepancy.list("-detected_at", 500);
      setDiscrepancies(data);
    } catch {
      setDiscrepancies([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const start = moment(fromDate).startOf("day");
  const end = moment(toDate).endOf("day");
  const inRange = (d) => !!d && moment(d).isSameOrAfter(start) && moment(d).isSameOrBefore(end);

  const inRangeDiscrepancies = useMemo(
    () => discrepancies.filter((d) => inRange(dateOf(d))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [discrepancies, fromDate, toDate]
  );

  // Discrepancies that still need a manager's attention (open or investigating).
  const needsReview = useMemo(
    () => inRangeDiscrepancies
      .filter((d) => d.status !== "resolved")
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        const diff = (order[b.severity] ?? 9) - (order[a.severity] ?? 9);
        if (diff !== 0) return diff;
        return moment(b.detected_at || b.created_date || 0).diff(moment(a.detected_at || a.created_date || 0));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inRangeDiscrepancies]
  );

  const totalHours = inRangeDiscrepancies.reduce((s, d) => s + (d.hours_impact || 0), 0);
  const totalAmount = inRangeDiscrepancies.reduce((s, d) => s + (d.amount_impact || 0), 0);
  const highCount = needsReview.filter((d) => d.severity === "high" || d.severity === "critical").length;

  const investigate = (d) => {
    const meta = DISCREPANCY_TYPES[d.discrepancy_type] || { label: d.discrepancy_type };
    onStartInvestigation({
      title: `Time Theft: ${meta.label} — ${d.operator_name || "Unknown"}`,
      type: "time_theft",
      operator_name: d.operator_name || "",
      operator_id: d.operator_id || "",
      severity: d.severity || "medium",
      summary: `${meta.label} on ${moment(dateOf(d)).format("MMM D, YYYY")}. ${d.description}`,
      amount_impact: d.amount_impact || 0,
      evidence: [
        {
          type: "timeclock_discrepancy",
          detail: `${meta.label}: ${d.description}`,
          amount: d.amount_impact || 0,
          date: d.detected_at || d.created_date,
        },
      ],
    });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600" />
        <h2 className="font-semibold text-gray-900">Time Theft Report</h2>
        <span className="text-xs text-gray-400 font-normal">— time-clock discrepancies needing manager investigation</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
        <div className="bg-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-lg font-bold text-gray-900">{needsReview.length}</p><p className="text-[11px] text-gray-500">Needs review</p></div>
        </div>
        <div className="bg-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
          <div><p className="text-lg font-bold text-gray-900">{highCount}</p><p className="text-[11px] text-gray-500">High / critical</p></div>
        </div>
        <div className="bg-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center"><Clock className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-lg font-bold text-gray-900">{totalHours.toFixed(2)}h</p><p className="text-[11px] text-gray-500">Hours involved</p></div>
        </div>
        <div className="bg-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center"><Timer className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold text-gray-900">${totalAmount.toFixed(2)}</p><p className="text-[11px] text-gray-500">Est. pay exposure</p></div>
        </div>
      </div>

      <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : needsReview.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm flex flex-col items-center gap-1">
            <ScanLine className="w-5 h-5 text-gray-300" />
            No time-clock discrepancies need investigation in this period.
          </div>
        ) : (
          needsReview.map((d) => {
            const m = DISCREPANCY_TYPES[d.discrepancy_type] || { label: d.discrepancy_type };
            return (
              <div key={d.id} className={`px-5 py-3 flex items-center justify-between gap-3 ${SEV_ROW[d.severity] || ""}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 bg-slate-100 text-slate-700">{m.label}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{d.description}</p>
                    <p className="text-xs text-gray-400">
                      {d.operator_name || "—"} · {d.hours_impact ? `${d.hours_impact.toFixed(2)}h` : "—"} · {moment(d.detected_at || d.created_date).format("MMM D, h:mm A")}
                      {d.detected_by ? ` · ${d.detected_by}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${SEV_BADGE[d.severity] || "bg-gray-100 text-gray-600"}`}>{d.severity}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{d.status}</span>
                  {d.amount_impact ? <span className="text-sm font-medium text-gray-700 whitespace-nowrap">${d.amount_impact.toFixed(2)}</span> : null}
                  <button
                    onClick={() => investigate(d)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    <FolderSearch className="w-3.5 h-3.5" /> Investigate
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}