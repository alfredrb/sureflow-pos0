import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Search, Package, RefreshCw, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import moment from "moment";
import TransactionDetailDialog from "@/components/TransactionDetailDialog";

const STATUS_BADGE = {
  sold: { label: "Sold", cls: "bg-emerald-100 text-emerald-700" },
  returned: { label: "Returned", cls: "bg-amber-100 text-amber-700" },
  exchanged: { label: "Exchanged", cls: "bg-teal-100 text-teal-700" },
};

export default function SerializedInventoryPanel({ fromDate, toDate }) {
  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewTx, setViewTx] = useState(null);

  const viewTransaction = async (txId) => {
    if (!txId) return;
    try {
      const results = await base44.entities.Transaction.filter({ transaction_id: txId });
      setViewTx(results[0] || null);
    } catch (e) { setViewTx(null); }
  };

  const load = async () => {
    try {
      const [recs, prods] = await Promise.all([
        base44.entities.SerializedSale.list("-sale_date", 1000),
        base44.entities.Product.list()
      ]);
      setRecords(recs);
      setProducts(prods);
    } catch (e) {
      setRecords([]); setProducts([]);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("SerializedSale", load, { intervalMs: 30000 });

  const inRange = (d) => {
    if (!d) return true;
    const m = moment(d);
    if (fromDate && m.isBefore(moment(fromDate).startOf("day"))) return false;
    if (toDate && m.isAfter(moment(toDate).endOf("day"))) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter(r => {
      if (!inRange(r.sale_date)) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (r.serial_number || "").toLowerCase().includes(q) ||
        (r.sku || "").toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q) ||
        (r.transaction_id || "").toLowerCase().includes(q);
    });
  }, [records, search, statusFilter, fromDate, toDate]);

  const serializedProducts = products.filter(p => p.serialized);
  const soldCount = records.filter(r => r.status === "sold").length;
  const returnedCount = records.filter(r => r.status === "returned").length;
  const exchangedCount = records.filter(r => r.status === "exchanged").length;

  if (loading) return (
    <div className="flex items-center justify-center py-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Package className="w-5 h-5 text-amber-600" /> Serialized Inventory — Sold Records</h2>
          <p className="text-gray-500 text-sm">Every serialized unit sold at the POS, with its current lifecycle status.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Serialized SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{serializedProducts.length}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Sold (in market)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{soldCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Returned</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{returnedCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Exchanged</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{exchangedCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search serial, SKU, name, or transaction..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            {[{ v: "all", l: "All" }, { v: "sold", l: "Sold" }, { v: "returned", l: "Returned" }, { v: "exchanged", l: "Exchanged" }].map(o => (
              <button key={o.v} onClick={() => setStatusFilter(o.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${statusFilter === o.v ? "bg-amber-600 text-white border-amber-500" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Serial Number</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Sale Transaction</th>
                <th className="px-4 py-3 text-left">Sold On</th>
                <th className="px-4 py-3 text-left">Operator</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Return</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No serialized sales in this range.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{r.serial_number}</td>
                  <td className="px-4 py-3 text-gray-700">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500">{r.sku}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-mono text-xs">{r.transaction_id}</span>
                      <button onClick={() => viewTransaction(r.transaction_id)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-[10px] font-medium" title="View transaction">
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.sale_date ? moment(r.sale_date).format("MMM D, YYYY h:mm A") : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{r.operator_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${(STATUS_BADGE[r.status] || STATUS_BADGE.sold).cls}`}>{(STATUS_BADGE[r.status] || STATUS_BADGE.sold).label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.return_date ? moment(r.return_date).format("MMM D, YYYY") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionDetailDialog tx={viewTx} onClose={() => setViewTx(null)} />
    </div>
  );
}