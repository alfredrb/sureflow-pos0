import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, ShoppingCart, DollarSign, Package, Users, Monitor, TrendingDown, AlertTriangle, Loader2, Store as StoreIcon } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

const fmt = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CentralAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [storeFilter, setStoreFilter] = useState("all");
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [storeList, txns, products, registers, operators, shifts] = await Promise.all([
          base44.entities.Store.list(),
          base44.entities.Transaction.list("-created_date", 1000),
          base44.entities.Product.list(undefined, 1000),
          base44.entities.Register.list(undefined, 500),
          base44.entities.Operator.list(undefined, 500),
          base44.entities.Shift.list("-created_date", 500)
        ]);
        const activeStores = (storeList || []).filter(s => s.status !== "inactive");
        setStores(activeStores);
        const byId = new Map(activeStores.map(s => [s.store_number || s.id, { store: s, txns: [], products: 0, lowStock: 0, registers: 0, operators: 0, shifts: 0 }]));
        const unassigned = { store: null, txns: [], products: 0, lowStock: 0, registers: 0, operators: 0, shifts: 0 };

        (txns || []).forEach(t => {
          const bucket = byId.get(t.store_id) || unassigned;
          bucket.txns.push(t);
        });
        (products || []).forEach(p => {
          const sid = p.store_id;
          const bucket = byId.get(sid) || unassigned;
          bucket.products += 1;
          if ((p.stock_qty || 0) <= 10) bucket.lowStock += 1;
        });
        (registers || []).forEach(r => {
          const bucket = byId.get(r.store_id) || unassigned;
          bucket.registers += 1;
        });
        (operators || []).forEach(o => {
          const bucket = byId.get(o.store_id) || unassigned;
          bucket.operators += 1;
        });
        (shifts || []).forEach(sh => {
          const bucket = byId.get(sh.store_id) || unassigned;
          bucket.shifts += 1;
        });

        const allBuckets = [...byId.values()];
        if (unassigned.txns.length || unassigned.products || unassigned.registers || unassigned.operators) {
          allBuckets.push(unassigned);
        }

        const compute = (buckets) => {
          let revenue = 0, refunds = 0, txCount = 0, items = 0, lowStock = 0, products = 0, registers = 0, operators = 0, shifts = 0;
          buckets.forEach(b => {
            b.txns.forEach(t => {
              if (t.training_mode) return;
              if (t.status === "refunded") refunds += Math.abs(t.total || 0);
              else if (t.status !== "voided") revenue += t.total || 0;
              if (t.status !== "voided" && t.status !== "refunded") {
                txCount += 1;
                (t.items || []).forEach(i => { items += i.qty || 0; });
              }
            });
            lowStock += b.lowStock; products += b.products; registers += b.registers; operators += b.operators; shifts += b.shifts;
          });
          return { revenue, refunds, netRevenue: revenue - refunds, txCount, items, lowStock, products, registers, operators, shifts, storeCount: buckets.filter(b => b.store).length };
        };

        setMetrics({
          all: compute(allBuckets),
          perStore: allBuckets.map(b => ({
            store: b.store,
            store_id: b.store ? b.store.store_number : null,
            ...compute([b])
          })),
          unassigned
        });
      } catch (e) {
        setMetrics({ error: e.message });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading all-store metrics…
      </div>
    );
  }

  if (metrics?.error) {
    return <div className="p-8 text-red-600">Error loading metrics: {metrics.error}</div>;
  }

  const m = metrics.all;
  const shown = storeFilter === "all" ? metrics.perStore : metrics.perStore.filter(s => s.store_id === storeFilter || (storeFilter === "unassigned" && !s.store));

  const stats = [
    { label: "Total Stores", value: m.storeCount, icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Gross Revenue", value: `$${fmt(m.revenue)}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Refunds", value: `$${fmt(m.refunds)}`, icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Transactions", value: m.txCount.toLocaleString(), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Items Sold", value: m.items.toLocaleString(), icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Low-Stock SKUs", value: m.lowStock.toLocaleString(), icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Operators", value: m.operators.toLocaleString(), icon: Users, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Registers", value: m.registers.toLocaleString(), icon: Monitor, color: "text-cyan-600", bg: "bg-cyan-50" }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All-Store Dashboard</h1>
          <p className="text-sm text-slate-500">Headquarters overview across every SureFlow location</p>
        </div>
        <div className="w-full sm:w-64">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger><SelectValue placeholder="All stores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>
              ))}
              <SelectItem value="unassigned">Unassigned records</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
                  <Icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-bold text-slate-800">{s.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          {storeFilter === "all" ? "Per-Store Breakdown" : "Selected View"}
        </h2>
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Store</th>
                <th className="text-right px-4 py-3">Revenue</th>
                <th className="text-right px-4 py-3">Refunds</th>
                <th className="text-right px-4 py-3">Net</th>
                <th className="text-right px-4 py-3">Txns</th>
                <th className="text-right px-4 py-3">Items</th>
                <th className="text-right px-4 py-3">SKUs</th>
                <th className="text-right px-4 py-3">Low Stock</th>
                <th className="text-right px-4 py-3">Staff</th>
                <th className="text-right px-4 py-3">Registers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No stores match this filter.</td></tr>
              )}
              {shown.map((s, i) => (
                <tr key={s.store?.id || `unassigned-${i}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {s.store ? (
                      <div>
                        <div>Store {s.store.store_number}</div>
                        <div className="text-xs text-slate-400">{s.store.name} · {s.store.region || "—"}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-semibold">${fmt(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-rose-600">${fmt(s.refunds)}</td>
                  <td className="px-4 py-3 text-right font-semibold">${fmt(s.netRevenue)}</td>
                  <td className="px-4 py-3 text-right">{s.txCount}</td>
                  <td className="px-4 py-3 text-right">{s.items}</td>
                  <td className="px-4 py-3 text-right">{s.products}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{s.lowStock}</td>
                  <td className="px-4 py-3 text-right">{s.operators}</td>
                  <td className="px-4 py-3 text-right">{s.registers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}