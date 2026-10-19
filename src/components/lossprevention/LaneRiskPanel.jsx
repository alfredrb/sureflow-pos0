import React, { useMemo } from "react";
import { Gauge } from "lucide-react";

// Weighted exception score per lane over the selected date range.
const WEIGHTS = { void: 2, no_sale: 3, override: 1, drawer_open: 2, robbery: 5 };

function band(score) {
  if (score >= 40) return { label: "High", cls: "bg-red-100 text-red-700" };
  if (score >= 15) return { label: "Elevated", cls: "bg-amber-100 text-amber-700" };
  return { label: "Normal", cls: "bg-green-100 text-green-700" };
}

export default function LaneRiskPanel({ logs, fromDate, toDate }) {
  const rows = useMemo(() => {
    const from = fromDate ? new Date(fromDate) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    const byLane = {};
    (logs || []).forEach(l => {
      if (!WEIGHTS[l.event_type]) return;
      const d = new Date(l.created_date);
      if ((from && d < from) || (to && d > to)) return;
      const r = byLane[l.register_id] ||= { register_id: l.register_id, void: 0, no_sale: 0, override: 0, drawer_open: 0, robbery: 0, score: 0 };
      r[l.event_type]++;
      r.score += WEIGHTS[l.event_type] + (l.drawer_no_sale ? 3 : 0) + (l.self_approval_blocked ? 4 : 0);
    });
    return Object.values(byLane).sort((a, b) => b.score - a.score);
  }, [logs, fromDate, toDate]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1"><Gauge className="w-4 h-4" /> Lane Risk Score</h2>
      <p className="text-xs text-gray-500 mb-3">Voids ×2, no-sales ×3, overrides ×1, drawer opens ×2 (+3 unexplained), robberies ×5, blocked self-approvals +4.</p>
      {rows.length === 0 ? <p className="text-sm text-gray-500">No exceptions in this range.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-500 border-b">
            <th className="py-2">Lane</th><th>Voids</th><th>No Sales</th><th>Overrides</th><th>Drawer</th><th>Robbery</th><th>Score</th><th>Risk</th>
          </tr></thead>
          <tbody>
            {rows.map(r => { const b = band(r.score); return (
              <tr key={r.register_id} className="border-b last:border-0">
                <td className="py-2 font-medium">{r.register_id}</td><td>{r.void}</td><td>{r.no_sale}</td><td>{r.override}</td><td>{r.drawer_open}</td><td>{r.robbery}</td>
                <td className="font-bold">{r.score}</td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${b.cls}`}>{b.label}</span></td>
              </tr>
            ); })}
          </tbody>
        </table>
      )}
    </div>
  );
}