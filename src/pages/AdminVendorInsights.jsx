import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Package, DollarSign, ShoppingCart, TrendingUp } from "lucide-react";

const COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444", "#a855f7"];

export default function AdminVendorInsights() {
  const operator = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch { return null; } })();
  const isVendor = operator?.role === "vendor";
  const companyId = operator?.company_id || "";

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [txns, setTxns] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [daily, setDaily] = useState([]);
  const [stats, setStats] = useState({ revenue: 0, units: 0, orders: 0, items: 0 });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [allProds, allTxns] = await Promise.all([
          base44.entities.Product.list(),
          base44.entities.Transaction.list("-created_date", 1000),
        ]);
        const mine = isVendor ? allProds.filter(p => (p.vendor_company_id || "") === companyId) : allProds;
        const mySkus = new Set(mine.map(p => p.sku));
        const myTxns = allTxns.filter(t => t.status === "completed" && (t.items || []).some(i => mySkus.has(i.sku)));
        const itemMap = {};
        let revenue = 0, units = 0;
        const dateMap = {};
        myTxns.forEach(t => {
          const day = new Date(t.created_date).toLocaleDateString("en-US");
          (t.items || []).forEach(i => {
            if (!mySkus.has(i.sku)) return;
            const rev = Number(i.total || 0);
            const q = Number(i.qty || 0);
            revenue += rev; units += q;
            const name = i.name || i.sku;
            if (!itemMap[i.sku]) itemMap[i.sku] = { name, sku: i.sku, revenue: 0, units: 0 };
            itemMap[i.sku].revenue += rev;
            itemMap[i.sku].units += q;
            if (!dateMap[day]) dateMap[day] = { date: day, revenue: 0, units: 0 };
            dateMap[day].revenue += rev;
            dateMap[day].units += q;
          });
        });
        if (!active) return;
        setProducts(mine);
        setTxns(myTxns);
        setTopItems(Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
        setDaily(Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-30));
        setStats({ revenue, units, orders: myTxns.length, items: mine.length });
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vendor Insights{isVendor && companyId ? ` — ${companyId}` : ""}</h1>
        <p className="text-gray-500 text-sm mt-1">Sales performance for {isVendor ? "your inventory" : "all vendor inventory"}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center mb-3"><DollarSign className="w-4 h-4 text-white" /></div><p className="text-2xl font-bold text-gray-900">${stats.revenue.toFixed(2)}</p><p className="text-xs text-gray-500 mt-0.5">Revenue</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center mb-3"><ShoppingCart className="w-4 h-4 text-white" /></div><p className="text-2xl font-bold text-gray-900">{stats.units}</p><p className="text-xs text-gray-500 mt-0.5">Units Sold</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><div className="w-9 h-9 bg-violet-500 rounded-xl flex items-center justify-center mb-3"><Package className="w-4 h-4 text-white" /></div><p className="text-2xl font-bold text-gray-900">{stats.items}</p><p className="text-xs text-gray-500 mt-0.5">Products</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm"><div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center mb-3"><TrendingUp className="w-4 h-4 text-white" /></div><p className="text-2xl font-bold text-gray-900">{stats.orders}</p><p className="text-xs text-gray-500 mt-0.5">Orders</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Top Items by Revenue</h2>
          <p className="text-sm text-gray-500 mb-4">Best-selling products in your inventory</p>
          {topItems.length === 0 ? <div className="text-center text-gray-400 py-8 text-sm">No sales yet</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topItems} layout="vertical" margin={{ left: 20, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                  {topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Daily Revenue (last 30 days)</h2>
          <p className="text-sm text-gray-500 mb-4">Revenue trend over time</p>
          {daily.length === 0 ? <div className="text-center text-gray-400 py-8 text-sm">No sales yet</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} dot={{ fill: "#6366f1", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Recent Sales</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Transaction</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-right">Your Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {txns.slice(0, 20).map(t => {
                const mine = (t.items || []).filter(i => products.some(p => p.sku === i.sku));
                const rev = mine.reduce((s, i) => s + Number(i.total || 0), 0);
                return (
                  <tr key={t.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{t.transaction_id}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(t.created_date).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{mine.map(i => `${i.qty}x ${i.name}`).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">${rev.toFixed(2)}</td>
                  </tr>
                );
              })}
              {txns.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No sales yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}