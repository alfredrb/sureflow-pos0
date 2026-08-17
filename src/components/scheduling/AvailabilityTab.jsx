import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Edit2, Save, UserCircle2, CalendarOff, Users, Check } from "lucide-react";
import AvailabilityPrintFormButton from "./AvailabilityPrintForm";
import BulkAvailabilityEditor from "./BulkAvailabilityEditor";
import { OPEN_AVAILABILITY, AVAILABILITY_TEMPLATES } from "@/lib/availabilityUtils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptyDays = () => Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  available: true,
  start_time: "09:00",
  end_time: "17:00"
}));

const STATUS_STYLE = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700"
};

export default function AvailabilityTab({ operators }) {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // operator being edited
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = async () => {
    try {
      const data = await base44.entities.OperatorAvailability.list("-created_date", 500);
      setRecords(data);
    } catch (e) {
      console.error("Error loading availability:", e);
      toast({ title: "Error loading availability", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const recordByOp = useMemo(() => {
    const m = {};
    records.forEach(r => { m[r.operator_id] = r; });
    return m;
  }, [records]);

  const openEdit = (operator) => {
    const existing = recordByOp[operator.operator_id];
    setEditing(operator);
    setForm({
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      employment_type: existing?.employment_type || "full_time",
      weekly_max_hours: existing?.weekly_max_hours ?? 40,
      days: existing?.days?.length === 7 ? existing.days : emptyDays(),
      unavailable_dates: (existing?.unavailable_dates || []).join("\n"),
      notes: existing?.notes || "",
      status: existing?.status || "draft",
      recordId: existing?.id || null
    });
    setDialogOpen(true);
  };

  const updateDay = (dow, patch) => {
    setForm(prev => ({ ...prev, days: prev.days.map(d => d.day_of_week === dow ? { ...d, ...patch } : d) }));
  };

  const setOpenAvailability = () => {
    setForm(prev => ({ ...prev, days: prev.days.map(d => ({ ...d, available: true, start_time: OPEN_AVAILABILITY.start_time, end_time: OPEN_AVAILABILITY.end_time })) }));
  };

  const applyTemplate = (key) => {
    const tpl = AVAILABILITY_TEMPLATES[key];
    if (!tpl) return;
    setForm(prev => ({ ...prev, days: tpl.days.map(d => ({ ...d, available: d.available, start_time: d.start_time, end_time: d.end_time })) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        operator_id: form.operator_id,
        operator_name: form.operator_name,
        employment_type: form.employment_type,
        weekly_max_hours: Number(form.weekly_max_hours) || 40,
        days: form.days,
        unavailable_dates: form.unavailable_dates.split("\n").map(s => s.trim()).filter(Boolean),
        notes: form.notes,
        status: form.status
      };
      if (form.recordId) {
        await base44.entities.OperatorAvailability.update(form.recordId, payload);
      } else {
        payload.submitted_date = new Date().toISOString();
        await base44.entities.OperatorAvailability.create(payload);
      }
      toast({ title: "Availability saved" });
      setDialogOpen(false);
      load();
    } catch (e) {
      console.error("Error saving availability:", e);
      toast({ title: "Error saving availability", variant: "destructive" });
    }
    setSaving(false);
  };

  const setStatus = (status) => setForm(prev => ({ ...prev, status }));

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  const schedulableOps = operators.filter(o => o.role !== "vendor");

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Employee Availability</h2>
            <p className="text-xs text-gray-500">Set each employee's weekly availability — the AI scheduler uses this when drafting shifts.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setBulkOpen(true)} variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50">
              <Users className="w-4 h-4 mr-2" /> Bulk Edit
            </Button>
            <AvailabilityPrintFormButton />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {schedulableOps.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No operators found.</div>}
          {schedulableOps.map(op => {
            const rec = recordByOp[op.operator_id];
            const availDays = rec?.days?.filter(d => d.available).length ?? "—";
            return (
              <div key={op.id} className="p-4 flex flex-wrap items-center gap-4 hover:bg-gray-50/40">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <UserCircle2 className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{op.full_name}</p>
                    {rec && (
                      <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${rec.employment_type === "part_time" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                        {rec.employment_type === "part_time" ? "PT" : "FT"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 capitalize">{op.role} · {op.operator_id}</p>
                </div>
                <div className="hidden sm:block text-xs text-gray-600">
                  <span className="text-gray-400">Max hrs/wk:</span> <span className="font-medium">{rec?.weekly_max_hours ?? "—"}</span>
                </div>
                <div className="hidden sm:block text-xs text-gray-600">
                  <span className="text-gray-400">Days avail:</span> <span className="font-medium">{availDays}</span>
                </div>
                <div>
                  {rec ? (
                    <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${STATUS_STYLE[rec.status] || STATUS_STYLE.draft}`}>{rec.status}</span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-400">Not set</span>
                  )}
                </div>
                <Button onClick={() => openEdit(op)} variant="outline" size="sm" className="border-gray-300">
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Availability — {editing?.full_name}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Employment type</label>
                  <select value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="full_time">Full Time (FT)</option>
                    <option value="part_time">Part Time (PT)</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Max hours per week</label>
                  <Input type="number" min={0} value={form.weekly_max_hours} onChange={e => setForm({ ...form, weekly_max_hours: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setStatus(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Weekly availability</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => applyTemplate("opening")} className="h-7 text-xs border-sky-300 text-sky-700 hover:bg-sky-50">
                      Opening (06–14)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyTemplate("mid")} className="h-7 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                      Mid (10–18)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyTemplate("closing")} className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50">
                      Closing (14–22)
                    </Button>
                    <Button size="sm" variant="outline" onClick={setOpenAvailability} className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                      <Check className="w-3 h-3 mr-1" /> Open (24h)
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {form.days.map(d => (
                    <div key={d.day_of_week} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                      <span className="text-sm font-medium text-gray-800 w-20">{DAY_FULL[d.day_of_week]}</span>
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={d.available} onChange={e => updateDay(d.day_of_week, { available: e.target.checked })} className="w-4 h-4 rounded" />
                        Available
                      </label>
                      {d.available && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <Input type="time" value={d.start_time || ""} onChange={e => updateDay(d.day_of_week, { start_time: e.target.value })} className="w-28 h-8" />
                          <span className="text-xs text-gray-400">to</span>
                          <Input type="time" value={d.end_time || ""} onChange={e => updateDay(d.day_of_week, { end_time: e.target.value })} className="w-28 h-8" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1.5"><CalendarOff className="w-4 h-4" /> Unavailable dates (one per line, YYYY-MM-DD)</label>
                <textarea value={form.unavailable_dates} onChange={e => setForm({ ...form, unavailable_dates: e.target.value })} rows={3} placeholder={"2026-09-01\n2026-12-25"} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono" />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Notes / preferences</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                  <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save Availability"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkAvailabilityEditor open={bulkOpen} onOpenChange={setBulkOpen} operators={schedulableOps} records={records} onSaved={load} />
    </div>
  );
}