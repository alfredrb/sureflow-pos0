import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Clock, AlertTriangle, CheckCircle, Save, Copy, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PeakTimeAnalysis from "@/components/PeakTimeAnalysis";

const timeToMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getDayName = (date) => new Date(date).toLocaleDateString("en-US", { weekday: "short" });

export default function AdminShiftScheduling() {
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateDialog, setTemplateDialog] = useState(false);
  const [draftDialog, setDraftDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [draftDate, setDraftDate] = useState(new Date().toISOString().split("T")[0]);
  const [peakTimes, setPeakTimes] = useState([]);
  const [swapLogs, setSwapLogs] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    operator_id: "",
    operator_name: "",
    register_id: "",
    register_name: "",
    start_time: "09:00",
    end_time: "17:00",
    break_start: "12:00",
    break_end: "12:30",
    lunch_start: "13:00",
    lunch_end: "14:00",
    notes: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    load();
  }, []);
  useRealtimeSync(["Shift", "ShiftSwapRequest"], load, { intervalMs: 20000 });

  const load = async () => {
    try {
      const [shiftData, opData, regData, templateData, peakData, swapReqs] = await Promise.all([
        base44.entities.Shift.list("-date", 100),
        base44.entities.Operator.filter({ status: "active" }),
        base44.entities.Register.list(),
        base44.entities.ShiftTemplate.list("-created_date", 100),
        base44.entities.PeakTime.filter({ day_of_week: new Date().getDay() }),
        base44.entities.ShiftSwapRequest.filter({ status: "approved" })
      ]);
      setShifts(shiftData);
      setOperators(opData);
      setRegisters(regData);
      setTemplates(templateData);
      setPeakTimes(peakData);
      setSwapLogs(swapReqs);
    } catch (e) {
      console.error("Error loading:", e);
      toast({ title: "Error loading data", variant: "destructive" });
    }
    setLoading(false);
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().split("T")[0],
      operator_id: "",
      operator_name: "",
      register_id: "",
      register_name: "",
      start_time: "09:00",
      end_time: "17:00",
      break_start: "12:00",
      break_end: "12:30",
      lunch_start: "13:00",
      lunch_end: "14:00",
      notes: ""
    });
    setDialogOpen(true);
  };

  const openEdit = (shift) => {
    setEditing(shift);
    setForm({
      date: shift.date,
      operator_id: shift.operator_id,
      operator_name: shift.operator_name,
      register_id: shift.register_id,
      register_name: shift.register_name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      break_start: shift.break_start || "12:00",
      break_end: shift.break_end || "12:30",
      lunch_start: shift.lunch_start || "13:00",
      lunch_end: shift.lunch_end || "14:00",
      notes: shift.notes || ""
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.operator_id || !form.date || !form.start_time || !form.end_time) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const opName = operators.find(o => o.operator_id === form.operator_id)?.full_name || form.operator_name;
      const regName = registers.find(r => r.register_id === form.register_id)?.name || form.register_name;

      const data = {
        ...form,
        operator_name: opName,
        register_name: regName,
        status: "scheduled"
      };

      if (editing) {
        await base44.entities.Shift.update(editing.id, data);
        toast({ title: "Shift updated" });
      } else {
        await base44.entities.Shift.create(data);
        toast({ title: "Shift created" });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      console.error("Error saving:", e);
      toast({ title: "Error saving shift", variant: "destructive" });
    }
  };

  const deleteShift = async (shift) => {
    if (!confirm(`Delete shift for ${shift.operator_name} on ${shift.date}?`)) return;
    try {
      await base44.entities.Shift.delete(shift.id);
      toast({ title: "Shift deleted" });
      load();
    } catch (e) {
      console.error("Error deleting:", e);
      toast({ title: "Error deleting shift", variant: "destructive" });
    }
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Please enter a template name", variant: "destructive" });
      return;
    }
    try {
      const dayShifts = shifts.filter(s => s.date === draftDate);
      await base44.entities.ShiftTemplate.create({
        name: templateName,
        shifts: dayShifts.map(s => ({
          operator_id: s.operator_id,
          operator_name: s.operator_name,
          register_id: s.register_id,
          register_name: s.register_name,
          start_time: s.start_time,
          end_time: s.end_time,
          break_start: s.break_start,
          break_end: s.break_end,
          lunch_start: s.lunch_start,
          lunch_end: s.lunch_end
        })),
        is_weekly: false
      });
      toast({ title: "Template saved successfully" });
      setTemplateDialog(false);
      setTemplateName("");
      load();
    } catch (e) {
      console.error("Error saving template:", e);
      toast({ title: "Error saving template", variant: "destructive" });
    }
  };

  const applyTemplate = async (template) => {
    try {
      const baseDate = new Date(draftDate);
      for (let i = 0; i < 7; i++) {
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(shiftDate.getDate() + i);
        const dateStr = shiftDate.toISOString().split("T")[0];

        for (const shiftTemplate of (template.shifts || [])) {
          await base44.entities.Shift.create({
            date: dateStr,
            operator_id: shiftTemplate.operator_id,
            operator_name: shiftTemplate.operator_name,
            register_id: shiftTemplate.register_id,
            register_name: shiftTemplate.register_name,
            start_time: shiftTemplate.start_time,
            end_time: shiftTemplate.end_time,
            break_start: shiftTemplate.break_start,
            break_end: shiftTemplate.break_end,
            lunch_start: shiftTemplate.lunch_start,
            lunch_end: shiftTemplate.lunch_end,
            status: "scheduled"
          });
        }
      }
      toast({ title: "Template applied for 7 days" });
      load();
    } catch (e) {
      console.error("Error applying template:", e);
      toast({ title: "Error applying template", variant: "destructive" });
    }
  };

  const generateDraftFromPeakTimes = async () => {
    try {
      const allPeakTimes = await base44.entities.PeakTime.list("-created_date", 500);
      const baseDate = new Date(draftDate);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(shiftDate.getDate() + dayOffset);
        const dayOfWeek = shiftDate.getDay();
        const dateStr = shiftDate.toISOString().split("T")[0];

        const dayPeaks = allPeakTimes.filter(p => p.day_of_week === dayOfWeek).sort((a, b) => a.hour - b.hour);
        if (dayPeaks.length === 0) continue;

        const peakHours = dayPeaks.filter(p => p.peak_level === "high" || p.peak_level === "very_high");
        const startHour = Math.min(...peakHours.map(p => p.hour), 8);
        const endHour = Math.max(...peakHours.map(p => p.hour), 20) + 1;

        for (const op of operators.slice(0, Math.ceil(peakHours.length / 2))) {
          await base44.entities.Shift.create({
            date: dateStr,
            operator_id: op.operator_id,
            operator_name: op.full_name,
            register_id: "",
            register_name: "",
            start_time: `${String(startHour).padStart(2, "0")}:00`,
            end_time: `${String(endHour).padStart(2, "0")}:00`,
            break_start: `${String(Math.floor((startHour + endHour) / 2)).padStart(2, "0")}:00`,
            break_end: `${String(Math.floor((startHour + endHour) / 2)).padStart(2, "0")}:30`,
            lunch_start: `${String(Math.floor((startHour + endHour) / 2) + 1).padStart(2, "0")}:00`,
            lunch_end: `${String(Math.floor((startHour + endHour) / 2) + 2).padStart(2, "0")}:00`,
            status: "scheduled",
            notes: "Draft from peak time analysis"
          });
        }
      }

      toast({ title: "Draft schedule created from peak times" });
      setDraftDialog(false);
      load();
    } catch (e) {
      console.error("Error generating draft:", e);
      toast({ title: "Error generating draft", variant: "destructive" });
    }
  };

  const statusBadge = (status) => {
    const colors = {
      scheduled: "bg-blue-100 text-blue-700",
      active: "bg-green-100 text-green-700",
      on_break: "bg-amber-100 text-amber-700",
      on_lunch: "bg-purple-100 text-purple-700",
      completed: "bg-gray-100 text-gray-700",
      overtime: "bg-red-100 text-red-700"
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.scheduled}`}>{status}</span>;
  };

  const groupByDate = (shifts) => {
    const grouped = {};
    shifts.forEach(s => {
      if (!grouped[s.date]) grouped[s.date] = [];
      grouped[s.date].push(s);
    });
    return Object.entries(grouped).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  };

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shift Scheduling</h1>
          <p className="text-gray-500 text-sm mt-1">{shifts.length} shifts scheduled</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDraftDialog(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" /> Generate Draft</Button>
          <Button onClick={() => setTemplateDialog(true)} className="bg-purple-600 hover:bg-purple-700"><Save className="w-4 h-4 mr-2" /> Save as Template</Button>
          <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> New Shift</Button>
        </div>
      </div>

      <div className="mb-6">
        <PeakTimeAnalysis />
      </div>

      {templates.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Templates</h2>
          <div className="flex gap-2 flex-wrap">
            {templates.map(tmpl => (
              <Button
                key={tmpl.id}
                onClick={() => applyTemplate(tmpl)}
                variant="outline"
                className="gap-2"
              >
                <Copy className="w-3 h-3" />
                {tmpl.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
         {swapLogs.length > 0 && (
           <div className="bg-white rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
             <div className="bg-amber-100 px-6 py-4 border-b border-amber-200">
               <h2 className="font-semibold text-amber-900">Recent Shift Swaps</h2>
             </div>
             <div className="divide-y divide-amber-100">
               {swapLogs.slice(0, 5).map(log => (
                 <div key={log.id} className="p-4 flex items-center gap-4">
                   <div className="flex-1">
                     <p className="text-sm font-semibold text-gray-900">
                       Swap on {new Date(log.shift_date).toLocaleDateString()}
                     </p>
                     <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                       <span className="font-medium">{log.requester_operator_name}</span>
                       <ArrowRight className="w-3 h-3" />
                       <span className="font-medium">{log.target_operator_name}</span>
                     </div>
                   </div>
                   <span className="text-xs bg-amber-200 text-amber-900 px-2 py-1 rounded">Approved</span>
                 </div>
               ))}
             </div>
           </div>
         )}
         {groupByDate(shifts).map(([date, dayShifts]) => {
           const swappedShiftIds = swapLogs
             .filter(log => log.shift_date === date)
             .flatMap(log => {
               const original = dayShifts.find(s => s.operator_id === log.requester_operator_id && s.date === date);
               return original ? [original.id] : [];
             });

           return (
           <div key={date} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
             <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
               <h2 className="font-semibold text-gray-900">{getDayName(date)} — {new Date(date).toLocaleDateString()}</h2>
             </div>
             <div className="divide-y divide-gray-100">
               {dayShifts.map(shift => {
                 const isSwapped = swappedShiftIds.includes(shift.id);
                 return (
                 <div key={shift.id} className={`p-4 hover:bg-gray-50 transition-colors ${isSwapped ? "border-l-4 border-l-emerald-500 bg-emerald-50/30" : ""}`}>
                   <div className="flex items-start justify-between">
                     <div className="flex-1">
                       <div className="flex items-center gap-3 mb-2">
                         <p className="font-semibold text-gray-900">{shift.operator_name}</p>
                         {statusBadge(shift.status)}
                         {isSwapped && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-semibold">Swap Applied</span>}
                       </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span><strong>Shift:</strong> {shift.start_time} - {shift.end_time}</span>
                        </div>
                        {shift.break_start && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span><strong>Break:</strong> {shift.break_start} - {shift.break_end}</span>
                          </div>
                        )}
                        {shift.lunch_start && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span><strong>Lunch:</strong> {shift.lunch_start} - {shift.lunch_end}</span>
                          </div>
                        )}
                        <div>
                          <strong>Register:</strong> {shift.register_name || "—"}
                        </div>
                      </div>
                      {shift.overtime_minutes > 0 && (
                        <div className="mt-2 text-xs flex items-center gap-1 text-red-600 font-semibold">
                          <AlertTriangle className="w-3 h-3" />
                          {shift.overtime_minutes} min overtime {shift.overtime_approved ? "(approved)" : "(requires override)"}
                        </div>
                      )}
                      {shift.notes && <p className="mt-2 text-xs text-gray-500 italic">{shift.notes}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => openEdit(shift)}><Edit2 className="w-3 h-3" /></Button>
                      <Button variant="outline" size="sm" onClick={() => deleteShift(shift)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                      </div>
                      </div>
                      );
                      })}
                      </div>
                      </div>
                      );
                      })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Shift" : "New Shift"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Operator</label>
                <select value={form.operator_id} onChange={e => {
                  const op = operators.find(o => o.operator_id === e.target.value);
                  setForm({ ...form, operator_id: e.target.value, operator_name: op?.full_name || "" });
                }} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option value="">Select operator</option>
                  {operators.map(op => <option key={op.id} value={op.operator_id}>{op.full_name} ({op.operator_id})</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Register (optional)</label>
              <select value={form.register_id} onChange={e => {
                const reg = registers.find(r => r.register_id === e.target.value);
                setForm({ ...form, register_id: e.target.value, register_name: reg?.name || "" });
              }} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option value="">Select register</option>
                {registers.map(reg => <option key={reg.id} value={reg.register_id}>{reg.name}</option>)}
              </select>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Shift Times</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Start Time</label>
                  <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">End Time</label>
                  <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Break & Lunch</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Break Start</label>
                  <Input type="time" value={form.break_start} onChange={e => setForm({ ...form, break_start: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Break End</label>
                  <Input type="time" value={form.break_end} onChange={e => setForm({ ...form, break_end: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Lunch Start</label>
                  <Input type="time" value={form.lunch_start} onChange={e => setForm({ ...form, lunch_start: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Lunch End</label>
                  <Input type="time" value={form.lunch_end} onChange={e => setForm({ ...form, lunch_end: e.target.value })} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
            </div>

            <Button onClick={save} className="w-full bg-blue-600 hover:bg-blue-700">{editing ? "Update" : "Create"} Shift</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Template Name</label>
              <Input
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="e.g., Morning Rotation"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Date to Save</label>
              <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">All shifts from this date will be saved as a template</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTemplateDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={saveAsTemplate} className="flex-1 bg-purple-600 hover:bg-purple-700">Save Template</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Draft Dialog */}
      <Dialog open={draftDialog} onOpenChange={setDraftDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Draft Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
              <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Draft will be generated for 7 days starting from this date</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                The system will analyze peak times and create draft shifts based on staffing needs. You can edit all shifts afterward.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraftDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={generateDraftFromPeakTimes} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Generate Draft</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}