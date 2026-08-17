import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Trash2, CheckCircle2, Pencil, ListTodo, AlertTriangle } from "lucide-react";
import moment from "moment";

const SEVERITY = {
  low: { label: "Low", cls: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
  medium: { label: "Medium", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  high: { label: "High", cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  critical: { label: "Critical", cls: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

const STATUS = {
  pending: { label: "Pending", cls: "bg-gray-100 text-gray-700" },
  in_progress: { label: "In Progress", cls: "bg-blue-100 text-blue-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-500 line-through" },
};

const empty = { title: "", description: "", assigned_to: "", assigned_operator_id: "", due_date: moment().add(2, "days").format("YYYY-MM-DD"), severity: "medium", status: "pending", notes: "" };

export default function TasksPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [supervisors, setSupervisors] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.LPTask.list("-due_date", 200);
      setItems(data);
    } catch { toast({ title: "Failed to load tasks", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    base44.entities.Operator.list().then(list => setSupervisors(list.filter(o => o.status !== "inactive" && (o.role === "csm" || o.role === "manager")))).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return items.filter(t => {
      if (statusFilter === "open" && (t.status === "completed" || t.status === "cancelled")) return false;
      if (statusFilter !== "open" && statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (t.title || "").toLowerCase().includes(q) || (t.assigned_to || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, statusFilter, search]);

  const overdue = (t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && moment(t.due_date).isBefore(moment().startOf("day"));

  const openNew = () => { setForm(empty); setEditing({ __new: true }); };
  const openEdit = (t) => { setForm({ ...empty, ...t }); setEditing(t); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!form.due_date) { toast({ title: "Due date is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description,
        assigned_to: form.assigned_to,
        assigned_operator_id: form.assigned_operator_id,
        due_date: form.due_date,
        severity: form.severity,
        status: form.status,
        notes: form.notes,
        investigation_id: form.investigation_id || "",
        investigation_title: form.investigation_title || "",
        completed_at: form.status === "completed" && !form.completed_at ? new Date().toISOString() : form.completed_at || "",
      };
      if (editing?.__new) await base44.entities.LPTask.create(payload);
      else await base44.entities.LPTask.update(editing.id, payload);
      toast({ title: editing?.__new ? "Task created" : "Task updated" });
      setEditing(null);
      await load();
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    setSaving(false);
  };

  const quickStatus = async (t, status) => {
    try {
      const updates = { status };
      if (status === "completed" && !t.completed_at) updates.completed_at = new Date().toISOString();
      if (status !== "completed") updates.completed_at = "";
      await base44.entities.LPTask.update(t.id, updates);
      await load();
    } catch { toast({ title: "Update failed", variant: "destructive" }); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.LPTask.delete(deleteTarget.id);
      toast({ title: "Task deleted" });
      setDeleteTarget(null);
      await load();
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><ListTodo className="w-5 h-5 text-amber-600" /> Follow-up Tasks</h2>
          <p className="text-sm text-gray-500">Assign investigative follow-ups to supervisors with due dates and severity.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-56" />
          </div>
          <Button onClick={openNew} className="bg-amber-600 hover:bg-amber-500"><Plus className="w-4 h-4 mr-1.5" /> New Task</Button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {[
          { id: "open", label: "Open" },
          { id: "pending", label: "Pending" },
          { id: "in_progress", label: "In Progress" },
          { id: "completed", label: "Completed" },
          { id: "cancelled", label: "Cancelled" },
          { id: "all", label: "All" },
        ].map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === f.id ? "bg-amber-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"}`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><div className="w-7 h-7 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-dashed border-gray-200 rounded-2xl">
          <ListTodo className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No tasks in this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(t => {
            const sev = SEVERITY[t.severity] || SEVERITY.medium;
            const st = STATUS[t.status] || STATUS.pending;
            const od = overdue(t);
            return (
              <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm ${od ? "border-red-200" : "border-gray-100"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                    <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {t.description && <p className="text-sm text-gray-600 mt-1.5 line-clamp-2">{t.description}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sev.cls}`}>{sev.label}</span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  {od && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</span>}
                  {t.investigation_title && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 truncate max-w-[160px]">Case: {t.investigation_title}</span>}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="text-xs text-gray-500 min-w-0">
                    <p className="truncate"><span className="text-gray-400">Assignee:</span> {t.assigned_to || "Unassigned"}</p>
                    <p className={od ? "text-red-600 font-medium" : ""}><span className="text-gray-400">Due:</span> {t.due_date ? moment(t.due_date).format("MMM D, YYYY") : "—"}</p>
                  </div>
                  {t.status !== "completed" && t.status !== "cancelled" && (
                    <button onClick={() => quickStatus(t, "completed")} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</button>
                  )}
                  {t.status === "completed" && (
                    <button onClick={() => quickStatus(t, "pending")} className="text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-400 hover:bg-gray-100">Reopen</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.__new ? "New Follow-up Task" : "Edit Task"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Interview Operator, Review Camera Footage" /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Instructions / context for the follow-up" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Assign To</Label>
                <Select value={form.assigned_operator_id || "__none"} onValueChange={v => {
                  if (v === "__none") { set("assigned_operator_id", ""); set("assigned_to", ""); }
                  else { const o = supervisors.find(s => s.id === v); set("assigned_operator_id", v); set("assigned_to", o?.full_name || o?.operator_id || ""); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Select supervisor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Unassigned</SelectItem>
                    {supervisors.map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}{o.operator_id ? ` (${o.operator_id})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} /></div>
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => set("severity", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={e => set("notes", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-500">{saving ? "Saving..." : "Save Task"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete task?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">"{deleteTarget?.title}" will be permanently removed.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button onClick={remove} className="bg-red-600 hover:bg-red-500">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}