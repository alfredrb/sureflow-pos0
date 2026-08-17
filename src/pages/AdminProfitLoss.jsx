import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { TrendingDown, DollarSign, CalendarDays } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

export default function AdminProfitLoss() {
  const [losses, setLosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try { setLosses(await base44.entities.ProfitLoss.list("-date", 500)); }
    catch (e) { toast({ title: "Error", description: "Failed to load profit loss", variant: "destructive" }); }
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("ProfitLoss", () => load(true), { intervalMs: 30000 });

  const totalLoss = losses.reduce((s, l) => s + (l.amount || 0), 0);
  const monthStart = moment().startOf("month");
  const monthLoss = losses.filter(l => moment(l.date).isSameOrAfter(monthStart)).reduce((s, l) => s + (l.amount || 0), 0);

  const byDay = useMemo(() => {
    const map = {};
    for (let i = 13; i >= 0; i--) {
      const d = moment().subtract(i, "days").format("YYYY-MM-DD");
      map[d] = { date: d, label: moment(d).format("M/D"), amount: 0 };
    }
    losses.forEach(l => {
      const d = moment(l.date).format("YYYY-MM-DD");
      if (map[d]) map[d].amount += l.amount || 0;
    });
    return Object.values(map);
  }, [losses]);

  if (loading) return <div className="flex items-center justify-center h-full p-10"><div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><TrendingDown className="w-7 h-7 text-red-600" /> Profit Loss</h1>
        <p className="text-gray-500 text-sm mt-1">Store cost deducted from profit when returned items are disposed instead of restocked.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2"><div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-red-600" /></div><span className="text-xs text-gray-500">Total Profit Loss</span></div>
          <p className="text-3xl font-bold text-red-600">${totalLoss.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400">{losses.length} disposal {losses.length === 1 ? "record" : "records"}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2"><div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center"><CalendarDays className="w-4 h-4 text-blue-600" /></div><span className="text-xs text-gray-500">This Month</span></div>
          <p className="text-3xl font-bold text-gray-900">${monthLoss.toFixed(2)}</p>
          <p className="text-[11px] text-gray-400">Since {monthStart.format("MMM D")}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2"><div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><DollarSign className="w-4 h-4 text-gray-600" /></div><span className="text-xs text-gray-500">Avg per Disposal</span></div>
          <p className="text-3xl font-bold text-gray-900">${losses.length ? (totalLoss / losses.length).toFixed(2) : "0.00"}</p>
          <p className="text-[11px] text-gray-400">Across all records</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
        <h3 className="font-semibold text-gray-900 text-sm mb-3">Profit Loss — Last 14 Days</h3>
        {byDay.every(d => d.amount === 0) ? (
          <p className="text-center text-gray-400 text-sm py-12">No disposals recorded in the last 14 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f1" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ fill: "#f5f5f5" }} formatter={v => [`$${v.toFixed(2)}`, "Loss"]} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={36} fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-900 text-sm">Disposal Records</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-3 py-3 text-left">Item</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Unit Cost</th>
                <th className="px-3 py-3 text-right">Loss</th>
                <th className="px-3 py-3 text-left">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {losses.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10">No profit loss recorded yet. Disposing of a claim will appear here.</td></tr>
              ) : losses.map(l => (
                <tr key={l.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500">{moment(l.date).format("MMM D, YYYY h:mm A")}</td>
                  <td className="px-3 py-3 font-medium text-gray-900">{l.name}</td>
                  <td className="px-3 py-3 text-gray-500">{l.sku}</td>
                  <td className="px-3 py-3 text-right">{l.qty}</td>
                  <td className="px-3 py-3 text-right text-gray-700">${(l.unit_cost || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right font-bold text-red-600">−${(l.amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-500 capitalize">{l.disposal_method ? l.disposal_method.replace("_", " ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}