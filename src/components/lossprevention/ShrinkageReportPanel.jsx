import React, { useState, useEffect, useMemo } from "react";
import { TrendingDown, Loader2 } from "lucide-react";
import { loadShrinkageIncidents, filterByRange, CATEGORY_META } from "@/lib/shrinkageUtils";
import ShrinkageTrendChart from "@/components/lossprevention/ShrinkageTrendChart";
import ShrinkageTopItems from "@/components/lossprevention/ShrinkageTopItems";
import ShrinkageBudgetCard from "@/components/lossprevention/ShrinkageBudgetCard";

export default function ShrinkageReportPanel({ fromDate, toDate }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await loadShrinkageIncidents();
        if (active) setAll(data);
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const inRange = useMemo(() => filterByRange(all, fromDate, toDate), [all, fromDate, toDate]);
  const filtered = useMemo(() => (category === "all" ? inRange : inRange.filter(i => i.category === category)), [inRange, category]);

  const stats = useMemo(() => {
    const loss = filtered.reduce((s, i) => s + (i.loss || 0), 0);
    const units = filtered.reduce((s, i) => s + (i.qty || 0), 0);
    const byCat = ["stolen", "damaged", "missing", "short_shipped"].map(k => ({
      key: k,
      loss: filtered.filter(i => i.category === k).reduce((s, i) => s + (i.loss || 0), 0),
      count: filtered.filter(i => i.category === k).length,
    }));
    return { loss, units, count: filtered.length, byCat };
  }, [filtered]);

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 text-amber-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><TrendingDown className="w-5 h-5 text-amber-600" /> Shrinkage Report</h2>
          <p className="text-xs text-gray-500 mt-0.5">Loss trends from damage, missing stock, short-ships, and theft — and their impact on the loss budget.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 font-medium">Source</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="all">All Sources</option>
            {["stolen", "damaged", "missing", "short_shipped"].map(k => (
              <option key={k} value={k}>{CATEGORY_META[k].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Total Shrinkage</p>
          <p className="text-xl font-bold text-gray-900">${stats.loss.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Units Affected</p>
          <p className="text-xl font-bold text-gray-900">{stats.units}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Incidents</p>
          <p className="text-xl font-bold text-gray-900">{stats.count}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Date Range</p>
          <p className="text-sm font-bold text-gray-900 leading-7">{fromDate || "—"} → {toDate || "—"}</p>
        </div>
      </div>

      <ShrinkageBudgetCard incidents={all} />
      <ShrinkageTrendChart incidents={filtered} fromDate={fromDate} toDate={toDate} />
      <ShrinkageTopItems incidents={filtered} />
    </div>
  );
}