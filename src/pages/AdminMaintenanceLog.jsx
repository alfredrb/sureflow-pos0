import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Wrench, Plus, Pencil, Trash2, Search, Download, CheckCircle, Clock, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
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
  log_type: "hardware_repair", register_id: "", title: "", description: "",
  technician_name: "", service_date: new Date().toISOString().split("T")[0], status: "scheduled", parts_used: "", notes: "",
  replaced_device: "none", new_model: "", new_serial: "",
};

const DEVICE_FIELD_MAP = {
  printer: { model: "printer_model", serial: "printer_serial" },
  scanner: { model: "scanner_model", serial: "scanner_serial" },
  cash_drawer: { model: "cash_drawer_model", serial: "cash_drawer_serial" },
  terminal: { model: "terminal_model", serial: "terminal_serial" },
};

export default function AdminMaintenanceLog() {
  const [logs, setLogs] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [adminOperator, setAdminOperator] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_operator");
    if (stored) setAdminOperator(JSON.parse(stored));
  }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "null");
      const storeId = admin?.store_id || "";
      const [data, regs] = await Promise.all([
        base44.entities.MaintenanceLog.list("-service_date", 200),
        base44.entities.Register.list(),
      ]);
      const scoped = storeId ? data.filter(l => !l.store_id || l.store_id === storeId) : data;
      setLogs(scoped);
      setRegisters(regs);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load logs", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeSync("MaintenanceLog", load, { intervalMs: 30000 });

  const filtered = logs.filter(l => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return l.title?.toLowerCase().includes(q) || l.technician_name?.toLowerCase().includes(q) ||
      l.register_id?.toLowerCase().includes(q) || l.notes?.toLowerCase().includes(q);
  });

  const stats = {
    total: logs.length,
    scheduled: logs.filter(l => l.status === "scheduled").length,
    in_progress: logs.filter(l => l.status === "in_progress").length,
    completed: logs.filter(l => l.status === "completed").length,
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (l) => {
    setEditing(l);
    setForm({
      log_type: l.log_type || "hardware_repair", register_id: l.register_id || "", title: l.title || "",
      description: l.description || "", technician_name: l.technician_name || "",
      service_date: l.service_date || new Date().toISOString().split("T")[0], status: l.status || "scheduled",
      parts_used: l.parts_used || "", notes: l.notes || "",
      replaced_device: l.replaced_device || "none", new_model: l.new_model || "", new_serial: l.new_serial || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = {
        ...form,
        store_id: adminOperator?.store_id || "",
        completed_date: form.status === "completed" ? (form.completed_date || new Date().toISOString().split("T")[0]) : null,
        updated_by: adminOperator?.full_name || "Admin",
        updated_by_role: adminOperator?.role || "admin",
        updated_at: now,
      };
      if (editing) {
        await base44.entities.MaintenanceLog.update(editing.id, payload);
        toast({ title: "Log Updated" });
      } else {
        await base44.entities.MaintenanceLog.create(payload);
        toast({ title: "Log Created" });
      }
      // Auto-update the register record when a device is upgraded or replaced
      if (form.replaced_device && form.replaced_device !== "none" && form.register_id) {
        const fields = DEVICE_FIELD_MAP[form.replaced_device];
        if (fields) {
          const update = {};
          if (form.new_model.trim()) update[fields.model] = form.new_model.trim();
          if (form.new_serial.trim()) update[fields.serial] = form.new_serial.trim();
          if (Object.keys(update).length) {
            const reg = registers.find(r => r.register_id === form.register_id);
            if (reg) {
              await base44.entities.Register.update(reg.id, update);
              toast({ title: "Register Updated", description: `${form.replaced_device.replace("_", " ")} model/serial synced to register` });
            }
          }
        }
      }
      setFormOpen(false);
      load(true);
    } catch (e) { toast({ title: "Error", description: "Failed to save log", variant: "destructive" }); }
    setSaving(false);
  };

  const removeLog = async (l) => {
    await base44.entities.MaintenanceLog.delete(l.id);
    toast({ title: "Log Removed" });
    load(true);
  };

  const exportCSV = () => {
    const rows = [["Date", "Type", "Register", "Title", "Technician", "Status", "Parts", "Notes"]];
    filtered.forEach(l => rows.push([l.service_date || "", l.log_type || "", l.register_id || "", l.title || "", l.technician_name || "", l.status || "", l.parts_used || "", (l.notes || "").replace(/"/g, "'")]));
    const csv = rows.map(r => `"${r.map(c => String(c).replace(/"/g, '""')).join('","')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `maintenance_log_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="w-7 h-7 text-blue-600" /> Maintenance Log</h1>
          <p className="text-gray-500 text-sm mt-1">Track hardware repairs, software updates, and register service history.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Export</Button>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500"><Plus className="w-4 h-4 mr-2" /> New Entry</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Wrench, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Scheduled", value: stats.scheduled, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "In Progress", value: stats.in_progress, icon: Loader, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div><p className="text-xl font-bold text-gray-900">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search title, technician, register, notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Register</th>
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">Technician</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Updated By</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-gray-400">No maintenance logs found</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-600 text-xs">{moment(l.service_date).format("MMM D, YYYY")}</td>
                  <td className="px-4 py-3 capitalize text-gray-600">{(l.log_type || "").replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{l.register_id || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 flex items-center gap-1.5">
                      {l.title}
                      {l.sent_from_central && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Central</span>}
                    </p>
                    {l.notes && <p className="text-[11px] text-gray-400 truncate max-w-[260px]">{l.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.technician_name || "—"}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[l.status] || "bg-gray-100 text-gray-600"}`}>{(l.status || "").replace(/_/g, " ")}</span></td>
                  <td className="px-4 py-3">
                    {l.updated_by ? (
                      <div>
                        <p className="text-xs text-gray-700">{l.updated_by}</p>
                        <p className="text-[11px] text-gray-400">{moment(l.updated_at).format("MMM D, h:mm A")}</p>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(l)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete maintenance log?</AlertDialogTitle>
                            <AlertDialogDescription>This permanently removes the entry for "{l.title}".</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removeLog(l)}>Delete</AlertDialogAction>
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

      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Maintenance Entry" : "New Maintenance Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Log Type</Label>
                <Select value={form.log_type} onValueChange={v => setForm(f => ({ ...f, log_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOG_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Register</Label>
                <Select value={form.register_id || "__none"} onValueChange={v => setForm(f => ({ ...f, register_id: v === "__none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— None —</SelectItem>
                    {registers.map(r => <SelectItem key={r.id} value={r.register_id}>{r.register_id}{r.name ? ` · ${r.name}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of work" /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What was done / what needs doing" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Technician</Label><Input value={form.technician_name} onChange={e => setForm(f => ({ ...f, technician_name: e.target.value }))} /></div>
              <div><Label>Service Date</Label><Input type="date" value={form.service_date} onChange={e => setForm(f => ({ ...f, service_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Parts Used</Label><Input value={form.parts_used} onChange={e => setForm(f => ({ ...f, parts_used: e.target.value }))} placeholder="e.g. drawer latch, cable" /></div>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Hardware Upgrade / Replacement</p>
              <p className="text-[11px] text-gray-400 mb-2">If a device is upgraded or replaced, enter the new details — the register record updates automatically on save.</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Replaced Device</Label>
                  <Select value={form.replaced_device} onValueChange={v => setForm(f => ({ ...f, replaced_device: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="printer">Printer</SelectItem>
                      <SelectItem value="scanner">Scanner</SelectItem>
                      <SelectItem value="cash_drawer">Cash Drawer</SelectItem>
                      <SelectItem value="terminal">Terminal / Computer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>New Model</Label><Input value={form.new_model} onChange={e => setForm(f => ({ ...f, new_model: e.target.value }))} disabled={form.replaced_device === "none"} placeholder="New model" /></div>
                <div><Label>New Serial Number</Label><Input value={form.new_serial} onChange={e => setForm(f => ({ ...f, new_serial: e.target.value }))} disabled={form.replaced_device === "none"} placeholder="New serial" className="font-mono text-sm" /></div>
              </div>
            </div>
            <div><Label>Technician Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Resolution details, follow-ups, observations" /></div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-500">{saving ? "Saving..." : editing ? "Save Changes" : "Create Entry"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}