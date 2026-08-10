import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Award, Plus, Search, Pencil, Eye, List, Power, Trash2, Coins } from "lucide-react";
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
  name: "", phone: "", email: "", address_street: "", address_city: "", address_state: "", address_zip: "", notes: ""
};

function genLoyaltyId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return "LY-" + s;
}

export default function AdminLoyaltyMembers() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewMember, setViewMember] = useState(null);
  const [adjustOpen, setAdjustOpen] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [txDialog, setTxDialog] = useState(null);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await base44.entities.LoyaltyMember.list("-enrolled_date", 200);
      setMembers(data);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("LoyaltyMember", load, { intervalMs: 30000 });

  const filtered = members.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.loyalty_id?.toLowerCase().includes(q) ||
      m.name?.toLowerCase().includes(q) ||
      m.phone?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q);
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ name: m.name || "", phone: m.phone || "", email: m.email || "", address_street: m.address_street || "", address_city: m.address_city || "", address_state: m.address_state || "", address_zip: m.address_zip || "", notes: m.notes || "" });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.LoyaltyMember.update(editing.id, { ...form });
        toast({ title: "Member Updated", description: form.name });
      } else {
        const loyalty_id = genLoyaltyId();
        const created = await base44.entities.LoyaltyMember.create({
          ...form, loyalty_id, rewards_balance: 0, lifetime_points: 0, status: "active",
          enrolled_date: new Date().toISOString()
        });
        toast({ title: "Member Created", description: `Loyalty ID: ${loyalty_id}` });
        setViewMember(created);
      }
      setFormOpen(false);
      await load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save member", variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleStatus = async (m) => {
    const newStatus = m.status === "active" ? "disabled" : "active";
    await base44.entities.LoyaltyMember.update(m.id, { status: newStatus });
    toast({ title: newStatus === "disabled" ? "Member Disabled" : "Member Enabled", description: m.name });
    load(true);
  };

  const removeMember = async (m) => {
    await base44.entities.LoyaltyMember.delete(m.id);
    toast({ title: "Member Removed", description: `${m.name} (${m.loyalty_id})` });
    setViewMember(null);
    load(true);
  };

  const adjustBalance = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    const m = adjustOpen;
    const newBalance = Math.max(0, +(m.rewards_balance + amt).toFixed(2));
    const newLifetime = +(m.lifetime_points + Math.max(0, amt)).toFixed(2);
    await base44.entities.LoyaltyMember.update(m.id, { rewards_balance: newBalance, lifetime_points: newLifetime });
    toast({ title: "Balance Adjusted", description: `${amt > 0 ? "+" : ""}$${amt.toFixed(2)} → $${newBalance.toFixed(2)}` });
    setAdjustOpen(null); setAdjustAmount(""); setAdjustNote("");
    load(true);
    if (viewMember?.id === m.id) setViewMember({ ...m, rewards_balance: newBalance, lifetime_points: newLifetime });
  };

  const viewTransactions = async (loyaltyId) => {
    setTxDialog({ id: loyaltyId, loading: true, results: [] });
    try {
      const results = await base44.entities.Transaction.filter({ loyalty_id: loyaltyId });
      setTxDialog({ id: loyaltyId, loading: false, results });
    } catch (e) {
      setTxDialog({ id: loyaltyId, loading: false, results: [], error: "Failed to load transactions" });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Award className="w-7 h-7 text-sky-600" /> Loyalty Program</h1>
          <p className="text-gray-500 text-sm mt-1">Enroll customers, manage rewards balances, and review member purchase history.</p>
        </div>
        <Button onClick={openCreate} className="bg-sky-600 hover:bg-sky-500"><Plus className="w-4 h-4 mr-2" /> New Member</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search by ID, name, phone, or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Loyalty ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-right">Rewards Balance</th>
                <th className="px-4 py-3 text-left">Enrolled</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-gray-400">No loyalty members found</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-gray-900">{m.loyalty_id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    <p>{m.phone || "—"}</p>
                    <p className="text-gray-400">{m.email || ""}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-sky-700">${(m.rewards_balance || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.enrolled_date ? moment(m.enrolled_date).format("MMM D, YYYY") : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${m.status === "active" ? "bg-sky-100 text-sky-700" : "bg-gray-200 text-gray-600"}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setViewMember(m)} title="View" className="p-1.5 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setAdjustOpen(m); setAdjustAmount(""); }} title="Adjust Balance" className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"><Coins className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(m)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => viewTransactions(m.loyalty_id)} title="View Transactions" className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"><List className="w-4 h-4" /></button>
                      <button onClick={() => toggleStatus(m)} title={m.status === "active" ? "Disable" : "Enable"} className={`p-1.5 rounded-lg hover:bg-amber-50 ${m.status === "active" ? "text-gray-400 hover:text-amber-600" : "text-sky-600"}`}><Power className="w-4 h-4" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button title="Remove" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remove loyalty member?</AlertDialogTitle>
                            <AlertDialogDescription>This permanently deletes <span className="font-medium">{m.name}</span> ({m.loyalty_id}). Their rewards balance will be lost.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeMember(m)}>Remove</AlertDialogAction>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Loyalty Member" : "New Loyalty Member"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address_street} onChange={e => setForm(f => ({ ...f, address_street: e.target.value }))} placeholder="Street" /></div>
            <div className="grid grid-cols-3 gap-3">
              <Input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} placeholder="City" />
              <Input value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value }))} placeholder="State" />
              <Input value={form.address_zip} onChange={e => setForm(f => ({ ...f, address_zip: e.target.value }))} placeholder="ZIP" />
            </div>
            <div><Label>Notes</Label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-input px-3 py-2 text-sm" rows={2} /></div>
            {!editing && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">A unique Loyalty ID will be generated automatically when you save.</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-sky-600 hover:bg-sky-500">{saving ? "Saving..." : editing ? "Save Changes" : "Create Member"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewMember} onOpenChange={v => { if (!v) setViewMember(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Loyalty Member</DialogTitle></DialogHeader>
          {viewMember && (
            <div className="space-y-3 text-sm">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-center">
                <p className="text-sky-700 text-[10px] font-bold uppercase tracking-wider">Loyalty ID</p>
                <p className="font-mono text-lg font-bold text-gray-900">{viewMember.loyalty_id}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${viewMember.status === "active" ? "bg-sky-100 text-sky-700" : "bg-gray-200 text-gray-600"}`}>{viewMember.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500 block text-xs">Name</span><span className="font-medium">{viewMember.name}</span></div>
                <div><span className="text-gray-500 block text-xs">Phone</span><span className="font-medium">{viewMember.phone || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Email</span><span className="font-medium">{viewMember.email || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Enrolled</span><span className="font-medium">{viewMember.enrolled_date ? moment(viewMember.enrolled_date).format("MMM D, YYYY") : "—"}</span></div>
                <div className="col-span-2"><span className="text-gray-500 block text-xs">Address</span><span className="font-medium">{[viewMember.address_street, viewMember.address_city, viewMember.address_state, viewMember.address_zip].filter(Boolean).join(", ") || "—"}</span></div>
                <div><span className="text-gray-500 block text-xs">Rewards Balance</span><span className="font-bold text-sky-700">${(viewMember.rewards_balance || 0).toFixed(2)}</span></div>
                <div><span className="text-gray-500 block text-xs">Lifetime Earned</span><span className="font-medium">${(viewMember.lifetime_points || 0).toFixed(2)}</span></div>
              </div>
              {viewMember.notes && <div className="bg-gray-50 rounded-lg p-2 text-xs text-gray-600">{viewMember.notes}</div>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => viewTransactions(viewMember.loyalty_id)} className="flex-1"><List className="w-4 h-4 mr-2" /> View Transactions</Button>
                <Button onClick={() => { setAdjustOpen(viewMember); setAdjustAmount(""); }} className="flex-1 bg-amber-600 hover:bg-amber-500"><Coins className="w-4 h-4 mr-2" /> Adjust Balance</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={!!adjustOpen} onOpenChange={v => { if (!v) setAdjustOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Rewards Balance</DialogTitle></DialogHeader>
          {adjustOpen && (
            <div className="space-y-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">{adjustOpen.name} · {adjustOpen.loyalty_id}</p>
                <p className="font-bold text-gray-900">Current Balance: ${(adjustOpen.rewards_balance || 0).toFixed(2)}</p>
              </div>
              <div>
                <Label>Adjustment Amount (use + to add, − to subtract)</Label>
                <Input type="number" step="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="e.g. 5.00 or -2.50" autoFocus />
              </div>
              <div><Label>Note</Label><Input value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="Reason for adjustment" /></div>
              <Button onClick={adjustBalance} className="w-full bg-amber-600 hover:bg-amber-500">Apply Adjustment</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={!!txDialog} onOpenChange={v => { if (!v) setTxDialog(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transactions for {txDialog?.id}</DialogTitle></DialogHeader>
          {txDialog?.loading ? (
            <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" /></div>
          ) : txDialog?.results?.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No transactions found for this member.</p>
          ) : (
            <div className="space-y-2">
              {txDialog?.results?.map(t => (
                <div key={t.id} className="border border-gray-100 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-xs font-medium text-gray-900">{t.transaction_id}</p>
                    <p className="text-xs text-gray-500">{t.operator_name} · {t.register_id} · {moment(t.created_date).format("MMM D, h:mm A")}</p>
                    <p className="text-[10px] text-sky-600">Earned ${(t.rewards_earned || 0).toFixed(2)} · Applied ${(t.rewards_applied || 0).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">${(t.total || 0).toFixed(2)}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{t.status}</span>
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