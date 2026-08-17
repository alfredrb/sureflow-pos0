import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { PackageX, TrendingDown, Ban, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

export default function ClaimsAuditPanel({ fromDate, toDate }) {
  const [claims, setClaims] = useState([]);
  const [losses, setLosses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [c, l, p] = await Promise.all([
        base44.entities.Claim.list("-date_created", 1000),
        base44.entities.ProfitLoss.list("-date", 1000),
        base44.entities.Product.list(),
      ]);
      setClaims(c); setLosses(l); setProducts(p);
    } catch (e) {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const inRange = (d) => {
    if (!d) return false;
    const m = moment(d);
    if (fromDate && m.isBefore(moment(fromDate).startOf("day"))) return false;
    if (toDate && m.isAfter(moment(toDate).endOf("day"))) return false;
    return true;
  };

  const rangeClaims = claims.filter(c => inRange(c.date_created));
  const rangeLoss = losses.filter(l => inRange(l.date)).reduce((s, l) => s + (l.amount || 0), 0);
  const blockedCount = products.filter(p => p.loss_blocked).length;

  // Aggregate claims by SKU: count, disposed loss, and most common return reason
  const bySku = {};
  rangeClaims.forEach(c => {
    if (!c.sku) return;
    const e = bySku[c.sku] || { sku: c.sku, name: c.name, claims: 0, disposedLoss: 0, disposedCount: 0, openCount: 0, reasons: {} };
    e.claims += 1;
    if (c.status === "disposed") { e.disposedLoss += (c.total_cost || 0); e.disposedCount += 1; }
    if (c.status === "open") e.openCount += 1;
    if (c.reason) e.reasons[c.reason] = (e.reasons[c.reason] || 0) + 1;
    bySku[c.sku] = e;
  });
  const rows = Object.values(bySku).map(e => {
    const topReason = Object.entries(e.reasons).sort((a, b) => b[1] - a[1])[0];
    return { ...e, topReason: topReason ? topReason[0] : "—", topReasonCount: topReason ? topReason[1] : 0 };
  }).sort((a, b) => b.disposedLoss - a.disposedLoss);

  const filteredRows = rows.filter(r => !search || (r.name || "").toLowerCase().includes(search.toLowerCase()) || (r.sku || "").includes(search));

  const isBlocked = (sku) => !!products.find(p => p.sku === sku)?.loss_blocked;

  const toggleBlock = async (row) => {
    const prod = products.find(p => p.sku === row.sku);
    if (!prod) { toast({ title: "Product not found", variant: "destructive" }); return; }
    const next = !prod.loss_blocked;
    try {
      await base44.entities.Product.update(prod.id, { loss_blocked: next });
      setProducts(prev => prev.map(p => p.id === prod.id ? { ...p, loss_blocked: next } : p));
      toast({ title: next ? "Sale Blocked" : "Sale Re-enabled", description: `${row.name} ${next ? "can no longer be sold at the POS" : "is available for sale again"}` });
    } catch (e) { toast({ title: "Error", description: "Failed to update", variant: "destructive" }); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><PackageX className="w-4 h-4 text-amber-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{rangeClaims.length}</p><p className="text-[11px] text-gray-500">Claims (in range)</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><TrendingDown className="w-4 h-4 text-red-500 mb-1" /><p className="text-2xl font-bold text-red-600">${rangeLoss.toFixed(2)}</p><p className="text-[11px] text-gray-500">Profit Loss (in range)</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><Ban className="w-4 h-4 text-red-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{blockedCount}</p><p className="text-[11px] text-gray-500">Items Blocked from Sale</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><ShieldCheck className="w-4 h-4 text-emerald-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{rows.length}</p><p className="text-[11px] text-gray-500">Items with Returns</p></div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        Items are ranked by disposed profit loss. Toggle <span className="font-semibold">Block Sale</span> to stop an item from being sold at the POS when its returns are causing too much profit loss. The most common return reason per item is shown to help spot defective / problem products.
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search items by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-right">Claims</th>
                <th className="px-3 py-3 text-right">Disposed Loss</th>
                <th className="px-3 py-3 text-left">Most Common Return Reason</th>
                <th className="px-3 py-3 text-center">Block Sale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-10">No claims in this date range.</td></tr>
              ) : filteredRows.map(r => (
                <tr key={r.sku} className={`hover:bg-gray-50/50 ${isBlocked(r.sku) ? "bg-red-50/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-3 py-3 text-gray-500">{r.sku}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{r.claims} <span className="text-[10px] text-gray-400">({r.openCount} open)</span></td>
                  <td className="px-3 py-3 text-right font-bold text-red-600">${r.disposedLoss.toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-600">{r.topReason} {r.topReasonCount > 1 && <span className="text-[10px] text-gray-400">×{r.topReasonCount}</span>}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch checked={isBlocked(r.sku)} onCheckedChange={() => toggleBlock(r)} />
                      <span className={`text-[10px] font-bold uppercase ${isBlocked(r.sku) ? "text-red-600" : "text-gray-400"}`}>{isBlocked(r.sku) ? "Blocked" : "Allowed"}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}