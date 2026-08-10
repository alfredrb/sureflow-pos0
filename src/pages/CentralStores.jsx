import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, Search, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const empty = { store_number: "", name: "", address_street: "", address_city: "", address_state: "", address_zip: "", phone: "", email: "", region: "", manager_name: "", status: "active", opened_date: "", notes: "" };

export default function CentralStores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...empty });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { setStores(await base44.entities.Store.list("store_number")); } catch (e) { toast({ title: "Load failed", variant: "destructive" }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm({ ...empty }); setDialogOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s }); setDialogOpen(true); };

  const save = async () => {
    if (!form.store_number || !form.name) { toast({ title: "Store number and name required", variant: "destructive" }); return; }
    try {
      if (editing) { await base44.entities.Store.update(editing.id, form); toast({ title: "Store updated" }); }
      else { await base44.entities.Store.create(form); toast({ title: "Store added" }); }
      setDialogOpen(false); load();
    } catch (e) { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const remove = async (s) => {
    if (!confirm(`Delete store ${s.store_number} — ${s.name}? Records tied to it will become unassigned.`)) return;
    await base44.entities.Store.delete(s.id);
    toast({ title: "Store deleted" }); load();
  };

  const filtered = stores.filter(s => !search || s.store_number?.includes(search) || s.name?.toLowerCase().includes(search.toLowerCase()) || (s.region || "").toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading stores…</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stores</h1>
          <p className="text-sm text-slate-500">{stores.length} stores across the network</p>
        </div>
        <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-500"><Plus className="w-4 h-4 mr-2" /> Add Store</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search by number, name, region…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Store</th>
              <th className="text-left px-4 py-3">Region</th>
              <th className="text-left px-4 py-3">Manager</th>
              <th className="text-left px-4 py-3">Location</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No stores found.</td></tr>}
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-semibold text-slate-700">{s.store_number}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-3 text-slate-500">{s.region || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{s.manager_name || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{[s.address_city, s.address_state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{s.status || "active"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => remove(s)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-600" /> {editing ? "Edit Store" : "New Store"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Store Number *</Label><Input value={form.store_number} onChange={e => setForm({ ...form, store_number: e.target.value })} placeholder="001" /></div>
              <div><Label className="text-xs">Region</Label><Input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} placeholder="Northeast" /></div>
            </div>
            <div><Label className="text-xs">Store Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Manager Name</Label><Input value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} /></div>
            <div><Label className="text-xs">Street Address</Label><Input value={form.address_street} onChange={e => setForm({ ...form, address_street: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label className="text-xs">City</Label><Input value={form.address_city} onChange={e => setForm({ ...form, address_city: e.target.value })} /></div>
              <div><Label className="text-xs">State</Label><Input value={form.address_state} onChange={e => setForm({ ...form, address_state: e.target.value })} /></div>
              <div><Label className="text-xs">Zip</Label><Input value={form.address_zip} onChange={e => setForm({ ...form, address_zip: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="text-xs">Opened Date</Label><Input type="date" value={form.opened_date || ""} onChange={e => setForm({ ...form, opened_date: e.target.value })} /></div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-500">{editing ? "Update" : "Add"} Store</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}