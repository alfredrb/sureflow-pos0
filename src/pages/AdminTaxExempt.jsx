import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ShieldCheck, Plus, Search, Pencil, Eye, List, Power, Trash2, Printer, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const EXEMPTION_TYPES = [
  { value: "resale", label: "Resale" },
  { value: "government", label: "Government" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "agricultural", label: "Agricultural" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "other", label: "Other" },
];

const emptyForm = {
  entity_type: "business",
  name: "",
  contact_name: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  phone: "",
  email: "",
  tax_id_number: "",
  exemption_type: "resale",
  notes: "",
};

function genTaxExemptId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "TE-" + s;
}

export default function AdminTaxExempt() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [storeConfig, setStoreConfig] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [txDialog, setTxDialog] = useState(null);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, config] = await Promise.all([
        base44.entities.TaxExemptProfile.list("-issued_date", 200),
        base44.entities.ReceiptConfig.list(),
      ]);
      setProfiles(data);
      if (config.length > 0) setStoreConfig(config[0]);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load profiles", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("TaxExemptProfile", load, { intervalMs: 30000 });

  const filtered = profiles.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.tax_exempt_id?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.contact_name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.tax_id_number?.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      entity_type: p.entity_type || "business",
      name: p.name || "",
      contact_name: p.contact_name || "",
      address_street: p.address_street || "",
      address_city: p.address_city || "",
      address_state: p.address_state || "",
      address_zip: p.address_zip || "",
      phone: p.phone || "",
      email: p.email || "",
      tax_id_number: p.tax_id_number || "",
      exemption_type: p.exemption_type || "resale",
      notes: p.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.TaxExemptProfile.update(editing.id, { ...form });
        toast({ title: "Profile Updated", description: form.name });
        setFormOpen(false);
      } else {
        const taxExemptId = genTaxExemptId();
        const created = await base44.entities.TaxExemptProfile.create({
          ...form,
          tax_exempt_id: taxExemptId,
          status: "active",
          issued_date: new Date().toISOString(),
        });
        toast({ title: "Profile Created", description: `Tax Exempt ID: ${taxExemptId}` });
        setFormOpen(false);
        await load(true);
        setViewProfile({ ...created, ...form, tax_exempt_id: taxExemptId, status: "active", issued_date: new Date().toISOString() });
      }
      await load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save profile", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleStatus = async (p) => {
    const newStatus = p.status === "active" ? "disabled" : "active";
    await base44.entities.TaxExemptProfile.update(p.id, { status: newStatus });
    toast({ title: newStatus === "disabled" ? "Account Disabled" : "Account Enabled", description: p.name });
    load(true);
  };

  const removeProfile = async (p) => {
    await base44.entities.TaxExemptProfile.delete(p.id);
    toast({ title: "Profile Removed", description: `${p.name} (${p.tax_exempt_id})` });
    setViewProfile(null);
    load(true);
  };

  const viewTransactions = async (taxExemptId) => {
    setTxDialog({ id: taxExemptId, loading: true, results: [] });
    try {
      const results = await base44.entities.Transaction.filter({ tax_exempt_id: taxExemptId });
      setTxDialog({ id: taxExemptId, loading: false, results });
    } catch (e) {
      setTxDialog({ id: taxExemptId, loading: false, results: [], error: "Failed to load transactions" });
    }
  };

  const printCertificate = (p) => {
    const storeName = storeConfig?.store_name || "Supermart";
    const storeAddr = storeConfig?.store_address || "";
    const storePhone = storeConfig?.store_phone || "";
    const issued = moment(p.issued_date || new Date()).format("MMMM D, YYYY");
    const exemptionLabel = (p.exemption_type || "").charAt(0).toUpperCase() + (p.exemption_type || "").slice(1);
    const html = `<!doctype html><html><head><title>Tax Exempt Certificate — ${p.name}</title>
    <style>
      @page { margin: 1in; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; }
      .header { text-align:center; border-bottom: 3px double #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
      .title { font-size: 28px; font-weight: bold; letter-spacing: 1px; }
      .subtitle { font-size: 13px; color: #555; margin-top: 4px; }
      .store { font-size: 18px; font-weight: bold; }
      .grid { width: 100%; margin-top: 8px; }
      .row { display: flex; padding: 8px 0; border-bottom: 1px solid #ddd; font-size: 13px; }
      .lbl { width: 200px; font-weight: bold; color: #444; }
      .val { flex: 1; }
      .cert-id { text-align:center; margin: 28px 0; font-family: 'Courier New', monospace; font-size: 22px; letter-spacing: 3px; font-weight: bold; border: 2px solid #1a1a1a; padding: 14px; }
      .footer { margin-top: 40px; display:flex; justify-content: space-between; font-size: 12px; color:#555; }
      .sig { border-top: 1px solid #1a1a1a; width: 240px; text-align:center; padding-top:6px; }
      .note { font-size: 11px; color:#555; margin-top: 24px; line-height:1.5; }
    </style></head><body>
    <div class="header">
      <div class="title">CERTIFICATE OF TAX EXEMPTION</div>
      <div class="store">${storeName}</div>
      <div class="subtitle">${storeAddr}${storePhone ? " · " + storePhone : ""}</div>
    </div>
    <div class="cert-id">${p.tax_exempt_id}</div>
    <div class="grid">
      <div class="row"><div class="lbl">Account Holder</div><div class="val">${p.name || ""}</div></div>
      <div class="row"><div class="lbl">Entity Type</div><div class="val">${p.entity_type || ""}</div></div>
      <div class="row"><div class="lbl">Contact</div><div class="val">${p.contact_name || ""}</div></div>
      <div class="row"><div class="lbl">Address</div><div class="val">${p.address_street || ""}${p.address_city ? ", " + p.address_city : ""}${p.address_state ? ", " + p.address_state : ""} ${p.address_zip || ""}</div></div>
      <div class="row"><div class="lbl">Phone</div><div class="val">${p.phone || ""}</div></div>
      <div class="row"><div class="lbl">Email</div><div class="val">${p.email || ""}</div></div>
      <div class="row"><div class="lbl">Tax ID Number</div><div class="val">${p.tax_id_number || ""}</div></div>
      <div class="row"><div class="lbl">Exemption Type</div><div class="val">${exemptionLabel}</div></div>
      <div class="row"><div class="lbl">Date Issued</div><div class="val">${issued}</div></div>
      <div class="row"><div class="lbl">Status</div><div class="val">${(p.status || "active").toUpperCase()}</div></div>
    </div>
    ${p.notes ? `<div class="note"><strong>Notes:</strong> ${p.notes}</div>` : ""}
    <div class="footer">
      <div class="sig">Authorized Signature</div>
      <div class="sig">Date</div>
    </div>
    <p class="note">This certificate confirms that the account holder listed above is authorized to make tax-exempt purchases from ${storeName}. The Tax Exempt ID shown must be presented and verified at the point of sale before tax is removed. This document is issued and managed by ${storeName}.</p>
    </body></html>`;
    const win = window.open("", "_blank", "width=820,height=700");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-emerald-600" /> Tax Exempt Management</h1>
          <p className="text-gray-500 text-sm mt-1">Create and verify tax-exempt accounts. Tax is removed at the POS only after a valid Tax Exempt ID is confirmed.</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-500"><Plus className="w-4 h-4 mr-2" /> New Profile</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by ID, name, contact, email, or tax ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Tax Exempt ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Exemption</th>
                <th className="px-4 py-3 text-left">Issued</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400">No tax exempt profiles found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{p.tax_exempt_id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 flex items-center gap-1.5">
                      {p.entity_type === "business" ? <Building2 className="w-3.5 h-3.5 text-gray-400" /> : <User className="w-3.5 h-3.5 text-gray-400" />}
                      {p.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{p.contact_name}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.entity_type}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{p.exemption_type}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{moment(p.issued_date).format("MMM D, YYYY")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setViewProfile(p)} title="View" className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(p)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => viewTransactions(p.tax_exempt_id)} title="View Transactions" className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"><List className="w-4 h-4" /></button>
                      <button onClick={() => toggleStatus(p)} title={p.status === "active" ? "Disable" : "Enable"} className={`p-1.5 rounded-lg hover:bg-amber-50 ${p.status === "active" ? "text-gray-400 hover:text-amber-600" : "text-emerald-600"}`}><Power className="w-4 h-4" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button title="Remove" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remove tax exempt profile?</AlertDialogTitle>
                            <AlertDialogDescription>This permanently deletes <span className="font-medium">{p.name}</span> ({p.tax_exempt_id}). The Tax Exempt ID will no longer verify at the POS.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeProfile(p)}>Remove</AlertDialogAction>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Tax Exempt Profile" : "New Tax Exempt Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Entity Type</Label>
              <Select value={form.entity_type} onValueChange={v => setForm(f => ({ ...f, entity_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.entity_type === "business" ? "Business Name" : "Full Name"} *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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
              <div><Label>Tax ID Number (EIN/SSN)</Label><Input value={form.tax_id_number} onChange={e => setForm(f => ({ ...f, tax_id_number: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Exemption Type</Label>
              <Select value={form.exemption_type} onValueChange={v => setForm(f => ({ ...f, exemption_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXEMPTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2 text-sm" rows={2} /></div>
            {!editing && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">A unique Tax Exempt ID will be generated automatically when you save. You can print the certificate from the next screen.</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-500">{saving ? "Saving..." : editing ? "Save Changes" : "Create & Print"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewProfile} onOpenChange={v => { if (!v) setViewProfile(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tax Exempt Profile</DialogTitle></DialogHeader>
          {viewProfile && (
            <div className="space-y-3 text-sm">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider">Tax Exempt ID</p>
                <p className="font-mono text-lg font-bold text-gray-900">{viewProfile.tax_exempt_id}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${viewProfile.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>{viewProfile.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500 block text-xs">Name</span><span className="font-medium">{viewProfile.name}</span></div>
                <div><span className="text-gray-500 block text-xs">Entity Type</span><span className="font-medium capitalize">{viewProfile.entity_type}</span></div>
                <div><span className="text-gray-500 block text-xs">Contact</span><span className="font-medium">{viewProfile.contact_name || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Phone</span><span className="font-medium">{viewProfile.phone || "—"}</span></div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Address</span><span className="font-medium">{[viewProfile.address_street, viewProfile.address_city, viewProfile.address_state, viewProfile.address_zip].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Email</span><span className="font-medium">{viewProfile.email || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Tax ID Number</span><span className="font-medium">{viewProfile.tax_id_number || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Exemption Type</span><span className="font-medium capitalize">{viewProfile.exemption_type}</span></div>
                <div><span className="text-gray-500 block text-xs">Date Issued</span><span className="font-medium">{moment(viewProfile.issued_date).format("MMM D, YYYY")}</span></div>
              </div>
              {viewProfile.notes && <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">{viewProfile.notes}</div>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => viewTransactions(viewProfile.tax_exempt_id)} className="flex-1"><List className="w-4 h-4 mr-2" /> View Transactions</Button>
                <Button onClick={() => printCertificate(viewProfile)} className="flex-1 bg-emerald-600 hover:bg-emerald-500"><Printer className="w-4 h-4 mr-2" /> Print Certificate</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={!!txDialog} onOpenChange={v => { if (!v) setTxDialog(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transactions for {txDialog?.id}</DialogTitle></DialogHeader>
          {txDialog?.loading ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" /></div>
          ) : txDialog?.results?.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No transactions found for this Tax Exempt ID.</p>
          ) : (
            <div className="space-y-2">
              {txDialog?.results?.map(t => (
                <div key={t.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs font-medium text-gray-900">{t.transaction_id}</p>
                    <p className="text-xs text-gray-500">{t.operator_name} · {t.register_id} · {moment(t.created_date).format("MMM D, h:mm A")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${(t.total || 0).toFixed(2)}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.status === "completed" ? "bg-emerald-100 text-emerald-700" : t.status === "voided" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}