import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Plus, Edit2, Trash2, Search, AlertTriangle, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const emptyProduct = { sku: "", name: "", price: 0, cost: 0, category: "", barcode: "", stock_qty: 0, tax_rate: 0, status: "active", return_period_days: "" };

const exportToCSV = (data, filename) => {
  const keys = ["sku", "name", "price", "cost", "category", "barcode", "stock_qty", "tax_rate", "status", "return_period_days"];
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

const importFromCSV = async (file, onImport) => {
  const text = await file.text();
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.replace(/"/g, ""));
  const rows = lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v.replace(/"/g, ""));
    return headers.reduce((obj, h, i) => {
      let val = values[i] ?? "";
      if (h === "price" || h === "cost" || h === "tax_rate") val = parseFloat(val) || 0;
      if (h === "stock_qty" || h === "return_period_days") val = val === "" ? (h === "return_period_days" ? "" : 0) : parseInt(val) || 0;
      obj[h] = val;
      return obj;
    }, {});
  });
  await Promise.all(rows.map(p => base44.entities.Product.create(p)));
  onImport();
};

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const { toast } = useToast();

  const load = async () => { setProducts(await base44.entities.Product.list()); setLoading(false); };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Product", load, { intervalMs: 20000 });

  const openNew = () => { setEditing(null); setForm({ ...emptyProduct }); setDialogOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ sku: p.sku, name: p.name, price: p.price, cost: p.cost || 0, category: p.category || "", barcode: p.barcode || "", stock_qty: p.stock_qty || 0, tax_rate: p.tax_rate || 0, status: p.status || "active", return_period_days: p.return_period_days ?? "" }); setDialogOpen(true); };

  const save = async () => {
    try {
      if (editing) { await base44.entities.Product.update(editing.id, form); toast({ title: "Product updated" }); }
      else { await base44.entities.Product.create(form); toast({ title: "Product added" }); }
      setDialogOpen(false); load();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const remove = async (p) => {
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => exportToCSV(products, "inventory.csv")} variant="outline" className="border-gray-300"><Download className="w-4 h-4 mr-2" /> Export</Button>
          <label>
            <input type="file" accept=".csv" onChange={e => {
              if (e.target.files?.[0]) {
                importFromCSV(e.target.files[0], () => {
                  toast({ title: "Import complete" });
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
                <th className="px-3 py-3 text-right">Price</th>
                <th className="px-3 py-3 text-right">Cost</th>
                <th className="px-3 py-3 text-right">Stock</th>
                <th className="px-3 py-3 text-right">Tax %</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{p.sku}</td>
                  <td className="px-3 py-3 text-gray-500">{p.category || "—"}</td>
                  <td className="px-3 py-3 text-right font-medium">${p.price.toFixed(2)}</td>
                  <td className="px-3 py-3 text-right text-gray-500">${(p.cost || 0).toFixed(2)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={`inline-flex items-center gap-1 ${(p.stock_qty || 0) < 10 ? "text-red-600 font-semibold" : "text-gray-700"}`}>
                      {(p.stock_qty || 0) < 10 && <AlertTriangle className="w-3 h-3" />}
                      {p.stock_qty || 0}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-500">{p.tax_rate || 0}%</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(p)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
              <label className="text-sm font-medium text-gray-700 mb-1 block">Return Period (days)</label>
              <Input type="number" min="0" placeholder="e.g. 30 — leave blank for no restriction" value={form.return_period_days} onChange={e => setForm({ ...form, return_period_days: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })} />
              <p className="text-xs text-gray-400 mt-1">Returns past this many days will require a supervisor override.</p>
            </div>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Product</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}