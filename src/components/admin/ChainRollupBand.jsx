import React from "react";
import { Building2 } from "lucide-react";

// Per-store summary shown only on a chain-wide view. Reads the rollup built by
// rollupByStore, so it always agrees with the records listed below it on the page.
export default function ChainRollupBand({ title, subtitle, columns, rollup }) {
  if (!rollup || rollup.groups.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-3.5">
        <Building2 className="h-4 w-4 flex-shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <span className="ml-auto flex-shrink-0 text-xs text-gray-400">
          {rollup.groups.length} {rollup.groups.length === 1 ? "store" : "stores"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-5 py-2.5 text-left">Store</th>
              {columns.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-4 py-2.5 text-right">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rollup.groups.map((g) => (
              <tr key={g.store_id || "unassigned"} className="hover:bg-gray-50/50">
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    {g.store_id ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">{g.store_id}</span>
                    ) : null}
                    <span className={`text-sm ${g.unknown || !g.store_id ? "text-amber-700" : "text-gray-700"}`}>{g.name}</span>
                  </div>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${c.className || "text-gray-900"}`}>
                    {c.format(g.values[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200 bg-gray-50/70">
              <td className="px-5 py-3 text-sm font-bold text-gray-900">Chain Total</td>
              {columns.map((c) => (
                <td key={c.key} className={`whitespace-nowrap px-4 py-3 text-right text-sm font-bold ${c.className || "text-gray-900"}`}>
                  {c.format(rollup.total.values[c.key])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}