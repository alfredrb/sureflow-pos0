import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Clock, AlertTriangle, CheckCircle, Save, Copy, ArrowRight, Calendar, List, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PeakTimeAnalysis from "@/components/PeakTimeAnalysis";
import WeeklyScheduleCalendar from "@/components/WeeklyScheduleCalendar";

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
  const [view, setView] = useState("calendar");
  const [groupBy, setGroupBy] = useState("position");
  const [generating, setGenerating] = useState(false);
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

  const load = async () => {
    try {
      const [shiftData, opData, regData, templateData, peakData, swapReqs] = await Promise.all([
        base44.entities.Shift.list("-date", 100),
        base44.entities.Operator.filter({ status: "active" }),
        base44.entities.Register.list(),
        base44.entities.ShiftTemplate.list("-created_date", 100),
        base44.entities.PeakTime.list("-created_date", 500),
        base44.entities.ShiftSwapRequest.filter({ status: "approved" })
      ]);

      // Auto-sync technician shifts from the Maintenance Log (not AI-driven).
      // For every scheduled/in-progress maintenance entry, ensure a technician
      // shift exists on its service_date. Idempotent via a [ML-<id>] marker.
      let syncedShifts = shiftData;
      try {
        const techs = opData.filter(o => o.role === "technician");
        if (techs.length > 0) {
          const logs = await base44.entities.MaintenanceLog.list("-service_date", 200);
          const pending = logs.filter(l =>
            (l.status === "scheduled" || l.status === "in_progress") && l.service_date
          );
          const created = [];
          for (const log of pending) {
            const marker = `[ML-${log.id}]`;
            if (shiftData.some(s => s.notes && s.notes.includes(marker))) continue;
            const tech = techs.find(t => t.full_name === log.technician_name) || techs[0];
            created.push(base44.entities.Shift.create({
              date: log.service_date,
              operator_id: tech.operator_id,
              operator_name: tech.full_name,
              register_id: log.register_id || "",
              register_name: "",
              start_time: "09:00",
              end_time: "13:00",
              break_start: "",
              break_end: "",
              lunch_start: "",
              lunch_end: "",
              status: "scheduled",
              notes: `Maintenance: ${log.title}${marker}`
            }));
          }
          if (created.length > 0) {
            await Promise.all(created);
            syncedShifts = await base44.entities.Shift.list("-date", 100);
          }
        }
      } catch (e) {
        console.error("Error syncing tech shifts from maintenance:", e);
      }

      setShifts(syncedShifts);
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

  useEffect(() => {
    load();
  }, []);
  useRealtimeSync(["Shift", "ShiftSwapRequest"], load, { intervalMs: 20000 });

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

  const generateAIDraft = async () => {
    setGenerating(true);
    try {
      const allPeakTimes = await base44.entities.PeakTime.list("-created_date", 500);
      // Technicians are auto-scheduled from the Maintenance Log — exclude from AI draft.
      const schedulable = operators.filter(o => o.status === "active" && o.pos_access !== false && ["cashier", "csm", "manager"].includes(o.role));

      // Build a compact peak-time summary per day-of-week (operating hours 6–22).
      const peakSummary = {};
      for (let dow = 0; dow < 7; dow++) {
        const hours = allPeakTimes.filter(p => p.day_of_week === dow && p.hour >= 6 && p.hour <= 22).sort((a, b) => a.hour - b.hour)
          .map(p => `${String(p.hour).padStart(2, "0")}:00 req=${p.required_staff || 1} (${p.peak_level})`);
        peakSummary[dow] = hours.join(", ") || "no data";
      }

      const baseDate = new Date(draftDate);
      const dates = [];
      for (let i = 0; i < 21; i++) { const d = new Date(baseDate); d.setDate(d.getDate() + i); dates.push(d.toISOString().split("T")[0]); }

      const opList = schedulable.map(o => `${o.operator_id}|${o.full_name}|${o.role}`).join("; ");

      const prompt = `You are an expert retail shift scheduler. Build a 3-week (21-day) draft shift schedule for a retail store.
Start date: ${dates[0]}. End date: ${dates[20]}.

Available operators (operator_id|full_name|role):
${opList}

Peak-time staffing requirements by day-of-week (0=Sunday..6=Saturday), operating 06:00–22:00. "req" = recommended staff count for that hour:
${Object.entries(peakSummary).map(([d, h]) => `Day ${d}: ${h}`).join("\n")}

Rules:
- Schedule MULTIPLE staff per day to cover peak hours — each day typically needs several overlapping shifts (openers, mid-day, closers). Never schedule only one person for a whole day unless demand is truly minimal.
- Cover every peak hour with enough staff to meet the "req" recommendation; stagger start times across the day to match demand (e.g., openers at 6-8, mid-day coverage, closers until 22:00). Multiple operators may overlap during high-demand hours.
- Do not over-schedule quiet hours. Balance total scheduled staff-hours close to total required staff-hours per day.
- Give most hours to cashiers; always include a CSM during busy periods and a manager for open/close. Do NOT schedule technicians (they are handled separately).
- An individual operator works at most ONE shift per day, but different operators can and should be scheduled on the same day to meet coverage.
- Reasonable shift lengths (4–8 hours). Include a 30-min break near the middle and a 1-hour lunch for shifts over 6 hours.
- Use 24-hour HH:MM times only.

Return a JSON object with a "shifts" array. Each shift: { date (YYYY-MM-DD), operator_id, start_time, end_time, break_start, break_end, lunch_start, lunch_end }. Only return the JSON.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            shifts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  operator_id: { type: "string" },
                  start_time: { type: "string" },
                  end_time: { type: "string" },
                  break_start: { type: "string" },
                  break_end: { type: "string" },
                  lunch_start: { type: "string" },
                  lunch_end: { type: "string" }
                },
                required: ["date", "operator_id", "start_time", "end_time"]
              }
            }
          }
        }
      });

      const draftShifts = Array.isArray(res?.shifts) ? res.shifts : [];
      let created = 0;
      for (const s of draftShifts) {
        const op = schedulable.find(o => o.operator_id === s.operator_id);
        if (!op || !dates.includes(s.date)) continue;
        await base44.entities.Shift.create({
          date: s.date,
          operator_id: op.operator_id,
          operator_name: op.full_name,
          register_id: "",
          register_name: "",
          start_time: s.start_time,
          end_time: s.end_time,
          break_start: s.break_start || "",
          break_end: s.break_end || "",
          lunch_start: s.lunch_start || "",
          lunch_end: s.lunch_end || "",
          status: "scheduled",
          notes: "AI draft"
        });
        created++;
      }

      toast({ title: "AI draft generated", description: `${created} shifts created over 3 weeks — review and edit on the calendar.` });
      setDraftDialog(false);
      load();
    } catch (e) {
      console.error("Error generating AI draft:", e);
      toast({ title: "Error generating AI draft", description: e?.message || "Please try again.", variant: "destructive" });
    }
    setGenerating(false);
  };

  const handleDropCreate = (operator, dateStr, registerId) => {
    const reg = registers.find(r => r.register_id === registerId);
    setEditing(null);
    setForm({
      date: dateStr,
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      register_id: registerId || "",
      register_name: reg?.name || "",
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

  const handleMoveShift = async (shift, newDateStr, registerId) => {
    try {
      const patch = { date: newDateStr };
      if (groupBy === "register" && registerId !== null) {
        patch.register_id = registerId;
        patch.register_name = registers.find(r => r.register_id === registerId)?.name || "";
      }
      await base44.entities.Shift.update(shift.id, patch);
      toast({ title: "Shift moved" });
      load();
    } catch (e) {
      console.error("Error moving shift:", e);
      toast({ title: "Error moving shift", variant: "destructive" });
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
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView("calendar")} className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 transition ${view === "calendar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}><Calendar className="w-3.5 h-3.5" /> Calendar</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1 transition ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}><List className="w-3.5 h-3.5" /> List</button>
          </div>
          <Button onClick={() => setDraftDialog(true)} className="bg-emerald-600 hover:bg-emerald-700"><Sparkles className="w-4 h-4 mr-2" /> Generate AI Draft</Button>
          <Button onClick={() => setTemplateDialog(true)} variant="outline" className="border-gray-300"><Save className="w-4 h-4 mr-2" /> Save as Template</Button>
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

      {view === "calendar" && (
        <WeeklyScheduleCalendar
          shifts={shifts}
          operators={operators}
          registers={registers}
          peakTimes={peakTimes}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          onCreate={handleDropCreate}
          onEdit={openEdit}
          onMove={handleMoveShift}
          onDelete={deleteShift}
        />
      )}

      <div className={`space-y-6 ${view === "list" ? "" : "hidden"}`}>
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

      {/* Generate AI Draft Dialog */}
      <Dialog open={draftDialog} onOpenChange={setDraftDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate AI Draft Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
              <Input type="date" value={draftDate} onChange={e => setDraftDate(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">AI will draft shifts for <strong>3 weeks (21 days)</strong> starting from this date.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-900">
                AI analyzes your peak-time staffing needs and builds a balanced draft covering every busy hour without over-scheduling quiet periods. Drag, drop, and edit shifts on the calendar afterward.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraftDialog(false)} className="flex-1" disabled={generating}>Cancel</Button>
              <Button onClick={generateAIDraft} className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={generating}>
                {generating ? <><Sparkles className="w-4 h-4 mr-2 animate-pulse" /> Drafting…</> : <><Sparkles className="w-4 h-4 mr-2" /> Generate AI Draft</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}