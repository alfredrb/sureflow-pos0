import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { PackageX, Search, Eye, TrendingDown, Inbox, Trash2, RotateCcw, Send, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const CONDITIONS = [
  { value: "good", label: "Good — sellable" },
  { value: "damaged", label: "Damaged" },
  { value: "defective", label: "Defective" },
  { value: "expired", label: "Expired / Spoiled" },
  { value: "unsanitary", label: "Unsanitary" },
  { value: "open_package", label: "Open Package" },
];
const DISPOSAL_METHODS = ["trash", "donate", "recycle", "return_to_vendor", "liquidate"];

export default function AdminClaims() {
  const [claims, setClaims] = useState([]);
  const [losses, setLosses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [inspect, setInspect] = useState(null);
  const [condition, setCondition] = useState("good");
  const [disposition, setDisposition] = useState("dispose");
  const [disposalMethod, setDisposalMethod] = useState("trash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [c, l, p] = await Promise.all([
        base44.entities.Claim.list("-date_created", 500),
        base44.entities.ProfitLoss.list("-date", 500),
        base44.entities.Product.list(),
      ]);
      setClaims(c); setLosses(l); setProducts(p);
    } catch (e) { toast({ title: "Error", description: "Failed to load claims", variant: "destructive" }); }
    if (!silent) setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Claim", () => load(true), { intervalMs: 30000 });

  const totalLoss = losses.reduce((s, l) => s + (l.amount || 0), 0);
  const openCount = claims.filter(c => c.status === "open").length;
  const disposedCount = claims.filter(c => c.status === "disposed").length;

  const filtered = claims.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !((c.name || "").toLowerCase().includes(search.toLowerCase()) || (c.sku || "").includes(search))) return false;
    return true;
  });

  const openInspect = (c) => {
    setInspect(c);
    setCondition(c.condition && c.condition !== "pending" ? c.condition : "good");
    setDisposition(c.disposition && c.disposition !== "pending" ? c.disposition : "dispose");
    setDisposalMethod(c.disposal_method || "trash");
    setNotes(c.notes || "");
  };

  const saveInspect = async () => {
    if (!inspect) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let status = "inspected";
      if (disposition === "restock") status = "restocked";
      else if (disposition === "dispose") status = "disposed";
      else if (disposition === "ship_back") status = "shipped";

      await base44.entities.Claim.update(inspect.id, {
        condition, disposition, disposal_method: disposition === "dispose" ? disposalMethod : "", status, inspected_by: (JSON.parse(sessionStorage.getItem("admin_operator") || "{}")).full_name || "Admin", inspected_date: now, disposed_date: disposition === "dispose" ? now : null, notes,
      });

      if (disposition === "restock") {
        const prod = products.find(p => p.sku === inspect.sku);
        if (prod) await base44.entities.Product.update(prod.id, { stock_qty: (prod.stock_qty || 0) + (inspect.qty || 1) });
      }

      if (disposition === "dispose" && !inspect.profit_loss_recorded) {
        await base44.entities.ProfitLoss.create({
          date: now, type: "disposal", sku: inspect.sku, name: inspect.name, qty: inspect.qty, unit_cost: inspect.unit_cost, amount: inspect.total_cost, claim_id: inspect.id, disposal_method: disposalMethod, notes,
        });
        await base44.entities.Claim.update(inspect.id, { profit_loss_recorded: true });
      }

      toast({ title: "Claim Updated", description: `Marked as ${status.replace("_", " ")}` });
      setInspect(null); load(true);
    } catch (e) { toast({ title: "Error", description: "Failed to update claim", variant: "destructive" }); }
    setSaving(false);
  };

  const statusBadge = (s) => {
    const map = { open: "bg-amber-100 text-amber-700", inspected: "bg-blue-100 text-blue-700", restocked: "bg-emerald-100 text-emerald-700", disposed: "bg-red-100 text-red-700", shipped: "bg-purple-100 text-purple-700" };
    return map[s] || "bg-gray-100 text-gray-700";
  };

  if (loading) return <div className="flex items-center justify-center h-full p-10"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><PackageX className="w-7 h-7 text-red-600" /> Claims</h1>
        <p className="text-gray-500 text-sm mt-1">Items returned but not restockable. Inspect each item, choose a condition and disposition, and record disposals as profit loss.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><Inbox className="w-4 h-4 text-amber-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{openCount}</p><p className="text-[11px] text-gray-500">Pending Inspection</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><Trash2 className="w-4 h-4 text-red-500 mb-1" /><p className="text-2xl font-bold text-gray-900">{disposedCount}</p><p className="text-[11px] text-gray-500">Disposed</p></div>
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4"><TrendingDown className="w-4 h-4 text-red-500 mb-1" /><p className="text-2xl font-bold text-red-600">-${totalLoss.toFixed(2)}</p><p className="text-[11px] text-gray-500">Total Profit Loss (disposed cost)</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search claims by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="inspected">Inspected</SelectItem>
            <SelectItem value="restocked">Restocked</SelectItem>
            <SelectItem value="disposed">Disposed</SelectItem>
            <SelectItem value="shipped">Shipped Back</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Cost</th>
                <th className="px-3 py-3 text-left">Return Reason</th>
                <th className="px-3 py-3 text-left">Condition</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Date</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-gray-400 py-10">No claims found. Items sent to Claims from the POS returns flow will appear here.</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-3 text-gray-500">{c.sku}</td>
                  <td className="px-3 py-3 text-right">{c.qty}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-700">${(c.total_cost || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs">{c.reason || "—"}</td>
                  <td className="px-3 py-3 text-gray-500 text-xs capitalize">{c.condition && c.condition !== "pending" ? c.condition.replace("_", " ") : "—"}</td>
                  <td className="px-3 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge(c.status)}`}>{c.status}</span></td>
                  <td className="px-3 py-3 text-gray-400 text-xs">{c.date_created ? moment(c.date_created).format("MMM D") : "—"}</td>
                  <td className="px-3 py-3 text-right">
                    {c.status === "open" && <Button size="sm" variant="outline" onClick={() => openInspect(c)} className="text-xs"><Eye className="w-3.5 h-3.5 mr-1" /> Inspect</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!inspect} onOpenChange={v => { if (!v) setInspect(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Inspect Claim — {inspect?.name}</DialogTitle>
            <DialogDescription>{inspect?.qty} × {inspect?.sku} · Store cost ${(inspect?.total_cost || 0).toFixed(2)} · {inspect?.reason}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disposition</Label>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setDisposition("restock")} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${disposition === "restock" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 text-gray-500 hover:border-emerald-300"}`}>
                  <RotateCcw className="w-4 h-4" /><span className="text-xs font-medium">Restock</span>
                </button>
                <button onClick={() => setDisposition("dispose")} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${disposition === "dispose" ? "border-red-500 bg-red-50 text-red-700" : "border-gray-200 text-gray-500 hover:border-red-300"}`}>
                  <Trash2 className="w-4 h-4" /><span className="text-xs font-medium">Dispose</span>
                </button>
                <button onClick={() => setDisposition("ship_back")} className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${disposition === "ship_back" ? "border-purple-500 bg-purple-50 text-purple-700" : "border-gray-200 text-gray-500 hover:border-purple-300"}`}>
                  <Send className="w-4 h-4" /><span className="text-xs font-medium">Ship Back</span>
                </button>
              </div>
            </div>

            {disposition === "dispose" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                <div>
                  <Label>Disposal Method</Label>
                  <Select value={disposalMethod} onValueChange={setDisposalMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DISPOSAL_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-red-700 flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${inspect?.total_cost?.toFixed(2)} will be deducted from profit as a loss.</p>
              </div>
            )}
            {disposition === "restock" && <p className="text-xs text-emerald-700">Item will be added back to inventory stock.</p>}
            {disposition === "ship_back" && <p className="text-xs text-purple-700">Item will be shipped back to the vendor — no profit loss recorded.</p>}

            <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional inspection notes" /></div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setInspect(null)} className="flex-1">Cancel</Button>
              <Button onClick={saveInspect} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500">{saving ? "Saving..." : "Save Inspection"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}