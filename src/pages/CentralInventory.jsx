import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, AlertTriangle, Download, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LOW_STOCK = 10;

const exportToCSV = (data, filename) => {
  const keys = ["store_id", "sku", "name", "category", "price", "cost", "stock_qty", "tax_rate", "status"];
  const csv = [keys.join(","), ...data.map(p => keys.map(k => { const v = p[k] ?? ""; return typeof v === "string" && v.includes(",") ? `"${v}"` : v; }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  window.URL.revokeObjectURL(url);
};

export default function CentralInventory() {
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          base44.entities.Product.list(undefined, 2000),
          base44.entities.Store.list()
        ]);
        setProducts(p); setStores(s);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const storeName = (sid) => { const s = stores.find(x => (x.store_number || x.id) === sid); return s ? `Store ${s.store_number}` : (sid || "Unassigned"); };

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search) || (p.barcode || "").includes(search);
    const matchStore = storeFilter === "all" || p.store_id === storeFilter || (storeFilter === "unassigned" && !p.store_id);
    const matchLow = !lowOnly || (p.stock_qty || 0) <= LOW_STOCK;
    return matchSearch && matchStore && matchLow;
  });

  const lowCount = products.filter(p => (p.stock_qty || 0) <= LOW_STOCK).length;

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading inventory…</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Network Inventory</h1>
          <p className="text-sm text-slate-500">{products.length} SKUs · <span className="text-orange-600 font-medium">{lowCount} low-stock</span></p>
        </div>
        <Button onClick={() => exportToCSV(filtered, "central-inventory.csv")} variant="outline" className="border-slate-300"><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name, SKU, or barcode…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All stores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stores</SelectItem>
            {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly(!lowOnly)} className={lowOnly ? "bg-orange-600 hover:bg-orange-500 text-white" : "border-slate-300"}>
          {lowOnly ? "Showing Low-Stock" : "Low-Stock Only"}
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Store</th>
              <th className="text-left px-4 py-3">Product</th>
              <th className="text-left px-4 py-3">SKU</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-right px-4 py-3">Stock</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No products found.</td></tr>}
            {filtered.slice(0, 1000).map(p => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{storeName(p.store_id)}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500">{p.sku}</td>
                <td className="px-4 py-3 text-slate-500">{p.category || "—"}</td>
                <td className="px-4 py-3 text-right font-medium">${(p.price || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-flex items-center gap-1 ${(p.stock_qty || 0) <= LOW_STOCK ? "text-orange-600 font-semibold" : "text-slate-700"}`}>
                    {(p.stock_qty || 0) <= LOW_STOCK && <AlertTriangle className="w-3 h-3" />}{p.stock_qty || 0}
                  </span>
                </td>
                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{p.status || "active"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 1000 && <div className="px-4 py-2 text-xs text-slate-400 bg-slate-50">Showing first 1000 of {filtered.length}. Refine filters or export for the full set.</div>}
      </div>
    </div>
  );
}