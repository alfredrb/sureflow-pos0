import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

// Low-stock alert: active, non-recalled items at or below the threshold, lowest first.
export default function LowStockAlert({ products, threshold = 10 }) {
  const [open, setOpen] = useState(false);
  const low = products
    .filter(p => p.status !== "discontinued" && !p.recalled && (p.stock_qty || 0) < threshold)
    .sort((a, b) => (a.stock_qty || 0) - (b.stock_qty || 0));
  if (low.length === 0) return null;
  const out = low.filter(p => (p.stock_qty || 0) <= 0).length;
  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-red-700 font-medium text-left">
        <AlertTriangle className="w-4 h-4" />
        {low.length} item{low.length === 1 ? "" : "s"} low on stock{out ? ` · ${out} out of stock` : ""}
        {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
      </button>
      {open && (
        <ul className="px-3 pb-2 max-h-48 overflow-y-auto divide-y divide-red-100">
          {low.map(p => (
            <li key={p.id} className="flex justify-between py-1 text-gray-700">
              <span className="truncate">{p.name} <span className="text-gray-400">({p.sku})</span></span>
              <span className={`font-semibold ${(p.stock_qty || 0) <= 0 ? "text-red-700" : "text-amber-700"}`}>{p.stock_qty || 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}