import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Search, ScanLine, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

// Lists all products with a Serialized flag toggle, and shows how many units of each
// serialized SKU are currently sold (in market) vs returned.
export default function SerializedInventoryTab({ products, onChanged }) {
  const [counts, setCounts] = useState({}); // { [sku]: { sold, returned } }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState(null);
  const { toast } = useToast();

  const loadCounts = async () => {
    try {
      const recs = await base44.entities.SerializedSale.list("-sale_date", 2000);
      const map = {};
      recs.forEach(r => {
        const k = r.sku;
        if (!map[k]) map[k] = { sold: 0, returned: 0, exchanged: 0 };
        if (r.status === "sold") map[k].sold += 1;
        else if (r.status === "returned") map[k].returned += 1;
        else if (r.status === "exchanged") map[k].exchanged += 1;
      });
      setCounts(map);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { loadCounts(); }, [products.length]);

  const toggle = async (p) => {
    setToggling(p.id);
    try {
      await base44.entities.Product.update(p.id, { serialized: !p.serialized });
      toast({ title: p.serialized ? "Serialized tracking disabled" : "Serialized tracking enabled", description: p.name });
      onChanged?.();
    } catch (e) {
      toast({ title: "Could not update", variant: "destructive" });
    }
    setToggling(null);
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").includes(search));
  const serializedCount = products.filter(p => p.serialized).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ScanLine className="w-5 h-5 text-indigo-600" /> Serialized Inventory Management</h2>
          <p className="text-gray-500 text-sm">Flag items as serialized to require a serial number at the POS and track every sold unit in the Loss Prevention workbench.</p>
        </div>
        <Button variant="outline" onClick={loadCounts}><RefreshCw className="w-4 h-4 mr-2" /> Refresh Counts</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Serialized SKUs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{serializedCount}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Units Sold (in market)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{Object.values(counts).reduce((s, c) => s + c.sold, 0)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Units Returned</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{Object.values(counts).reduce((s, c) => s + c.returned + c.exchanged, 0)}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 max-w-sm" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Sold Units</th>
                <th className="px-4 py-3 text-right">Returned</th>
                <th className="px-4 py-3 text-center">Serialized</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No products found.</td></tr>
              ) : filtered.map(p => {
                const c = counts[p.sku] || { sold: 0, returned: 0, exchanged: 0 };
                return (
                  <tr key={p.id} className={`hover:bg-gray-50/50 ${p.serialized ? "bg-indigo-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 flex items-center gap-1.5">
                        {p.name}
                        {p.serialized && <ScanLine className="w-3.5 h-3.5 text-indigo-500" />}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-4 py-3 text-gray-500">{p.category || "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.stock_qty || 0}</td>
                    <td className="px-4 py-3 text-right">
                      {p.serialized ? <span className="font-semibold text-emerald-600">{c.sold}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.serialized ? <span className="font-semibold text-amber-600">{c.returned + c.exchanged}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Switch checked={!!p.serialized} disabled={toggling === p.id} onCheckedChange={() => toggle(p)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {loading && <p className="text-xs text-gray-400 text-center">Loading sold-unit counts…</p>}
    </div>
  );
}