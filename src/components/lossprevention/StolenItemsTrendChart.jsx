import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7"];

export default function StolenItemsTrendChart({ rangeDays = 30 }) {
  const [byItem, setByItem] = useState([]);
  const [byDate, setByDate] = useState([]);
  const [totalLoss, setTotalLoss] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [incidents, setIncidents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const invs = await base44.entities.Investigation.list("-created_date", 500);
        const theft = invs.filter((i) => i.type === "stock_theft");
        const since = new Date(Date.now() - rangeDays * 24 * 3600 * 1000);
        const itemMap = {};
        const dateMap = {};
        let loss = 0, qty = 0;
        theft.forEach((inv) => {
          const d = new Date(inv.created_date);
          (inv.stolen_items || []).forEach((it) => {
            const tl = Number(it.total_loss || 0) || Number(it.qty || 0) * Number(it.unit_cost || 0);
            const q = Number(it.qty || 0);
            const key = it.sku || it.name || "Unknown";
            if (!itemMap[key]) itemMap[key] = { name: it.name || key, sku: it.sku || "", qty: 0, loss: 0, count: 0 };
            itemMap[key].qty += q;
            itemMap[key].loss += tl;
            itemMap[key].count += 1;
            if (d >= since) {
              const day = d.toLocaleDateString("en-US");
              if (!dateMap[day]) dateMap[day] = { date: day, loss: 0, qty: 0 };
              dateMap[day].loss += tl;
              dateMap[day].qty += q;
            }
            loss += tl; qty += q;
          });
        });
        if (!active) return;
        setByItem(Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10));
        setByDate(Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date)));
        setTotalLoss(loss); setTotalQty(qty); setIncidents(theft.length);
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [rangeDays]);

  if (loading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Stolen Item Trends</h2>
        <p className="text-sm text-gray-500 mt-1">Patterns built from stock-theft investigations</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-red-50 rounded-lg p-3 border border-red-100"><p className="text-xs text-red-700 font-medium">Total Stolen Value</p><p className="text-xl font-bold text-red-900">${totalLoss.toFixed(2)}</p></div>
        <div className="bg-orange-50 rounded-lg p-3 border border-orange-100"><p className="text-xs text-orange-700 font-medium">Units Stolen</p><p className="text-xl font-bold text-orange-900">{totalQty}</p></div>
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100"><p className="text-xs text-amber-700 font-medium">High-Theft Items</p><p className="text-xl font-bold text-amber-900">{byItem.length}</p></div>
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100"><p className="text-xs text-slate-700 font-medium">Theft Cases</p><p className="text-xl font-bold text-slate-900">{incidents}</p></div>
      </div>

      {byItem.length === 0 ? (
        <div className="text-center text-gray-400 py-10 text-sm">No stolen items logged yet. Create a “Stock Theft” investigation with stolen items to build a trend.</div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Top Stolen Items (all time)</h3>
            <p className="text-xs text-gray-500 mb-3">By quantity stolen</p>
            <ResponsiveContainer width="100%" height={Math.max(220, byItem.length * 32)}>
              <BarChart data={byItem} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
                <Bar dataKey="qty" name="Units Stolen" radius={[0, 6, 6, 0]}>
                  {byItem.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Stolen Value Trend (last {rangeDays} days)</h3>
            <p className="text-xs text-gray-500 mb-3">Daily dollar loss from theft</p>
            {byDate.length === 0 ? (
              <div className="text-center text-gray-400 py-8 text-sm">No theft recorded in this range</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={byDate} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Line type="monotone" dataKey="loss" name="Stolen Value" stroke="#ef4444" strokeWidth={2} dot={{ fill: "#ef4444", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}