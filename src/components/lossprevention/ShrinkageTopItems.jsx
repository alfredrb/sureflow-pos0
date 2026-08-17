import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CATEGORY_META, aggregateItems } from "@/lib/shrinkageUtils";

export default function ShrinkageTopItems({ incidents }) {
  const items = useMemo(() => aggregateItems(incidents), [incidents]);
  const top = items.slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Most Flagged Items</h3>
      <p className="text-xs text-gray-500 mb-3">Total loss by item, broken down by shrinkage type</p>

      {top.length === 0 ? (
        <div className="text-center text-gray-400 py-10 text-sm">No flagged items in the selected range</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(260, top.length * 34)}>
            <BarChart data={top} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={v => `$${Number(v).toFixed(2)}`} />
              <Legend />
              <Bar dataKey="stolen" stackId="a" name={CATEGORY_META.stolen.label} fill={CATEGORY_META.stolen.color} />
              <Bar dataKey="damaged" stackId="a" name={CATEGORY_META.damaged.label} fill={CATEGORY_META.damaged.color} />
              <Bar dataKey="missing" stackId="a" name={CATEGORY_META.missing.label} fill={CATEGORY_META.missing.color} />
              <Bar dataKey="short_shipped" stackId="a" name={CATEGORY_META.short_shipped.label} fill={CATEGORY_META.short_shipped.color} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Item</th>
                  <th className="py-2 px-3 font-medium text-right">Flags</th>
                  <th className="py-2 px-3 font-medium text-right">Units</th>
                  <th className="py-2 px-3 font-medium text-right">Total Loss</th>
                  <th className="py-2 pl-3 font-medium">Sources</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.sku || it.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">{it.name}</p>
                      {it.sku && <p className="text-xs text-gray-400">{it.sku}</p>}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-700">{it.count}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{it.qty}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">${it.loss.toFixed(2)}</td>
                    <td className="py-2 pl-3">
                      <div className="flex flex-wrap gap-1">
                        {["stolen", "damaged", "missing", "short_shipped"].map(k => it[k] > 0 && (
                          <span key={k} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${CATEGORY_META[k].bg} ${CATEGORY_META[k].text}`}>
                            {CATEGORY_META[k].label} ${it[k].toFixed(0)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}