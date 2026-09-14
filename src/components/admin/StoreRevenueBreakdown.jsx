import React, { useMemo } from "react";
import { Building2, TrendingUp } from "lucide-react";

// Chain-wide only: which stores are carrying the revenue. This is the view an HQ admin
// cannot get from a single-store dashboard, so it appears solely on the 'All Stores'
// view and is replaced by that store's own numbers once one is selected.
export default function StoreRevenueBreakdown({ transactions, registers, stores }) {
  const rows = useMemo(() => {
    // Older sales predate store_id, so fall back to the register they were rung on —
    // otherwise a store's real history lands in "Unassigned".
    const regStore = new Map();
    (registers || []).forEach((r) => { if (r.register_id) regStore.set(r.register_id, r.store_id || ""); });

    const totals = {};
    (transactions || []).forEach((t) => {
      if (t.training_mode || t.status !== "completed") return;
      const store = t.store_id || regStore.get(t.register_id) || "";
      const key = store || "unassigned";
      if (!totals[key]) totals[key] = { store: store, revenue: 0, count: 0 };
      totals[key].revenue += t.total || 0;
      totals[key].count += 1;
    });

    const nameOf = (num) => {
      const s = (stores || []).find((x) => x.store_number === num);
      return s ? s.name : num ? `Store ${num}` : "Unassigned";
    };

    return Object.values(totals)
      .map((r) => ({ ...r, label: r.store ? `${r.store} · ${nameOf(r.store)}` : "Unassigned" }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactions, registers, stores]);

  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const chainTotal = rows.reduce((s, r) => s + r.revenue, 0);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Revenue by Store</h2>
          <p className="text-xs text-gray-500">${chainTotal.toFixed(2)} across {rows.length} {rows.length === 1 ? "store" : "stores"}</p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
                <Building2 className="h-3 w-3 flex-shrink-0 text-gray-400" />
                <span className="truncate font-medium">{r.label}</span>
              </span>
              <span className="flex-shrink-0 pl-3 font-semibold text-gray-900">
                ${r.revenue.toFixed(2)}
                <span className="ml-1.5 text-xs font-normal text-gray-400">{r.count} tx</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(2, (r.revenue / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}