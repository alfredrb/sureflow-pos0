import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Building2, Plus, Search, Pencil, Eye, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const emptyForm = {
  company_name: "",
  contact_name: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  phone: "",
  email: "",
  tax_id_number: "",
  category: "",
  notes: "",
};

function genCompanyId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "VEND-" + s;
}

export default function AdminVendorCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewCompany, setViewCompany] = useState(null);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.VendorCompany.list("-issued_date", 200);
      setCompanies(data);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load vendor companies", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("VendorCompany", load, { intervalMs: 30000 });

  const filtered = companies.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.company_id?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.category?.toLowerCase().includes(q);
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      company_name: c.company_name || "",
      contact_name: c.contact_name || "",
      address_street: c.address_street || "",
      address_city: c.address_city || "",
      address_state: c.address_state || "",
      address_zip: c.address_zip || "",
      phone: c.phone || "",
      email: c.email || "",
      tax_id_number: c.tax_id_number || "",
      category: c.category || "",
      notes: c.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) { toast({ title: "Company name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.VendorCompany.update(editing.id, { ...form });
        toast({ title: "Company Updated", description: form.company_name });
      } else {
        const companyId = genCompanyId();
        const created = await base44.entities.VendorCompany.create({
          ...form,
          company_id: companyId,
          status: "active",
          issued_date: new Date().toISOString(),
        });
        toast({ title: "Vendor Company Created", description: `Company ID: ${companyId}` });
        setViewCompany({ ...created, ...form, company_id: companyId, status: "active", issued_date: new Date().toISOString() });
      }
      setFormOpen(false);
      await load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save vendor company", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleStatus = async (c) => {
    const newStatus = c.status === "active" ? "disabled" : "active";
    await base44.entities.VendorCompany.update(c.id, { status: newStatus });
    toast({ title: newStatus === "disabled" ? "Company Disabled" : "Company Enabled", description: c.company_name });
    load(true);
  };

  const removeCompany = async (c) => {
    await base44.entities.VendorCompany.delete(c.id);
    toast({ title: "Company Removed", description: `${c.company_name} (${c.company_id})` });
    setViewCompany(null);
    load(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-7 h-7 text-teal-600" /> Vendor Companies</h1>
          <p className="text-gray-500 text-sm mt-1">Sign up and manage vendor company accounts. The generated Company ID ties vendor operators and inventory to their company.</p>
        </div>
        <Button onClick={openCreate} className="bg-teal-600 hover:bg-teal-500"><Plus className="w-4 h-4 mr-2" /> New Vendor Company</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by Company ID, name, contact, email, or category..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Company ID</th>
                <th className="px-4 py-3 text-left">Company Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400">No vendor companies registered yet</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{c.company_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-gray-400" /> {c.company_name}</p>
                    <p className="text-[11px] text-gray-400">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.contact_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{c.category || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{moment(c.issued_date).format("MMM D, YYYY")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setViewCompany(c)} title="View" className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => toggleStatus(c)} title={c.status === "active" ? "Disable" : "Enable"} className={`p-1.5 rounded-lg hover:bg-amber-50 ${c.status === "active" ? "text-gray-400 hover:text-amber-600" : "text-emerald-600"}`}><Power className="w-4 h-4" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button title="Remove" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remove vendor company?</AlertDialogTitle>
                            <AlertDialogDescription>This permanently deletes <span className="font-medium">{c.company_name}</span> ({c.company_id}). Vendor operators and inventory tied to this Company ID will remain but lose their company link.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeCompany(c)}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Vendor Company" : "New Vendor Company"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company Name *</Label>
              <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address_street} onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))} placeholder="Street" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} placeholder="City" />
              <Input value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value }))} placeholder="State" />
              <Input value={form.address_zip} onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))} placeholder="ZIP" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Tax ID Number (EIN)</Label><Input value={form.tax_id_number} onChange={e => setForm(f => ({ ...f, tax_id_number: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Grocery, Produce, Electronics" />
            </div>
            <div><Label>Notes</Label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2 text-sm" rows={2} /></div>
            {!editing && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">A unique Company ID will be generated automatically when you save. Use it when creating vendor operators and tagging inventory.</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-teal-600 hover:bg-teal-500">{saving ? "Saving..." : editing ? "Save Changes" : "Create Company"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewCompany} onOpenChange={v => { if (!v) setViewCompany(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vendor Company</DialogTitle></DialogHeader>
          {viewCompany && (
            <div className="space-y-3 text-sm">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                <p className="text-teal-700 text-[10px] font-bold uppercase tracking-wider">Company ID</p>
                <p className="font-mono text-lg font-bold text-gray-900">{viewCompany.company_id}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${viewCompany.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>{viewCompany.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500 block text-xs">Company Name</span><span className="font-medium">{viewCompany.company_name}</span></div>
                <div><span className="text-gray-500 block text-xs">Category</span><span className="font-medium">{viewCompany.category || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Contact</span><span className="font-medium">{viewCompany.contact_name || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Phone</span><span className="font-medium">{viewCompany.phone || "—"}</span></div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Address</span><span className="font-medium">{[viewCompany.address_street, viewCompany.address_city, viewCompany.address_state, viewCompany.address_zip].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Email</span><span className="font-medium">{viewCompany.email || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Tax ID Number</span><span className="font-medium">{viewCompany.tax_id_number || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Date Issued</span><span className="font-medium">{moment(viewCompany.issued_date).format("MMM D, YYYY")}</span></div>
              </div>
              {viewCompany.notes && <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">{viewCompany.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}