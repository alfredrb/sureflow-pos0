import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const emptyDiscount = { name: "", percentage: 0, categories: [], active: true, start_date: "", end_date: "" };

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyDiscount });
  const { toast } = useToast();

  const load = async () => {
    const [discs, prods] = await Promise.all([
      base44.entities.DiscountType.list(),
      base44.entities.Product.list()
    ]);
    setDiscounts(discs);
    setProducts(prods);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const openNew = () => { setEditing(null); setForm({ ...emptyDiscount }); setDialogOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ name: d.name, percentage: d.percentage, categories: d.categories || [], active: d.active || true, start_date: d.start_date || "", end_date: d.end_date || "" }); setDialogOpen(true); };

  const save = async () => {
    try {
      if (!form.name || form.percentage <= 0) {
        toast({ title: "Error", description: "Name and percentage required", variant: "destructive" });
        return;
      }
      if (editing) { await base44.entities.DiscountType.update(editing.id, form); toast({ title: "Discount updated" }); }
      else { await base44.entities.DiscountType.create(form); toast({ title: "Discount created" }); }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const remove = async (d) => {
    if (!confirm(`Delete "${d.name}"?`)) return;
    await base44.entities.DiscountType.delete(d.id);
    toast({ title: "Discount deleted" });
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discount Types</h1>
          <p className="text-gray-500 text-sm mt-1">{discounts.length} discount rules</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Add Discount</Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-center">Discount %</th>
                <th className="px-3 py-3 text-left">Categories</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-left">Duration</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {discounts.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No discounts configured</td></tr>
              ) : discounts.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-900">{d.name}</td>
                  <td className="px-3 py-3 text-center font-bold text-green-600">{d.percentage}%</td>
                  <td className="px-3 py-3 text-sm text-gray-500">{d.categories?.length > 0 ? d.categories.join(", ") : "All"}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${d.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                      {d.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {d.start_date ? new Date(d.start_date).toLocaleDateString() : "—"} to {d.end_date ? new Date(d.end_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(d)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(d)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Discount" : "New Discount"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Discount Name (e.g., Rollback, Manager Special, Clearance)</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Manager Special" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Discount Percentage</label><Input type="number" min="0" max="100" step="0.5" value={form.percentage} onChange={e => setForm({ ...form, percentage: parseFloat(e.target.value) || 0 })} placeholder="e.g. 10" /> <p className="text-xs text-gray-400 mt-1">{form.percentage}% off selected categories</p></div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Apply to Categories</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {categories.length === 0 ? (
                  <p className="text-xs text-gray-500">No categories found. Create products with categories first.</p>
                ) : categories.map(cat => (
                  <label key={cat} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.categories.includes(cat)}
                      onChange={e => {
                        if (e.target.checked) setForm({ ...form, categories: [...form.categories, cat] });
                        else setForm({ ...form, categories: form.categories.filter(c => c !== cat) });
                      }}
                      className="w-4 h-4 border border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{cat}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Leave unchecked to apply to all categories</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1"><Calendar className="w-3 h-3" /> Start Date</label>
                <Input type="datetime-local" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1"><Calendar className="w-3 h-3" /> End Date</label>
                <Input type="datetime-local" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 border border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Create"} Discount</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}