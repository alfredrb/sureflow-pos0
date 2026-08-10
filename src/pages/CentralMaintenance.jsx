import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wrench, Plus, Loader2, Building2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const LOG_TYPES = [
  { value: "hardware_repair", label: "Hardware Repair" },
  { value: "software_update", label: "Software Update" },
  { value: "register_service", label: "Register Service" },
  { value: "preventive", label: "Preventive" },
  { value: "other", label: "Other" },
];

const STATUS_STYLES = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const emptyForm = {
  target_store: "all", log_type: "preventive", title: "", description: "",
  service_date: new Date().toISOString().split("T")[0], status: "scheduled", notes: "",
};

export default function CentralMaintenance() {
  const [logs, setLogs] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        base44.entities.MaintenanceLog.list("-created_date", 200),
        base44.entities.Store.list("store_number"),
      ]);
      setLogs(data.filter(l => l.sent_from_central));
      setStores(s);
    } catch (e) { toast({ title: "Load failed", variant: "destructive" }); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await base44.entities.MaintenanceLog.create({
        log_type: form.log_type,
        title: form.title,
        description: form.description,
        technician_name: "Central Admin",
        service_date: form.service_date,
        status: form.status,
        notes: form.notes,
        store_id: form.target_store === "all" ? "" : form.target_store,
        sent_from_central: true,
        updated_by: "Central Admin",
        updated_by_role: "central",
        updated_at: now,
      });
      toast({ title: "Maintenance notice sent", description: form.target_store === "all" ? "Broadcast to all stores" : `Sent to Store ${form.target_store}` });
      setDialogOpen(false); setForm(emptyForm); load();
    } catch (e) { toast({ title: "Send failed", variant: "destructive" }); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-full p-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading maintenance notices…</div>;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Radio className="w-6 h-6 text-indigo-600" /> Central Maintenance</h1>
          <p className="text-sm text-slate-500">Broadcast maintenance notices and service tasks to store locations.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-500"><Plus className="w-4 h-4 mr-2" /> Send Notice</Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
            <tr>
              <th className="text-left px-4 py-3">Service Date</th>
              <th className="text-left px-4 py-3">Target Store</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No central maintenance notices sent yet.</td></tr>}
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600 text-xs">{moment(l.service_date).format("MMM D, YYYY")}</td>
                <td className="px-4 py-3">
                  {l.store_id
                    ? <span className="inline-flex items-center gap-1 text-slate-700"><Building2 className="w-3.5 h-3.5 text-indigo-500" /> Store {l.store_id}</span>
                    : <span className="inline-flex items-center gap-1 text-indigo-600 font-medium"><Radio className="w-3.5 h-3.5" /> All Stores</span>}
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">{(l.log_type || "").replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{l.title}</p>
                  {l.notes && <p className="text-[11px] text-slate-400 truncate max-w-[260px]">{l.notes}</p>}
                </td>
                <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[l.status] || "bg-slate-100 text-slate-600"}`}>{(l.status || "").replace(/_/g, " ")}</span></td>
                <td className="px-4 py-3 text-[11px] text-slate-400">{moment(l.updated_at || l.created_date).format("MMM D, h:mm A")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Radio className="w-4 h-4 text-indigo-600" /> Send Maintenance Notice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Target Store</Label>
              <Select value={form.target_store} onValueChange={v => setForm(f => ({ ...f, target_store: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores (Broadcast)</SelectItem>
                  {stores.map(s => <SelectItem key={s.id} value={s.store_number}>Store {s.store_number} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Log Type</Label>
                <Select value={form.log_type} onValueChange={v => setForm(f => ({ ...f, log_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOG_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Printer firmware update required" /></div>
            <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Instructions for the store team" /></div>
            <div><Label className="text-xs">Service Date</Label><Input type="date" value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} /></div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleSend} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-500">{saving ? "Sending..." : "Send Notice"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}