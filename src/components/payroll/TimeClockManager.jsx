import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { entryNetHours, ROLE_POSITION_LABELS } from "@/lib/payrollUtils";
import { Clock, Play, Square, Utensils, Coffee, Edit2, Plus, Save, Trash2 } from "lucide-react";

const fmt = (dt) => dt ? new Date(dt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const toLocalInput = (dt) => {
  if (!dt) return "";
  const d = new Date(dt);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

export default function TimeClockManager({ operators }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [clockOp, setClockOp] = useState("");
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().split("T")[0]; });
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [form, setForm] = useState({ operator_id: "", clock_in: "", clock_out: "", meal_start: "", meal_end: "", break_start: "", break_end: "", adjustment_note: "" });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.TimeClockEntry.list("-clock_in", 500);
      const filtered = data.filter(e => {
        const d = (e.date || (e.clock_in || "").slice(0, 10));
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      });
      setEntries(filtered);
    } catch (e) {
      toast({ title: "Error loading time clock entries", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [startDate, endDate]);

  const activeByOp = {};
  entries.filter(e => e.status !== "closed").forEach(e => { if (!activeByOp[e.operator_id]) activeByOp[e.operator_id] = e; });

  const openClockDialog = (opId) => {
    setClockOp(opId);
    setCreating(false);
    setEditing(null);
    setForm({ operator_id: opId, clock_in: "", clock_out: "", meal_start: "", meal_end: "", break_start: "", break_end: "", adjustment_note: "" });
    setEditing("clock");
  };

  const handleClockAction = async (opId, action) => {
    const op = operators.find(o => o.operator_id === opId);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    try {
      const active = (await base44.entities.TimeClockEntry.filter({ operator_id: opId, status: "open" }))[0];
      if (action === "in" && !active) {
        await base44.entities.TimeClockEntry.create({ operator_id: opId, operator_name: op?.full_name || opId, role: op?.role, date: today, clock_in: now, status: "open", source: "manual" });
        toast({ title: `${op?.full_name || opId} clocked in` });
      } else if (action === "out" && active) {
        await base44.entities.TimeClockEntry.update(active.id, { clock_out: now, status: "closed" });
        toast({ title: `${op?.full_name || opId} clocked out` });
      } else if (action === "meal" && active) {
        if (active.status === "on_meal") {
          await base44.entities.TimeClockEntry.update(active.id, { meal_end: now, status: "open" });
          toast({ title: "Meal ended" });
        } else {
          await base44.entities.TimeClockEntry.update(active.id, { meal_start: now, status: "on_meal" });
          toast({ title: "Meal started" });
        }
      } else if (action === "break" && active) {
        if (active.status === "on_break") {
          await base44.entities.TimeClockEntry.update(active.id, { break_end: now, status: "open" });
          toast({ title: "Break ended" });
        } else {
          await base44.entities.TimeClockEntry.update(active.id, { break_start: now, status: "on_break" });
          toast({ title: "Break started" });
        }
      }
      load();
    } catch (e) {
      toast({ title: "Clock action failed", variant: "destructive" });
    }
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setCreating(false);
    setForm({
      operator_id: entry.operator_id,
      clock_in: toLocalInput(entry.clock_in),
      clock_out: toLocalInput(entry.clock_out),
      meal_start: toLocalInput(entry.meal_start),
      meal_end: toLocalInput(entry.meal_end),
      break_start: toLocalInput(entry.break_start),
      break_end: toLocalInput(entry.break_end),
      adjustment_note: ""
    });
  };

  const openManual = () => {
    setEditing(null);
    setCreating(true);
    setForm({ operator_id: "", clock_in: "", clock_out: "", meal_start: "", meal_end: "", break_start: "", break_end: "", adjustment_note: "" });
  };

  const saveEdit = async () => {
    if (!form.operator_id || !form.clock_in) {
      toast({ title: "Operator and clock-in are required", variant: "destructive" });
      return;
    }
    const op = operators.find(o => o.operator_id === form.operator_id);
    const toIso = (v) => v ? new Date(v).toISOString() : "";
    try {
      const payload = {
        operator_id: form.operator_id,
        operator_name: op?.full_name || form.operator_id,
        role: op?.role,
        clock_in: toIso(form.clock_in),
        clock_out: toIso(form.clock_out),
        meal_start: toIso(form.meal_start),
        meal_end: toIso(form.meal_end),
        break_start: toIso(form.break_start),
        break_end: toIso(form.break_end),
        status: form.clock_out ? "closed" : "open",
        adjusted: true,
        adjustment_note: form.adjustment_note || "Manager adjustment"
      };
      if (editing && editing.id) {
        await base44.entities.TimeClockEntry.update(editing.id, payload);
        toast({ title: "Time entry adjusted" });
      } else {
        payload.date = toIso(form.clock_in).slice(0, 10);
        payload.source = "manual";
        await base44.entities.TimeClockEntry.create(payload);
        toast({ title: "Manual entry added" });
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (e) {
      toast({ title: "Error saving entry", variant: "destructive" });
    }
  };

  const deleteEntry = async (entry) => {
    if (!confirm(`Delete time entry for ${entry.operator_name}?`)) return;
    try {
      await base44.entities.TimeClockEntry.delete(entry.id);
      toast({ title: "Entry deleted" });
      load();
    } catch (e) {
      toast({ title: "Error deleting entry", variant: "destructive" });
    }
  };

  const editable = editing && editing !== "clock" && !creating;
  const dialogOpen = editing !== null || creating;

  return (
    <div className="space-y-6">
      {/* Quick clock-in panel */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Clock In / Out</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">Clock an employee in or out, or start/end a meal or break. Managers can also add or fix entries below.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {operators.filter(o => o.status === "active" && o.role !== "vendor").map(op => {
            const active = activeByOp[op.operator_id];
            return (
              <div key={op.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{op.full_name}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{ROLE_POSITION_LABELS[op.role] || op.role}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{active ? active.status : "off"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {!active && <Button size="sm" onClick={() => handleClockAction(op.operator_id, "in")} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"><Play className="w-3 h-3" />In</Button>}
                  {active && <Button size="sm" onClick={() => handleClockAction(op.operator_id, "out")} className="h-7 text-xs bg-red-600 hover:bg-red-700 gap-1"><Square className="w-3 h-3" />Out</Button>}
                  {active && <Button size="sm" variant="outline" onClick={() => handleClockAction(op.operator_id, "meal")} className="h-7 text-xs gap-1"><Utensils className="w-3 h-3" />{active.status === "on_meal" ? "End Meal" : "Meal"}</Button>}
                  {active && <Button size="sm" variant="outline" onClick={() => handleClockAction(op.operator_id, "break")} className="h-7 text-xs gap-1"><Coffee className="w-3 h-3" />{active.status === "on_break" ? "End Brk" : "Break"}</Button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <Button onClick={openManual} className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="w-4 h-4" /> Add Manual Entry</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Employee</th>
                <th className="text-left px-4 py-3 font-semibold">Clock In</th>
                <th className="text-left px-4 py-3 font-semibold">Clock Out</th>
                <th className="text-right px-4 py-3 font-semibold">Hours</th>
                <th className="text-center px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">Loading…</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No time entries in this range</td></tr>
              ) : entries.map(e => (
                <tr key={e.id} className={`hover:bg-gray-50 ${e.adjusted ? "bg-amber-50/40" : ""}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.operator_name}{e.adjusted && <span className="ml-2 text-[10px] text-amber-600 font-medium">adjusted</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(e.clock_in)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(e.clock_out)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{entryNetHours(e).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center"><span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{e.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => openEdit(e)} className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => deleteEntry(e)} className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) { setEditing(null); setCreating(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{creating ? "Add Manual Time Entry" : "Adjust Time Entry"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select value={form.operator_id} onChange={e => setForm({ ...form, operator_id: e.target.value })} disabled={editable} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50">
                <option value="">Select employee</option>
                {operators.filter(o => o.role !== "vendor").map(op => <option key={op.id} value={op.operator_id}>{op.full_name} ({ROLE_POSITION_LABELS[op.role] || op.role})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Clock In</label><Input type="datetime-local" value={form.clock_in} onChange={e => setForm({ ...form, clock_in: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Clock Out</label><Input type="datetime-local" value={form.clock_out} onChange={e => setForm({ ...form, clock_out: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Meal Start</label><Input type="datetime-local" value={form.meal_start} onChange={e => setForm({ ...form, meal_start: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Meal End</label><Input type="datetime-local" value={form.meal_end} onChange={e => setForm({ ...form, meal_end: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Break Start</label><Input type="datetime-local" value={form.break_start} onChange={e => setForm({ ...form, break_start: e.target.value })} /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Break End</label><Input type="datetime-local" value={form.break_end} onChange={e => setForm({ ...form, break_end: e.target.value })} /></div>
            </div>
            {(editable || creating) && (
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Adjustment Note</label><Input value={form.adjustment_note} onChange={e => setForm({ ...form, adjustment_note: e.target.value })} placeholder="Reason for adjustment (required)" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 gap-2"><Save className="w-4 h-4" /> {editable ? "Save Adjustment" : "Add Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}