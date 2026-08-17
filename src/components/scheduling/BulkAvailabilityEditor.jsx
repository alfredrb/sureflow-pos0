import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/data";
import { Save, Users, Check, Sunrise, Sun, Sunset } from "lucide-react";
import { OPEN_AVAILABILITY, AVAILABILITY_TEMPLATES } from "@/lib/availabilityUtils";

const TEMPLATE_ICON = { opening: Sunrise, mid: Sun, closing: Sunset };

const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emptyDays = () => Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i, available: true, start_time: "09:00", end_time: "17:00"
}));

export default function BulkAvailabilityEditor({ open, onOpenChange, operators, records, onSaved }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState([]);
  const [employmentType, setEmploymentType] = useState("full_time");
  const [maxHours, setMaxHours] = useState(40);
  const [days, setDays] = useState(emptyDays());
  const [saving, setSaving] = useState(false);

  const recordByOp = useMemo(() => {
    const m = {};
    (records || []).forEach(r => { m[r.operator_id] = r; });
    return m;
  }, [records]);

  const toggleOp = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === operators.length ? [] : operators.map(o => o.operator_id));

  const updateDay = (dow, patch) => setDays(prev => prev.map(d => d.day_of_week === dow ? { ...d, ...patch } : d));

  const setAllOpen = () => {
    setDays(prev => prev.map(d => ({ ...d, available: true, start_time: OPEN_AVAILABILITY.start_time, end_time: OPEN_AVAILABILITY.end_time })));
  };

  const apply = async () => {
    if (selected.length === 0) {
      toast({ title: "Select at least one employee", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employment_type: employmentType,
        weekly_max_hours: Number(maxHours) || 40,
        days,
        unavailable_dates: [],
        notes: "Bulk updated",
        status: "approved"
      };
      const ops = operators.filter(o => selected.includes(o.operator_id));
      for (const op of ops) {
        const existing = recordByOp[op.operator_id];
        const data = { ...payload, operator_id: op.operator_id, operator_name: op.full_name };
        if (existing?.id) {
          await base44.entities.OperatorAvailability.update(existing.id, data);
        } else {
          data.submitted_date = new Date().toISOString();
          await base44.entities.OperatorAvailability.create(data);
        }
      }
      toast({ title: `Availability updated for ${ops.length} employee${ops.length === 1 ? "" : "s"}` });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error("Bulk availability error:", e);
      toast({ title: "Error updating availability", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Bulk Availability Editor</DialogTitle>
          <DialogDescription>Apply the same availability to multiple employees at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Employees ({selected.length} selected)</label>
              <Button size="sm" variant="outline" onClick={toggleAll} className="h-7 text-xs">
                {selected.length === operators.length ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {operators.map(op => {
                const checked = selected.includes(op.operator_id);
                const rec = recordByOp[op.operator_id];
                return (
                  <label key={op.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs ${checked ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => toggleOp(op.operator_id)} />
                    <span className="font-medium text-gray-800 truncate flex-1">{op.full_name}</span>
                    {rec && <span className="text-[9px] font-bold text-gray-400">{rec.employment_type === "part_time" ? "PT" : "FT"}</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Employment type</label>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={() => setEmploymentType("full_time")} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${employmentType === "full_time" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Full Time (FT)</button>
                <button onClick={() => setEmploymentType("part_time")} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md ${employmentType === "part_time" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>Part Time (PT)</button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Max hours / week</label>
              <Input type="number" min={0} value={maxHours} onChange={e => setMaxHours(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Weekly availability</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(AVAILABILITY_TEMPLATES).map(([key, tpl]) => {
                  const Icon = TEMPLATE_ICON[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setDays(tpl.days.map(d => ({ ...d })))}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition flex items-center gap-1"
                      title={tpl.desc}
                    >
                      <Icon className="w-3 h-3" /> {tpl.label}
                    </button>
                  );
                })}
                <Button size="sm" variant="outline" onClick={setAllOpen} className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                  <Check className="w-3 h-3 mr-1" /> Open (24h)
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {days.map(d => (
                <div key={d.day_of_week} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                  <span className="text-sm font-medium text-gray-800 w-24">{DAY_FULL[d.day_of_week]}</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <Checkbox checked={d.available} onCheckedChange={v => updateDay(d.day_of_week, { available: !!v })} />
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
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={apply} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : `Apply to ${selected.length || 0}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}