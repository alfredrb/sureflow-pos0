import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Plus, FolderSearch, Sparkles, Search, Trash2, LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import InvestigationKanbanBoard from "@/components/lossprevention/InvestigationKanbanBoard";

export const TYPE_LABEL = {
  cash_short: "Cash Short", cash_over: "Cash Over", voids: "Voids", overrides: "Overrides",
  refunds: "Refunds", no_sales: "No-Sales", stock_theft: "Stock Theft", pattern: "Pattern", meal_exception: "Meal Exception", time_theft: "Time Theft", other: "Other",
};
export const SEVERITY_BADGE = {
  low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700",
};
export const STATUS_BADGE = {
  open: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", closed: "bg-emerald-100 text-emerald-700",
};
export const STATUS_LABEL = { open: "Open", in_progress: "In Progress", closed: "Closed" };

export default function InvestigationsPanel({ refreshKey, onOpenInvestigation, onNewInvestigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("__none");
  const [bulkAssign, setBulkAssign] = useState("__none");
  const [supervisors, setSupervisors] = useState([]);
  const [applying, setApplying] = useState(false);
  const [view, setView] = useState("list");
  const [movingId, setMovingId] = useState(null);
  const { toast } = useToast();

  const moveStatus = async (id, newStatus) => {
    const inv = items.find(i => i.id === id);
    if (!inv || inv.status === newStatus) return;
    setMovingId(id);
    try {
      const activity_log = Array.isArray(inv.activity_log) ? [...inv.activity_log] : [];
      activity_log.push({ date: new Date().toISOString(), by: "Kanban Board", action: `Status changed ${STATUS_LABEL[inv.status] || inv.status} \u2192 ${STATUS_LABEL[newStatus] || newStatus}` });
      await base44.entities.Investigation.update(id, { status: newStatus, activity_log });
      toast({ title: `Moved to ${STATUS_LABEL[newStatus] || newStatus}` });
      await load();
    } catch {
      toast({ title: "Failed to move case", variant: "destructive" });
    }
    setMovingId(null);
  };

  useEffect(() => { base44.entities.Operator.list().then(list => setSupervisors(list.filter(o => o.status !== "inactive" && (o.role === "csm" || o.role === "manager")))).catch(() => {}); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.Investigation.delete(deleteTarget.id);
      toast({ title: "Investigation deleted" });
      setDeleteTarget(null);
      await load();
    } catch {
      toast({ title: "Failed to delete investigation", variant: "destructive" });
    }
    setDeleting(false);
  };

  const selectAll = () => setSelected(new Set(filtered.map(i => i.id)));

  const applyBulk = async () => {
    if (selected.size === 0) return;
    if (bulkStatus === "__none" && bulkAssign === "__none") { toast({ title: "Choose a status or supervisor", variant: "destructive" }); return; }
    setApplying(true);
    try {
      const updates = [...selected].map(id => {
        const u = { id };
        if (bulkStatus !== "__none") u.status = bulkStatus;
        if (bulkAssign === "__clear") u.assigned_to = "";
        else if (bulkAssign !== "__none") u.assigned_to = bulkAssign;
        return u;
      });
      await base44.entities.Investigation.bulkUpdate(updates);
      toast({ title: `${selected.size} investigation${selected.size > 1 ? "s" : ""} updated` });
      setSelected(new Set()); setBulkStatus("__none"); setBulkAssign("__none");
      await load();
    } catch { toast({ title: "Bulk update failed", variant: "destructive" }); }
    setApplying(false);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Investigation.list("-created_date", 200);
      setItems(data);
    } catch { setItems([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [refreshKey]);

  const filtered = items.filter(i =>
    (statusFilter === "archived" ? i.archived : (!i.archived && (statusFilter === "all" || i.status === statusFilter))) &&
    (!search || (i.title || "").toLowerCase().includes(search.toLowerCase()) || (i.operator_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    open: items.filter(i => i.status === "open" && !i.archived).length,
    in_progress: items.filter(i => i.status === "in_progress" && !i.archived).length,
    closed: items.filter(i => i.status === "closed" && !i.archived).length,
    archived: items.filter(i => i.archived).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {view === "list" ? (
            [
              { k: "all", label: `All (${items.length})` },
              { k: "open", label: `Open (${counts.open})` },
              { k: "in_progress", label: `In Progress (${counts.in_progress})` },
              { k: "closed", label: `Closed (${counts.closed})` },
              { k: "archived", label: `Archived (${counts.archived})` },
            ].map(t => (
              <button key={t.k} onClick={() => setStatusFilter(t.k)} className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${statusFilter === t.k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t.label}</button>
            ))
          ) : (
            <span className="text-sm text-gray-500 self-center">Drag cards across columns to update case status.</span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView("list")} title="List view" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}><LayoutList className="w-3.5 h-3.5" /> List</button>
            <button onClick={() => setView("board")} title="Board view" className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${view === "board" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}><LayoutGrid className="w-3.5 h-3.5" /> Board</button>
          </div>
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-56" />
          </div>
          {view === "list" && <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>}
          <Button onClick={onNewInvestigation} className="bg-amber-600 hover:bg-amber-500"><Plus className="w-4 h-4 mr-1.5" /> New</Button>
        </div>
      </div>

      {view === "list" && selected.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-medium text-amber-800 whitespace-nowrap">{selected.size} selected</span>
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="flex-1 min-w-[140px]"><Label className="text-xs">Set Status</Label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="__none">No change</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="closed">Closed</SelectItem>
              </SelectContent></Select>
            </div>
            <div className="flex-1 min-w-[140px]"><Label className="text-xs">Assign Supervisor</Label>
              <Select value={bulkAssign} onValueChange={setBulkAssign}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="__none">No change</SelectItem>
                <SelectItem value="__clear">— Clear —</SelectItem>
                {supervisors.map(o => <SelectItem key={o.id} value={o.full_name || o.operator_id}>{o.full_name}{o.operator_id ? ` (${o.operator_id})` : ""}</SelectItem>)}
              </SelectContent></Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyBulk} disabled={applying} className="bg-amber-600 hover:bg-amber-500">{applying ? "Applying..." : "Apply"}</Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>
      ) : view === "board" ? (
        <InvestigationKanbanBoard items={items} search={search} onOpenInvestigation={onOpenInvestigation} onMoveStatus={moveStatus} movingId={movingId} />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
          <FolderSearch className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">{statusFilter === "archived" ? "No archived investigations" : "No investigations yet"}</p>
          <p className="text-gray-400 text-xs mt-1">{statusFilter === "archived" ? "Closed cases are archived automatically after 30 days and permanently deleted after 90 days. Export a case to keep a copy." : "Start one from the Overview, Shorts & Longs, or AI Suggestions tabs — or create one manually."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(inv => (
            <div key={inv.id} className="text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
              <button onClick={() => onOpenInvestigation(inv)} className="w-full text-left">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABEL[inv.type] || inv.type}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${SEVERITY_BADGE[inv.severity] || "bg-gray-100 text-gray-600"}`}>{inv.severity}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_BADGE[inv.status] || "bg-gray-100 text-gray-600"}`}>{STATUS_LABEL[inv.status] || inv.status}</span>
                      {inv.archived && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-200 text-gray-600" title={inv.archived_date ? `Archived ${moment(inv.archived_date).format("MMM D, YYYY")}` : ""}>Archived</span>}
                      {inv.ai_generated && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 inline-flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> AI</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mt-2 truncate">{inv.title}</h3>
                  </div>
                  {inv.amount_impact ? <span className="text-sm font-bold text-gray-900 whitespace-nowrap">${Number(inv.amount_impact).toFixed(2)}</span> : null}
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{inv.summary || "—"}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{inv.operator_name ? `Operator: ${inv.operator_name}` : "No operator"}{inv.assigned_to ? ` · Assigned: ${inv.assigned_to}` : ""}</span>
                  <span className="text-xs text-gray-400">{moment(inv.created_date).format("MMM D, YYYY")}</span>
                </div>
              </button>
              <div className="flex justify-between items-center mt-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={selected.has(inv.id)} onChange={e => { const n = new Set(selected); e.target.checked ? n.add(inv.id) : n.delete(inv.id); setSelected(n); }} className="w-3.5 h-3.5" />
                  Select
                </label>
                <button onClick={() => setDeleteTarget(inv)} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete investigation?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove “{deleteTarget?.title}” and all its linked evidence. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-500">{deleting ? "Deleting..." : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}