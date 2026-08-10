import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

const fmt = (n) => (n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const exportToCSV = (data, filename) => {
  const keys = ["report_date", "store_id", "total_transactions", "total_revenue", "total_refunds", "net_revenue", "total_items_sold", "total_audits", "total_discrepancy"];
  const csv = [keys.join(","), ...data.map(r => keys.map(k => { const v = r[k] ?? ""; return typeof v === "string" && v.includes(",") ? `"${v}"` : v; }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
};

export default function CentralEODReports() {
  const [reports, setReports] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [r, s] = await Promise.all([
          base44.entities.EODReport.list("-report_date", 1000),
          base44.entities.Store.list()
        ]);
        setReports(r);
        setStores(s);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const storeName = (sid) => { const s = stores.find(x => (x.store_number || x.id) === sid); return s ? `Store ${s.store_number}` : (sid || "Unassigned"); };

  const filtered = reports.filter(r => storeFilter === "all" || r.store_id === storeFilter || (storeFilter === "unassigned" && !r.store_id));

  const totals = filtered.reduce((acc, r) => {
    acc.revenue += r.total_revenue || 0; acc.refunds += r.total_refunds || 0; acc.txns += r.total_transactions || 0; acc.items += r.total_items_sold || 0; acc.disc += r.total_discrepancy || 0;
    return acc;
  }, { revenue: 0, refunds: 0, txns: 0, items: 0, disc: 0 });

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading EOD reports…</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Consolidated EOD Reports</h1>
          <p className="text-sm text-slate-500">{filtered.length} reports across all stores</p>
        </div>
        <div className="flex gap-2">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All stores" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportToCSV(filtered, "central-eod.csv")} variant="outline" className="border-slate-300"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Gross Revenue", value: `$${fmt(totals.revenue)}`, color: "text-emerald-600" },
          { label: "Refunds", value: `$${fmt(totals.refunds)}`, color: "text-rose-600" },
          { label: "Net Revenue", value: `$${fmt(totals.revenue - totals.refunds)}`, color: "text-slate-800" },
          { label: "Transactions", value: totals.txns.toLocaleString(), color: "text-blue-600" },
          { label: "Audit Discrepancy", value: `$${fmt(totals.disc)}`, color: "text-amber-600" }
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Store</th>
              <th className="text-right px-4 py-3">Revenue</th>
              <th className="text-right px-4 py-3">Refunds</th>
              <th className="text-right px-4 py-3">Net</th>
              <th className="text-right px-4 py-3">Txns</th>
              <th className="text-right px-4 py-3">Items</th>
              <th className="text-right px-4 py-3">Audits</th>
              <th className="text-right px-4 py-3">Discrepancy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No EOD reports found.</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{r.report_date ? moment(r.report_date).format("MMM D, YYYY") : "—"}</td>
                <td className="px-4 py-3 text-slate-700">{storeName(r.store_id)}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">${fmt(r.total_revenue)}</td>
                <td className="px-4 py-3 text-right text-rose-600">${fmt(r.total_refunds)}</td>
                <td className="px-4 py-3 text-right font-semibold">${fmt((r.total_revenue || 0) - (r.total_refunds || 0))}</td>
                <td className="px-4 py-3 text-right">{r.total_transactions || 0}</td>
                <td className="px-4 py-3 text-right">{r.total_items_sold || 0}</td>
                <td className="px-4 py-3 text-right">{r.total_audits || 0}</td>
                <td className="px-4 py-3 text-right text-amber-600">${fmt(r.total_discrepancy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}