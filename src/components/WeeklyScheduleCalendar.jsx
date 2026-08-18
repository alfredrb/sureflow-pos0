import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, MinusCircle, Clock, Trash2, UserPlus, ShieldAlert, Ban, Utensils, Lock } from "lucide-react";
import DayUtilizationChart from "@/components/scheduling/DayUtilizationChart";
import AvailabilitySidePanel from "@/components/scheduling/AvailabilitySidePanel";
import AvailabilityOverrideDialog from "@/components/scheduling/AvailabilityOverrideDialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarDays } from "lucide-react";
import { dayAvailability, shiftAvailabilityConflict, employmentBadge } from "@/lib/availabilityUtils";
import LaborCostIndicator from "@/components/scheduling/LaborCostIndicator";

const ROLE_LABELS = { cashier: "Cashier", csm: "CSM", manager: "Manager", technician: "Technician", loss_prevention: "LP", vendor: "Vendor" };
const ROLE_ORDER = ["cashier", "csm", "manager", "technician", "loss_prevention"];
const ROLE_DOT = { cashier: "#3b82f6", csm: "#8b5cf6", manager: "#10b981", technician: "#f59e0b", loss_prevention: "#f43f5e", vendor: "#6b7280" };
const SCHEDULABLE_ROLES = ["cashier", "csm", "manager", "technician"];

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayStr = toISO(new Date());
const isPast = (dateStr) => dateStr < todayStr;

// Staff-hour coverage for a day vs peak-time requirements (operating 6:00–22:00).
const coverageFor = (dayDate, dayShifts, peakTimes) => {
  const dow = dayDate.getDay();
  const dayPeaks = peakTimes.filter(p => p.day_of_week === dow && p.hour >= 6 && p.hour <= 22);
  const required = dayPeaks.reduce((s, p) => s + (p.required_staff || 1), 0);
  const scheduled = dayShifts.reduce((s, sh) => {
    if (!sh.start_time || !sh.end_time) return s;
    const [shh, shm] = sh.start_time.split(":").map(Number);
    const [ehh, em] = sh.end_time.split(":").map(Number);
    let hrs = (ehh * 60 + em - (shh * 60 + shm)) / 60;
    if (hrs < 0) hrs += 24;
    return s + Math.max(0, hrs);
  }, 0);
  return { required: Math.round(required), scheduled: Math.round(scheduled * 10) / 10 };
};

export default function WeeklyScheduleCalendar({ shifts, operators, registers, peakTimes, availability, groupBy, onGroupByChange, onCreate, onEdit, onMove, onDelete, payRates, laborBudget, overtimeThreshold }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragOver, setDragOver] = useState(null); // `${rowKey}|${dateStr}`
  const [utilDay, setUtilDay] = useState(null); // day index with utilization chart expanded
  const [conflictMode, setConflictMode] = useState(false);
  const [draggingOp, setDraggingOp] = useState(null); // operator_id currently being dragged
  const [override, setOverride] = useState({ open: false, operatorName: "", dateLabel: "", reasons: [], confirm: null });

  const weekStart = getWeekStart(currentDate);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; }), [weekStart]);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weekShifts = useMemo(() => {
    const start = toISO(weekStart);
    const end = toISO(days[6]);
    return shifts.filter(s => s.date >= start && s.date <= end);
  }, [shifts, weekStart, days]);

  const opById = useMemo(() => {
    const m = {};
    operators.forEach(o => { m[o.operator_id] = o; });
    return m;
  }, [operators]);

  const availByOp = useMemo(() => {
    const m = {};
    (availability || []).forEach(r => { m[r.operator_id] = r; });
    return m;
  }, [availability]);

  // Per-operator conflict summary for the side panel (used when conflictMode is on).
  const conflictsByOp = useMemo(() => {
    const m = {};
    if (!conflictMode) return m;
    weekShifts.forEach(s => {
      const c = shiftAvailabilityConflict(s, availByOp[s.operator_id], weekShifts);
      if (c.conflict) m[s.operator_id] = true;
    });
    return m;
  }, [conflictMode, weekShifts, availByOp]);

  // Pool of draggable operators (active, POS-accessible, schedulable roles).
  const pool = useMemo(() => operators.filter(o => o.status === "active" && o.pos_access !== false && SCHEDULABLE_ROLES.includes(o.role)), [operators]);

  // Build rows based on grouping.
  const rows = useMemo(() => {
    if (groupBy === "register") {
      const regIds = [...new Set(weekShifts.map(s => s.register_id || "").filter(Boolean))];
      registers.forEach(r => { if (!regIds.includes(r.register_id)) regIds.push(r.register_id); });
      return [{ key: "", label: "Unassigned" }, ...regIds.filter(Boolean).sort().map(id => ({ key: id, label: registers.find(r => r.register_id === id)?.name || id }))];
    }
    // position
    const present = new Set(weekShifts.map(s => opById[s.operator_id]?.role).filter(Boolean));
    return ROLE_ORDER.filter(r => present.has(r) || pool.some(o => o.role === r)).map(r => ({ key: r, label: ROLE_LABELS[r] || r }));
  }, [groupBy, weekShifts, registers, opById, pool]);

  const matchRow = (shift, rowKey) => {
    if (groupBy === "register") return (shift.register_id || "") === rowKey;
    return (opById[shift.operator_id]?.role || "") === rowKey;
  };

  const handleDrop = (e, rowKey, dateStr, registerId) => {
    e.preventDefault();
    if (isPast(dateStr)) { setDragOver(null); setDraggingOp(null); return; }
    setDragOver(null);
    setDraggingOp(null);
    const opId = e.dataTransfer.getData("operator_id");
    const shiftId = e.dataTransfer.getData("shift_id");
    const dateLabel = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const regFor = groupBy === "register" ? registerId : "";

    if (opId) {
      const op = operators.find(o => o.operator_id === opId);
      if (!op) return;
      const da = dayAvailability(availByOp[opId], dateStr);
      if (da.hasRecord && !da.available) {
        const reasons = da.blocked ? ["Blocked date"] : ["Not available this day"];
        setOverride({ open: true, operatorName: op.full_name, dateLabel, reasons, confirm: (note) => onCreate(op, dateStr, regFor, note) });
      } else {
        onCreate(op, dateStr, regFor);
      }
    } else if (shiftId) {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift || shift.date === dateStr) return;
      const moveTarget = groupBy === "register" ? registerId : null;
      const da = dayAvailability(availByOp[shift.operator_id], dateStr);
      if (da.hasRecord && !da.available) {
        const reasons = da.blocked ? ["Blocked date"] : ["Not available this day"];
        setOverride({ open: true, operatorName: shift.operator_name, dateLabel, reasons, confirm: (note) => onMove(shift, dateStr, moveTarget, note) });
      } else {
        onMove(shift, dateStr, moveTarget);
      }
    }
  };

  const allowDrop = (e) => { e.preventDefault(); };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const thisWeek = () => setCurrentDate(new Date());

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <div className="flex-1 min-w-0 flex flex-col">
      <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronLeft className="w-4 h-4 text-gray-600" /></button>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronRight className="w-4 h-4 text-gray-600" /></button>
          <button onClick={thisWeek} className="ml-1 px-3 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">Today</button>
          <span className="text-sm font-semibold text-gray-900 ml-2">
            Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <LaborCostIndicator
            weekShifts={weekShifts}
            operators={operators}
            payRates={payRates}
            laborBudget={laborBudget}
            overtimeThreshold={overtimeThreshold}
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition border border-gray-200 text-gray-600 hover:bg-gray-50"
                title="Preferred days & FT/PT status"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Availability
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <AvailabilitySidePanel
                operators={pool}
                records={availability}
                conflictMode={conflictMode}
                conflictsByOp={conflictsByOp}
                embedded
              />
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setConflictMode(v => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition border ${conflictMode ? "bg-red-50 border-red-300 text-red-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            title="Highlight shifts that don't match availability or exceed max hours"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Conflict Mode: {conflictMode ? "On" : "Off"}
          </button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => onGroupByChange("position")} className={`px-3 py-1 text-xs font-medium rounded-md transition ${groupBy === "position" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>By Position</button>
            <button onClick={() => onGroupByChange("register")} className={`px-3 py-1 text-xs font-medium rounded-md transition ${groupBy === "register" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>By Register</button>
          </div>
        </div>
      </div>

      {/* Employee pool */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Drag an employee onto a day to schedule</p>
        <div className="flex flex-wrap gap-2">
          {pool.length === 0 && <p className="text-xs text-gray-400">No schedulable operators available.</p>}
          {pool.map(op => {
            const rec = availByOp[op.operator_id];
            const ftpt = employmentBadge(rec);
            return (
              <div
                key={op.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("operator_id", op.operator_id); e.dataTransfer.effectAllowed = "copy"; setDraggingOp(op.operator_id); }}
                onDragEnd={() => setDraggingOp(null)}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs cursor-grab hover:shadow-sm hover:border-blue-300 transition active:cursor-grabbing"
                title={`${op.full_name} · ${ROLE_LABELS[op.role] || op.role}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: ROLE_DOT[op.role] || "#6b7280" }} />
                <span className="font-medium text-gray-800">{op.full_name}</span>
                {ftpt && (
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${ftpt === "PT" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{ftpt}</span>
                )}
                <span className="text-[10px] text-gray-400">{ROLE_LABELS[op.role]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Day header + coverage metric */}
          <div className="grid border-b border-gray-200 bg-gray-50" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
            <div className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase">{groupBy === "register" ? "Register" : "Position"}</div>
            {days.map((day, idx) => {
              const dateStr = toISO(day);
              const dayShifts = weekShifts.filter(s => s.date === dateStr);
              const cov = coverageFor(day, dayShifts, peakTimes);
              const isUnder = cov.required > 0 && cov.scheduled < cov.required;
              const isOver = cov.required > 0 && cov.scheduled > cov.required * 1.25;
              const tone = cov.required === 0 ? "text-gray-400" : isUnder ? "text-red-600" : isOver ? "text-amber-600" : "text-emerald-600";
              const Icon = cov.required === 0 ? MinusCircle : isUnder ? AlertTriangle : isOver ? AlertTriangle : CheckCircle2;
              return (
                <div key={idx} className="px-2 py-2 text-center border-l border-gray-100">
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xs font-semibold text-gray-900">{dayNames[idx]}</p>
                    {isPast(dateStr) && <Lock className="w-2.5 h-2.5 text-gray-400" />}
                  </div>
                  <p className="text-[11px] text-gray-500">{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  <div className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${tone}`}>
                    <Icon className="w-3 h-3" />
                    {cov.scheduled}/{cov.required} hrs
                  </div>
                  <button
                    onClick={() => setUtilDay(utilDay === idx ? null : idx)}
                    className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-700 transition"
                    title="Hourly utilization"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${utilDay === idx ? "rotate-180" : ""}`} />
                    Util
                  </button>
                </div>
              );
            })}
          </div>

          {/* Utilization dropdown row */}
          {utilDay !== null && (
            <div className="grid border-b border-gray-200 bg-white" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
              <div className="border-r border-gray-100" />
              {days.map((day, idx) => (
                <div key={idx} className="border-l border-gray-100 p-1.5">
                  {idx === utilDay ? (
                    <DayUtilizationChart dayDate={day} dayShifts={weekShifts.filter(s => s.date === toISO(day))} peakTimes={peakTimes} />
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No rows for this week. Drag an employee onto a day to begin.</div>
          ) : (
            rows.map((row) => (
              <div key={row.key} className="grid border-b border-gray-50 hover:bg-gray-50/30" style={{ gridTemplateColumns: `160px repeat(7, 1fr)` }}>
                <div className="px-3 py-3 flex items-center gap-2 border-r border-gray-100">
                  {groupBy === "position" && <span className="w-2.5 h-2.5 rounded-full" style={{ background: ROLE_DOT[row.key] || "#6b7280" }} />}
                  <span className="text-sm font-medium text-gray-800 truncate">{row.label}</span>
                </div>
                {days.map((day, dayIdx) => {
                  const dateStr = toISO(day);
                  const cellShifts = weekShifts.filter(s => s.date === dateStr && matchRow(s, row.key));
                  const cellKey = `${row.key}|${dateStr}`;
                  const isOver = dragOver === cellKey;
                  const dayPast = isPast(dateStr);
                  const dragBlocked = (draggingOp && !dayAvailability(availByOp[draggingOp], dateStr).available) || dayPast;
                  return (
                    <div
                      key={dayIdx}
                      onDragOver={(e) => { allowDrop(e); setDragOver(cellKey); }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={(e) => handleDrop(e, row.key, dateStr, row.key)}
                      className={`relative min-h-[88px] px-1.5 py-1.5 border-l border-gray-100 transition ${dayPast ? "bg-gray-100/60" : dragBlocked ? "bg-gray-200/70" : isOver ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-gray-50/40"}`}
                    >
                      {(dragBlocked || dayPast) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          {dayPast ? <Lock className="w-4 h-4 text-gray-300" /> : <Ban className="w-5 h-5 text-gray-400/70" />}
                        </div>
                      )}
                      <div className="space-y-1">
                        {cellShifts.map(shift => {
                          const role = opById[shift.operator_id]?.role;
                          const conflict = conflictMode ? shiftAvailabilityConflict(shift, availByOp[shift.operator_id], weekShifts) : null;
                          const ftpt = employmentBadge(availByOp[shift.operator_id]);
          const shiftPast = isPast(shift.date);
          return (
            <div
              key={shift.id}
              draggable={!shiftPast}
              onDragStart={(e) => { if (shiftPast) { e.preventDefault(); return; } e.dataTransfer.setData("shift_id", shift.id); e.dataTransfer.effectAllowed = "move"; setDraggingOp(shift.operator_id); }}
              onDragEnd={() => setDraggingOp(null)}
              onClick={() => { if (!shiftPast) onEdit(shift); }}
              className={`group bg-white border rounded-lg px-2 py-1.5 text-xs ${shiftPast ? "cursor-default opacity-70" : "cursor-pointer hover:shadow-sm"} transition h-[58px] flex flex-col justify-center ${conflict?.conflict ? "ring-1 ring-red-400 border-red-300 bg-red-50/40" : ""}`}
              style={{ borderLeftColor: conflict?.conflict ? "#ef4444" : (ROLE_DOT[role] || "#6b7280"), borderLeftWidth: 3 }}
              title={[shiftPast ? "Past day — locked" : "", conflict?.conflict ? conflict.reasons.join(" · ") : "", shift.notes, groupBy !== "register" && shift.register_name].filter(Boolean).join(" · ")}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {shiftPast && <Lock className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />}
                  <p className="font-semibold text-gray-900 truncate">{shift.operator_name}</p>
                  {ftpt && <span className={`text-[8px] font-bold px-0.5 py-0.5 rounded ${ftpt === "PT" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{ftpt}</span>}
                  {conflict?.conflict && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                </div>
                {!shiftPast && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(shift); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition flex-shrink-0"
                    title="Delete shift"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="flex items-center gap-1 text-gray-600 truncate">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{shift.start_time}–{shift.end_time}</span>
              </p>
              {shift.lunch_start && shift.lunch_end && (
                <p className="flex items-center gap-1 text-purple-600 truncate">
                  <Utensils className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{shift.lunch_start}–{shift.lunch_end}</span>
                </p>
              )}
            </div>
          );
        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-600" /> Under-scheduled</span>
        <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Over-scheduled</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Balanced</span>
        <span className="ml-auto flex items-center gap-1 text-gray-400"><UserPlus className="w-3 h-3" /> Drag from the pool above to schedule an employee.</span>
      </div>
      </div>
      <AvailabilityOverrideDialog
        open={override.open}
        onOpenChange={(v) => setOverride(prev => ({ ...prev, open: v }))}
        operatorName={override.operatorName}
        dateLabel={override.dateLabel}
        reasons={override.reasons}
        onConfirm={async (note) => { const fn = override.confirm; setOverride(prev => ({ ...prev, open: false })); if (fn) await fn(note); }}
      />
    </div>
  );
}