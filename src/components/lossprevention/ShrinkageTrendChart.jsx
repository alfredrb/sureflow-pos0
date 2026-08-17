import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CATEGORY_META, buildDailySeries } from "@/lib/shrinkageUtils";

const fmtDate = (s) => {
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function ShrinkageTrendChart({ incidents, fromDate, toDate }) {
  const data = useMemo(() => buildDailySeries(incidents, fromDate, toDate), [incidents, fromDate, toDate]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Shrinkage Loss Trend</h3>
      <p className="text-xs text-gray-500 mb-3">Daily loss ($), stacked by source category</p>
      {data.length === 0 ? (
        <div className="text-center text-gray-400 py-10 text-sm">No data in the selected range</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
              formatter={v => `$${Number(v).toFixed(2)}`}
              labelFormatter={l => fmtDate(l)}
            />
            <Legend />
            <Area type="monotone" dataKey="stolen" stackId="1" name={CATEGORY_META.stolen.label} stroke={CATEGORY_META.stolen.color} fill={CATEGORY_META.stolen.color} fillOpacity={0.5} />
            <Area type="monotone" dataKey="damaged" stackId="1" name={CATEGORY_META.damaged.label} stroke={CATEGORY_META.damaged.color} fill={CATEGORY_META.damaged.color} fillOpacity={0.5} />
            <Area type="monotone" dataKey="missing" stackId="1" name={CATEGORY_META.missing.label} stroke={CATEGORY_META.missing.color} fill={CATEGORY_META.missing.color} fillOpacity={0.5} />
            <Area type="monotone" dataKey="short_shipped" stackId="1" name={CATEGORY_META.short_shipped.label} stroke={CATEGORY_META.short_shipped.color} fill={CATEGORY_META.short_shipped.color} fillOpacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}