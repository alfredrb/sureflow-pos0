import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ClipboardCheck, Search, Save, CheckCircle2, AlertTriangle, History, Package, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

export default function AdminInventoryReconciliation() {
  const operator = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch { return null; } })();
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({});
  const [apply, setApply] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [prods, hist] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.InventoryReconciliation.list("-date", 50),
      ]);
      setProducts(prods);
      setHistory(hist);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load inventory", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Product", () => load(true), { intervalMs: 30000 });

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search) || (p.barcode || "").includes(search));

  const setCount = (sku, v) => setCounts(c => ({ ...c, [sku]: v }));

  const countedLines = () => filtered
    .filter(p => counts[p.sku] !== undefined && counts[p.sku] !== "")
    .map(p => {
      const counted = parseInt(counts[p.sku]) || 0;
      const system = p.stock_qty || 0;
      return { sku: p.sku, name: p.name, system_qty: system, counted_qty: counted, discrepancy: counted - system, _id: p.id };
    });

  const lines = countedLines();
  const matched = lines.filter(l => l.discrepancy === 0).length;
  const short = lines.filter(l => l.discrepancy < 0).length;
  const over = lines.filter(l => l.discrepancy > 0).length;
  const shortUnits = lines.filter(l => l.discrepancy < 0).reduce((s, l) => s + l.discrepancy, 0);

  const save = async () => {
    if (lines.length === 0) { toast({ title: "No counts entered", description: "Enter a physical count for at least one item.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (apply) {
        for (const l of lines) {
          const prod = products.find(p => p.id === l._id);
          if (prod && (prod.stock_qty || 0) !== l.counted_qty) {
            await base44.entities.Product.update(prod.id, { stock_qty: l.counted_qty });
          }
        }
      }
      await base44.entities.InventoryReconciliation.create({
        date: new Date().toISOString(),
        operator_name: operator?.full_name || "Admin",
        operator_id: operator?.operator_id || "",
        status: "completed",
        total_items: lines.length,
        matched_count: matched,
        short_count: short,
        over_count: over,
        applied: apply,
        lines: lines.map(({ _id, ...rest }) => rest),
      });
      toast({ title: "Reconciliation Saved", description: `${lines.length} items counted · ${short} short · ${over} over${apply ? " · stock updated" : ""}` });
      setCounts({});
      setApply(false);
      load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save reconciliation", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-full p-10"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-blue-600" /> Inventory Reconciliation</h1>
          <p className="text-gray-500 text-sm mt-1">Enter physical stock counts and flag discrepancies against logged inventory levels.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl shadow-sm">
            <Switch checked={apply} onCheckedChange={setApply} />
            <span className="text-xs text-gray-600">Apply counts to inventory</span>
          </div>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-500"><Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Count"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><Package className="w-4 h-4 text-blue-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{lines.length}</p><p className="text-[11px] text-gray-500">Items Counted</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><CheckCircle2 className="w-4 h-4 text-emerald-500 mb-1" /><p className="text-2xl font-bold text-emerald-600">{matched}</p><p className="text-[11px] text-gray-500">Matched</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><AlertTriangle className="w-4 h-4 text-red-500 mb-1" /><p className="text-2xl font-bold text-red-600">{short}</p><p className="text-[11px] text-gray-500">Short ({shortUnits} units)</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><AlertTriangle className="w-4 h-4 text-amber-500 mb-1" /><p className="text-2xl font-bold text-amber-600">{over}</p><p className="text-[11px] text-gray-500">Over</p></div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search products to count..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-right">System Qty</th>
                <th className="px-3 py-3 text-right">Counted Qty</th>
                <th className="px-3 py-3 text-right">Discrepancy</th>
                <th className="px-3 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-10">No products found.</td></tr>
              ) : filtered.map(p => {
                const counted = counts[p.sku];
                const hasCount = counted !== undefined && counted !== "";
                const disc = hasCount ? (parseInt(counted) || 0) - (p.stock_qty || 0) : null;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-3 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{p.stock_qty || 0}</td>
                    <td className="px-3 py-3 text-right">
                      <Input type="number" value={counted ?? ""} onChange={e => setCount(p.sku, e.target.value)} className="w-24 ml-auto text-right h-8" placeholder="—" />
                    </td>
                    <td className="px-3 py-3 text-right font-medium">
                      {disc === null ? <span className="text-gray-300">—</span> : disc === 0 ? <span className="text-emerald-600">0</span> : <span className={disc < 0 ? "text-red-600" : "text-amber-600"}>{disc > 0 ? "+" : ""}{disc}</span>}
                    </td>
                    <td className="px-3 py-3">
                      {disc === null ? <span className="text-gray-300 text-xs">Not counted</span>
                        : disc === 0 ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Match</span>
                        : disc < 0 ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">Short</span>
                        : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Over</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2"><History className="w-4 h-4 text-gray-400" /><h3 className="font-semibold text-gray-900 text-sm">Reconciliation History</h3></div>
        <div className="divide-y divide-gray-50">
          {history.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No reconciliations recorded yet.</p>
          ) : history.map(h => {
            const open = expanded === h.id;
            return (
              <div key={h.id}>
                <button onClick={() => setExpanded(open ? null : h.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{moment(h.date).format("MMM D, YYYY h:mm A")}</p>
                      <p className="text-xs text-gray-400">by {h.operator_name || "—"} · {h.total_items || 0} items · {h.matched_count || 0} match · {h.short_count || 0} short · {h.over_count || 0} over{h.applied ? " · stock applied" : ""}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${(h.short_count || 0) > 0 || (h.over_count || 0) > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{(h.short_count || 0) + (h.over_count || 0) > 0 ? "Discrepancies" : "Balanced"}</span>
                </button>
                {open && (h.lines || []).length > 0 && (
                  <div className="px-4 pb-3 bg-gray-50/40">
                    <table className="w-full text-xs">
                      <thead><tr className="text-gray-400 uppercase"><th className="text-left py-1">SKU</th><th className="text-left">Name</th><th className="text-right">System</th><th className="text-right">Counted</th><th className="text-right">Disc</th></tr></thead>
                      <tbody>
                        {h.lines.map((l, i) => (
                          <tr key={i} className={l.discrepancy !== 0 ? "text-red-600" : "text-gray-600"}>
                            <td className="py-1 font-mono">{l.sku}</td><td>{l.name}</td><td className="text-right">{l.system_qty}</td><td className="text-right">{l.counted_qty}</td><td className="text-right font-medium">{l.discrepancy > 0 ? "+" : ""}{l.discrepancy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}