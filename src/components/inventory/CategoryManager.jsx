import React, { useState } from "react";
import { base44 } from "@/api/data";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const empty = { name: "", tax_rate: 0, description: "", color: "#6b7280" };

export default function CategoryManager({ categories, onChanged }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const { toast } = useToast();

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, tax_rate: c.tax_rate || 0, description: c.description || "", color: c.color || "#6b7280" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      if (editing) await base44.entities.Category.update(editing.id, form);
      else await base44.entities.Category.create(form);
      toast({ title: editing ? "Category updated" : "Category added" });
      setOpen(false); onChanged();
    } catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
  };

  const remove = async (c) => {
    if (!confirm(`Delete category "${c.name}"? This won't change items already using it.`)) return;
    await base44.entities.Category.delete(c.id);
    toast({ title: "Category deleted" }); onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500 max-w-2xl">Store-controlled categories. Set a default tax rate and details that apply to items grouped under each one.</p>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-right">Default Tax %</th>
                <th className="px-3 py-3 text-left">Details</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">No categories yet — add one to start organizing inventory.</td></tr>
              ) : categories.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: c.color || "#6b7280" }} />
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{c.tax_rate ?? 0}%</td>
                  <td className="px-3 py-3 text-gray-500">{c.description || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(c)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Category Name</label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grocery" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Default Tax Rate %</label><Input type="number" step="0.01" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })} /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Details</label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Notes about this category" /></div>
            <div><label className="text-sm font-medium text-gray-700 mb-1 block">Color</label><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-12 h-9 border border-gray-300 rounded-lg cursor-pointer bg-white" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Add"} Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}