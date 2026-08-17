import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Plus, Edit2, Trash2, Search, AlertTriangle, Download, Upload, Tag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const emptyProduct = { sku: "", name: "", price: 0, cost: 0, category: "", barcode: "", stock_qty: 0, tax_rate: 0, status: "active", return_period_days: "", vendor_company_id: "", recalled: false, recall_reason: "", promotional: false, release_date: "" };

const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const exportToCSV = (data, filename) => {
  const keys = ["sku", "name", "price", "cost", "category", "barcode", "stock_qty", "tax_rate", "status", "return_period_days", "vendor_company_id", "recalled", "recall_reason", "promotional", "release_date"];
  const csv = [keys.join(","), ...data.map(p => keys.map(k => {
    const val = p[k] ?? "";
    return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
  }).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

const parseCSV = (text) => {
  const lines = text.trim().split("\n");
  const splitLine = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.replace(/^"|"$/g, ""));
  const headers = splitLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = splitLine(line);
    return headers.reduce((obj, h, i) => {
      let val = values[i] ?? "";
      if (["price", "cost", "tax_rate"].includes(h)) val = parseFloat(val) || 0;
      else if (h === "stock_qty") val = val === "" ? 0 : parseInt(val) || 0;
      else if (h === "return_period_days") val = val === "" ? "" : parseInt(val) || 0;
      else if (h === "recalled" || h === "promotional") val = val === "true";
      obj[h] = val;
      return obj;
    }, {});
  });
};

// Upsert by SKU: existing products are updated in place, new SKUs are created.
const importFromCSV = async (file, opts, onDone) => {
  const { isVendor, vendorCompanyId } = opts || {};
  const rows = parseCSV(await file.text());
  const existing = await base44.entities.Product.list();
  const bySku = {};
  existing.forEach(p => { if (p.sku) (bySku[p.sku] ||= []).push(p); });
  let created = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    if (!row.sku) { skipped++; continue; }
    if (isVendor) row.vendor_company_id = vendorCompanyId;
    const matches = bySku[row.sku] || [];
    const own = isVendor ? matches.find(p => (p.vendor_company_id || "") === vendorCompanyId) : matches[0];
    // Vendors cannot overwrite another company's product — skip those rows.
    if (isVendor && matches.length && !own) { skipped++; continue; }
    if (own) { await base44.entities.Product.update(own.id, row); updated++; }
    else { await base44.entities.Product.create(row); created++; }
  }
  onDone?.({ created, updated, skipped });
};

export default function AdminInventory() {
  const operator = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch { return null; } })();
  const isVendor = operator?.role === "vendor";
  const vendorCompanyId = operator?.company_id || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [companies, setCompanies] = useState([]);
  const { toast } = useToast();

  useEffect(() => { base44.entities.VendorCompany.list("-issued_date", 500).then(setCompanies).catch(() => {}); }, []);

  const load = async () => {
    let prods = await base44.entities.Product.list();
    if (isVendor) prods = prods.filter(p => (p.vendor_company_id || "") === vendorCompanyId);
    setProducts(prods);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Product", load, { intervalMs: 20000 });

  const openNew = () => { setEditing(null); setForm({ ...emptyProduct, vendor_company_id: isVendor ? vendorCompanyId : "" }); setDialogOpen(true); };
  const openEdit = (p) => {
    if (isVendor && (p.vendor_company_id || "") !== vendorCompanyId) { toast({ title: "Access denied", description: "You can only edit your own inventory", variant: "destructive" }); return; }
    setEditing(p);
    setForm({ sku: p.sku, name: p.name, price: p.price, cost: p.cost || 0, category: p.category || "", barcode: p.barcode || "", stock_qty: p.stock_qty || 0, tax_rate: p.tax_rate || 0, status: p.status || "active", return_period_days: p.return_period_days ?? "", vendor_company_id: p.vendor_company_id || "", recalled: !!p.recalled, recall_reason: p.recall_reason || "", promotional: !!p.promotional, release_date: toLocalInput(p.release_date) });
    setDialogOpen(true);
  };

  const save = async () => {
    try {
      const payload = { ...form };
      if (isVendor) payload.vendor_company_id = vendorCompanyId;
      // Backend rejects empty strings for number/date fields — drop them so they're left unset.
      if (payload.return_period_days === "") delete payload.return_period_days;
      if (payload.release_date === "") delete payload.release_date;
      if (editing) {
        if (isVendor && (editing.vendor_company_id || "") !== vendorCompanyId) { toast({ title: "Access denied", variant: "destructive" }); return; }
        await base44.entities.Product.update(editing.id, payload);
        toast({ title: "Product updated" });
      } else {
        await base44.entities.Product.create(payload);
        toast({ title: "Product added" });
      }
      setDialogOpen(false); load();
    } catch (e) {
      toast({ title: "Error saving product", description: e?.message || "Please check the fields and try again.", variant: "destructive" });
    }
  };

  const remove = async (p) => {
    if (isVendor && (p.vendor_company_id || "") !== vendorCompanyId) { toast({ title: "Access denied", variant: "destructive" }); return; }
    if (!confirm(`Delete ${p.name}?`)) return;
    await base44.entities.Product.delete(p.id);
    toast({ title: "Product deleted" }); load();
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search) || (p.barcode || "").includes(search));

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory{isVendor && vendorCompanyId ? ` — ${vendorCompanyId}` : ""}</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} products{isVendor ? " (your catalog)" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportToCSV(products, "inventory.csv")} variant="outline" className="border-gray-300"><Download className="w-4 h-4 mr-2" /> Export</Button>
          <label>
            <input type="file" accept=".csv" onChange={e => {
              if (e.target.files?.[0]) {
                importFromCSV(e.target.files[0], { isVendor, vendorCompanyId }, ({ created, updated, skipped }) => {
                  toast({ title: "Import complete", description: `${created} added, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}` });
                  load();
                }).catch(() => toast({ title: "Import failed", variant: "destructive" }));
              }
            }} hidden />
            <Button asChild variant="outline" className="border-gray-300 cursor-pointer"><span><Upload className="w-4 h-4 mr-2" /> Import</span></Button>
          </label>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by name, SKU, or barcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Product</th>
                <th className="px-3 py-3 text-left">SKU</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-left">Vendor</th>
                <th className="px-3 py-3 text-right">Price</th>
                <th className="px-3 py-3 text-right">Stock</th>
                <th className="px-3 py-3 text-left">Flags</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const released = !p.release_date || new Date(p.release_date) <= new Date();
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{p.sku}</td>
                    <td className="px-3 py-3 text-gray-500">{p.category || "—"}</td>
                    <td className="px-3 py-3 text-gray-500">{(() => { const c = companies.find(x => x.company_id === p.vendor_company_id); return c ? c.company_name : (p.vendor_company_id || "—"); })()}</td>
                    <td className="px-3 py-3 text-right font-medium">${p.price.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center gap-1 ${(p.stock_qty || 0) < 10 ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                        {(p.stock_qty || 0) < 10 && <AlertTriangle className="w-3 h-3" />}
                        {p.stock_qty || 0}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.recalled && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Recalled</span>}
                        {p.promotional && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700"><Tag className="w-3 h-3" />Promo</span>}
                        {p.release_date && !released && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" />Release {new Date(p.release_date).toLocaleDateString()}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => remove(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">SKU</label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Barcode</label><Input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Product Name</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Category</label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Price</label><Input type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Cost</label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Stock Qty</label><Input type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: parseInt(e.target.value) || 0 })} /></div>
              <div><label className="text-sm font-medium text-gray-700 mb-1 block">Tax Rate %</label><Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Vendor Company</label>
              <select
                value={form.vendor_company_id}
                onChange={e => setForm({ ...form, vendor_company_id: e.target.value })}
                disabled={isVendor}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">None (store-owned)</option>
                {companies.map(c => <option key={c.id} value={c.company_id}>{c.company_id} — {c.company_name}</option>)}
              </select>
              {isVendor && <p className="text-xs text-gray-400 mt-1">Locked to your company ({vendorCompanyId}).</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Return Period (days)</label>
              <Input type="number" min="0" placeholder="e.g. 30 — leave blank for no restriction" value={form.return_period_days} onChange={e => setForm({ ...form, return_period_days: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Returns past this many days will require a supervisor override.</p>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sale Controls</p>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Recalled</p>
                  <p className="text-xs text-gray-400">Blocks sale at the POS — instructs cashier to give item to manager.</p>
                </div>
                <Switch checked={!!form.recalled} onCheckedChange={v => setForm({ ...form, recalled: v })} />
              </div>
              {form.recalled && (
                <div><label className="text-sm font-medium text-gray-700 mb-1 block">Recall Reason</label><Input value={form.recall_reason} onChange={e => setForm({ ...form, recall_reason: e.target.value })} placeholder="e.g. Contamination reported 2026-08-01" /></div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-indigo-500" /> Promotional</p>
                  <p className="text-xs text-gray-400">Flags this item as part of a promotional program.</p>
                </div>
                <Switch checked={!!form.promotional} onCheckedChange={v => setForm({ ...form, promotional: v })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-amber-500" /> Release Date / Time</label>
                <Input type="datetime-local" value={form.release_date} onChange={e => setForm({ ...form, release_date: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Item cannot be sold until this date/time. Leave blank for no restriction.</p>
              </div>
            </div>

            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Product</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}