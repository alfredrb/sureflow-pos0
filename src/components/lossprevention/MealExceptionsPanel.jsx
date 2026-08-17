import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Utensils, RefreshCw, CheckCircle2, Search, Clock, AlertTriangle, ShieldCheck, Loader2, FolderSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import moment from "moment";

const TYPE_META = {
  not_taken: { label: "Lunch Not Taken", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  late: { label: "Late Lunch", icon: Clock, color: "text-amber-600 bg-amber-50" },
  override: { label: "Work-Past-Lunch Override", icon: ShieldCheck, color: "text-blue-600 bg-blue-50" },
};

const LATE_THRESHOLD_MIN = 15;

const adminName = () => { try { return JSON.parse(sessionStorage.getItem("admin_operator"))?.full_name || "Admin"; } catch { return "Admin"; } };
const adminId = () => { try { return JSON.parse(sessionStorage.getItem("admin_operator"))?.operator_id || ""; } catch { return ""; } };

const keyOf = (f) => f.exception_type === "override"
  ? `override|${f.register_log_id || ""}`
  : `${f.exception_type}|${f.operator_id || ""}|${f.shift_date || ""}`;

export default function MealExceptionsPanel({ fromDate, toDate, onStartInvestigation }) {
  const [exceptions, setExceptions] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterAck, setFilterAck] = useState("all");
  const [search, setSearch] = useState("");
  const [ackTarget, setAckTarget] = useState(null);
  const [ackNote, setAckNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadAll = async () => {
    try {
      const [ex, sh, en, lg] = await Promise.all([
        base44.entities.MealException.list("-created_date", 1000),
        base44.entities.Shift.list("-date", 1000),
        base44.entities.TimeClockEntry.list("-clock_in", 1000),
        base44.entities.RegisterLog.list("-created_date", 1000),
      ]);
      setExceptions(ex || []);
      setShifts(sh || []);
      setEntries(en || []);
      setLogs(lg || []);
    } catch (e) {
      toast({ title: "Failed to load", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);
  useRealtimeSync("MealException", () => loadAll(), { intervalMs: 30000 });

  const inRange = (d) => {
    if (!d) return false;
    const day = (typeof d === "string" ? d : moment(d).format("YYYY-MM-DD")).slice(0, 10);
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
  };

  // Detect exceptions from shifts + timeclock entries + register logs (browser
  // local time, so scheduled HH:MM compares correctly against meal_start ISOs).
  const detected = useMemo(() => {
    const now = new Date();
    const found = [];
    const entriesFor = (opId, date) => entries.filter(e => e.operator_id === opId && (e.date === date || (e.clock_in && e.clock_in.slice(0, 10) === date)));

    shifts.forEach((s) => {
      if (!s.lunch_start || !s.date) return;
      if (!inRange(s.date)) return;
      const dayEntries = entriesFor(s.operator_id, s.date);
      const shiftEnd = s.end_time ? new Date(s.date + "T" + s.end_time + ":00") : null;
      const shiftEnded = shiftEnd ? now >= shiftEnd : false;

      if (shiftEnded) {
        const hasMeal = dayEntries.some(e => e.meal_start && e.meal_end);
        if (!hasMeal) {
          found.push({
            exception_type: "not_taken",
            operator_id: s.operator_id, operator_name: s.operator_name, register_id: s.register_id || "",
            shift_date: s.date, scheduled_lunch_start: s.lunch_start, scheduled_lunch_end: s.lunch_end || "",
            detail: `Scheduled lunch ${s.lunch_start}${s.lunch_end ? `–${s.lunch_end}` : ""} was never recorded by end of shift.`,
          });
        }
      }

      if (s.lunch_start) {
        const schedLunch = new Date(s.date + "T" + s.lunch_start + ":00");
        dayEntries.forEach((e) => {
          if (!e.meal_start) return;
          const minsLate = Math.round((new Date(e.meal_start) - schedLunch) / 60000);
          if (minsLate >= LATE_THRESHOLD_MIN) {
            found.push({
              exception_type: "late",
              operator_id: s.operator_id, operator_name: s.operator_name || e.operator_name, register_id: s.register_id || e.register_id || "",
              shift_date: s.date, scheduled_lunch_start: s.lunch_start, scheduled_lunch_end: s.lunch_end || "",
              actual_meal_start: e.meal_start, actual_meal_end: e.meal_end || "", minutes_late: minsLate,
              detail: `Lunch started ${minsLate} min after scheduled ${s.lunch_start}.`,
            });
          }
        });
      }
    });

    logs.forEach((l) => {
      if (l.override_action !== "Lunch Lockout Override") return;
      const day = (l.created_date || "").slice(0, 10);
      if (!inRange(day)) return;
      found.push({
        exception_type: "override",
        operator_id: l.operator_id || "", operator_name: l.operator_name || "", register_id: l.register_id || "",
        shift_date: day, detail: l.detail || "Supervisor authorized working past scheduled lunch.",
        override_operator_id: l.override_operator_id || "", override_operator_name: l.override_operator_name || "",
        register_log_id: l.id,
      });
    });

    return found;
  }, [shifts, entries, logs, fromDate, toDate]);

  // Auto-log (persist) any detected exceptions that aren't stored yet.
  useEffect(() => {
    if (loading || detected.length === 0) return;
    const existingKeys = new Set(exceptions.map(keyOf));
    const toCreate = detected.filter(d => !existingKeys.has(keyOf(d)));
    if (toCreate.length === 0) return;
    base44.entities.MealException.bulkCreate(toCreate).then(() => loadAll()).catch(() => {});
    // eslint-disable-next-line
  }, [loading, detected.length]);

  const scanNow = async () => {
    setScanning(true);
    try {
      const fresh = await base44.entities.MealException.list("-created_date", 1000);
      const freshKeys = new Set((fresh || []).map(keyOf));
      const toCreate = detected.filter(d => !freshKeys.has(keyOf(d)));
      if (toCreate.length > 0) {
        await base44.entities.MealException.bulkCreate(toCreate);
        toast({ title: `Logged ${toCreate.length} new meal exception${toCreate.length === 1 ? "" : "s"}` });
        await loadAll();
      } else {
        setExceptions(fresh);
        toast({ title: "Up to date", description: "No new meal exceptions detected." });
      }
    } catch (e) {
      toast({ title: "Scan failed", description: String(e.message || e), variant: "destructive" });
    }
    setScanning(false);
  };

  const acknowledge = async () => {
    if (!ackTarget) return;
    setSaving(true);
    try {
      await base44.entities.MealException.update(ackTarget.id, {
        acknowledged: true,
        acknowledged_by: adminName(),
        acknowledged_by_id: adminId(),
        acknowledged_at: new Date().toISOString(),
        ack_note: ackNote.trim(),
      });
      toast({ title: "Acknowledged" });
      setAckTarget(null); setAckNote("");
      await loadAll();
    } catch (e) {
      toast({ title: "Failed to acknowledge", variant: "destructive" });
    }
    setSaving(false);
  };

  const filtered = exceptions.filter((e) => {
    if (!inRange(e.shift_date)) return false;
    if (filterType !== "all" && e.exception_type !== filterType) return false;
    if (filterAck === "ack" && !e.acknowledged) return false;
    if (filterAck === "unack" && e.acknowledged) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(e.operator_name || "").toLowerCase().includes(q) && !(e.operator_id || "").toLowerCase().includes(q) && !(e.detail || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: filtered.length,
    unack: filtered.filter(e => !e.acknowledged).length,
    not_taken: filtered.filter(e => e.exception_type === "not_taken").length,
    late: filtered.filter(e => e.exception_type === "late").length,
    override: filtered.filter(e => e.exception_type === "override").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center p-10">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2">
          <Utensils className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500">Meal exceptions track lunches not taken, lunches taken late, and supervisor overrides that let an operator work past a scheduled lunch.</p>
        </div>
        <Button onClick={scanNow} disabled={scanning} className="bg-amber-600 hover:bg-amber-500 flex-shrink-0">
          {scanning ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
          {scanning ? "Scanning..." : "Scan Now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Unacknowledged", value: stats.unack, color: "text-red-600" },
          { label: "Not Taken", value: stats.not_taken, color: "text-red-600" },
          { label: "Late", value: stats.late, color: "text-amber-600" },
          { label: "Override", value: stats.override, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search operator or detail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="not_taken">Not Taken</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="override">Override</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAck} onValueChange={setFilterAck}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unack">Unacknowledged</SelectItem>
            <SelectItem value="ack">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Operator</th>
                <th className="px-4 py-3 text-left">Detail</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <FolderSearch className="w-8 h-8 text-gray-200" />
                    No meal exceptions in range
                  </div>
                </td></tr>
              ) : filtered.map((e) => {
                const meta = TYPE_META[e.exception_type] || TYPE_META.not_taken;
                const Icon = meta.icon;
                return (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.shift_date}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${meta.color}`}>
                        <Icon className="w-3 h-3" />{meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.operator_name || "—"}</p>
                      <p className="text-[11px] text-gray-400">{e.operator_id || ""}{e.register_id ? ` · ${e.register_id}` : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-md">
                      <p className="text-xs leading-relaxed">{e.detail}</p>
                      {e.minutes_late ? <p className="text-[11px] text-amber-600 mt-0.5">{e.minutes_late} min late</p> : null}
                      {e.override_operator_name ? <p className="text-[11px] text-blue-600 mt-0.5">Authorized by {e.override_operator_name}</p> : null}
                      {e.acknowledged && e.acknowledged_by ? <p className="text-[11px] text-emerald-600 mt-0.5">Ack by {e.acknowledged_by}{e.acknowledged_at ? ` · ${moment(e.acknowledged_at).format("MMM D, h:mm A")}` : ""}{e.ack_note ? ` — ${e.ack_note}` : ""}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      {e.acknowledged
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="w-3.5 h-3.5" /> Open</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!e.acknowledged && (
                        <Button size="sm" variant="outline" onClick={() => { setAckTarget(e); setAckNote(""); }} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 mr-1.5">Acknowledge</Button>
                      )}
                      <button onClick={() => onStartInvestigation({
                        type: "meal_exception",
                        operator_name: e.operator_name || "",
                        operator_id: e.operator_id || "",
                        register_id: e.register_id || "",
                        title: `Meal Exception — ${meta.label} — ${e.operator_name || "—"} — ${e.shift_date}`,
                        summary: e.detail || "",
                      })} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                        <FolderSearch className="w-3.5 h-3.5" /> Investigate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!ackTarget} onOpenChange={(v) => { if (!v) { setAckTarget(null); setAckNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Acknowledge Meal Exception</DialogTitle>
          </DialogHeader>
          {ackTarget && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-medium text-gray-900">{ackTarget.operator_name || "—"} · {ackTarget.shift_date}</p>
                <p className="text-gray-600 mt-1">{ackTarget.detail}</p>
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Textarea rows={3} value={ackNote} onChange={e => setAckNote(e.target.value)} placeholder="Add a note about this acknowledgment..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAckTarget(null); setAckNote(""); }}>Cancel</Button>
            <Button onClick={acknowledge} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500">{saving ? "Saving..." : "Acknowledge"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}