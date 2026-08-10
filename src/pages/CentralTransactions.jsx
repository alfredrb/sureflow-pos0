import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Eye, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import moment from "moment";

const STATUS_BADGE = {
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  voided: { label: "Voided", cls: "bg-red-100 text-red-700" },
  refunded: { label: "Refunded", cls: "bg-amber-100 text-amber-700" },
  exchanged: { label: "Exchanged", cls: "bg-teal-100 text-teal-700" },
};

const exportToCSV = (data, filename) => {
  const keys = ["store_id", "transaction_id", "operator_name", "operator_id", "register_id", "payment_method", "status", "subtotal", "tax", "total", "created_date"];
  const csv = [keys.join(","), ...data.map(t => keys.map(k => { const v = t[k] ?? ""; return typeof v === "string" && v.includes(",") ? `"${v}"` : v; }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
};

export default function CentralTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [txns, storeList] = await Promise.all([
          base44.entities.Transaction.list("-created_date", 1000),
          base44.entities.Store.list()
        ]);
        setTransactions(txns);
        setStores(storeList);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const storeName = (sid) => { const s = stores.find(x => (x.store_number || x.id) === sid); return s ? `Store ${s.store_number}` : (sid || "Unassigned"); };

  const filtered = transactions.filter(t => {
    if (t.training_mode) return false;
    const matchSearch = !search || t.transaction_id?.toLowerCase().includes(search.toLowerCase()) || t.operator_name?.toLowerCase().includes(search.toLowerCase()) || t.operator_id?.toLowerCase().includes(search.toLowerCase());
    const matchStore = storeFilter === "all" || t.store_id === storeFilter || (storeFilter === "unassigned" && !t.store_id);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStore && matchStatus;
  });

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading transactions…</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">All-Store Transactions</h1>
          <p className="text-sm text-slate-500">{filtered.length} transactions shown</p>
        </div>
        <Button onClick={() => exportToCSV(filtered, "central-transactions.csv")} variant="outline" className="border-slate-300"><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by TX ID, operator…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All stores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="exchanged">Exchanged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Store</th>
              <th className="text-left px-4 py-3">Transaction</th>
              <th className="text-left px-4 py-3">Operator</th>
              <th className="text-left px-4 py-3">Register</th>
              <th className="text-left px-4 py-3">Payment</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No transactions found.</td></tr>}
            {filtered.slice(0, 500).map(t => {
              const badge = STATUS_BADGE[t.status] || { label: t.status, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{storeName(t.store_id)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{t.transaction_id}</td>
                  <td className="px-4 py-3 text-slate-700">{t.operator_name || "—"}<div className="text-[11px] text-slate-400">{t.operator_id}</div></td>
                  <td className="px-4 py-3 text-slate-500">{t.register_id}</td>
                  <td className="px-4 py-3 capitalize text-slate-500">{t.payment_method}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.label}</span></td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.status === "refunded" || t.status === "exchanged" ? "text-rose-600" : "text-emerald-600"}`}>{(t.status === "refunded" || t.status === "exchanged") ? "−" : ""}${(Math.abs(t.total) || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{moment(t.created_date).format("MMM D, h:mm A")}</td>
                  <td className="px-4 py-3"><button onClick={() => setDetail(t)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Eye className="w-3.5 h-3.5" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 500 && <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50">Showing first 500 of {filtered.length}. Refine filters or export for the full set.</div>}
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transaction {detail?.transaction_id}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500 block text-xs">Store</span><span className="font-medium">{storeName(detail.store_id)}</span></div>
                <div><span className="text-slate-500 block text-xs">Operator</span><span className="font-medium">{detail.operator_name || "—"}</span></div>
                <div><span className="text-slate-500 block text-xs">Register</span><span className="font-medium">{detail.register_id}</span></div>
                <div><span className="text-slate-500 block text-xs">Payment</span><span className="font-medium capitalize">{detail.payment_method}</span></div>
                <div><span className="text-slate-500 block text-xs">Status</span><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(STATUS_BADGE[detail.status] || {}).cls}`}>{(STATUS_BADGE[detail.status] || {}).label || detail.status}</span></div>
                <div><span className="text-slate-500 block text-xs">Date</span><span className="font-medium">{moment(detail.created_date).format("MMM D, YYYY h:mm A")}</span></div>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 uppercase">Items</div>
                <div className="divide-y divide-slate-50">
                  {(detail.items || []).map((item, idx) => (
                    <div key={idx} className="px-4 py-2 flex justify-between text-sm"><span>{item.name} × {item.qty}</span><span className="font-medium">${(item.total || 0).toFixed(2)}</span></div>
                  ))}
                  {(!detail.items || detail.items.length === 0) && <div className="px-4 py-3 text-slate-400 text-sm">No items</div>}
                </div>
              </div>
              <div className="space-y-1 text-sm border-t pt-3">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>${(detail.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Tax</span><span>${(detail.tax || 0).toFixed(2)}</span></div>
                <div className={`flex justify-between font-bold text-lg ${detail.status === "refunded" || detail.status === "exchanged" ? "text-rose-600" : "text-emerald-600"}`}><span>Total</span><span>{(detail.status === "refunded" || detail.status === "exchanged") ? "−" : ""}${(Math.abs(detail.total) || 0).toFixed(2)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}