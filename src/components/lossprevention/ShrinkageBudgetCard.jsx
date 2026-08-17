import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_META, currentMonthKey, dayKey } from "@/lib/shrinkageUtils";

export default function ShrinkageBudgetCard({ incidents }) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await base44.entities.StoreBudget.list("-month", 50);
        const month = currentMonthKey();
        if (active) setBudget((list || []).find(b => b.month === month) || null);
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const monthKey = currentMonthKey();
  const monthIncidents = useMemo(() => incidents.filter(i => dayKey(i.date)?.slice(0, 7) === monthKey), [incidents, monthKey]);

  const totalLoss = monthIncidents.reduce((s, i) => s + (i.loss || 0), 0);
  const byCategory = ["stolen", "damaged", "missing", "short_shipped"].map(k => ({
    key: k,
    loss: monthIncidents.filter(i => i.category === k).reduce((s, i) => s + (i.loss || 0), 0),
  }));

  const lossBudget = Number(budget?.loss_budget || 0);
  const hasBudget = lossBudget > 0;
  const pct = hasBudget ? (totalLoss / lossBudget) * 100 : 0;
  const over = hasBudget && totalLoss > lossBudget;
  const variance = hasBudget ? totalLoss - lossBudget : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Store Budget Impact</h3>
          <p className="text-xs text-gray-500">Shrinkage vs monthly loss budget · {monthKey}</p>
        </div>
        {loading ? (
          <span className="text-xs text-gray-400">Loading budget…</span>
        ) : !budget ? (
          <span className="text-xs text-amber-600 font-medium">No budget set for this month</span>
        ) : (
          <span className={`text-xs font-semibold px-2 py-1 rounded ${over ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
            {over ? "OVER BUDGET" : "WITHIN BUDGET"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-600 font-medium">Shrinkage (MTD)</p>
          <p className="text-lg font-bold text-slate-900">${totalLoss.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">Loss Budget</p>
          <p className="text-lg font-bold text-blue-900">${lossBudget.toFixed(2)}</p>
        </div>
        <div className={`${over ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"} rounded-lg p-3 border`}>
          <p className={`text-xs font-medium ${over ? "text-red-700" : "text-emerald-700"}`}>Variance</p>
          <p className={`text-lg font-bold ${over ? "text-red-900" : "text-emerald-900"}`}>{variance >= 0 ? "+" : ""}{variance.toFixed(2)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-xs text-slate-600 font-medium">% Consumed</p>
          <p className="text-lg font-bold text-slate-900">{hasBudget ? `${pct.toFixed(0)}%` : "—"}</p>
        </div>
      </div>

      {hasBudget && (
        <div className="mb-4">
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div className={`h-3 rounded-full transition-all ${over ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">{pct.toFixed(0)}% of loss budget consumed this month</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {byCategory.map(c => (
          <div key={c.key} className={`rounded-lg p-2.5 border ${CATEGORY_META[c.key].bg} ${CATEGORY_META[c.key].border}`}>
            <p className={`text-[11px] font-medium ${CATEGORY_META[c.key].text}`}>{CATEGORY_META[c.key].label}</p>
            <p className="text-sm font-bold text-gray-900">${c.loss.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}