import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Clock, Wallet, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";

const getWeekStart = (date) => { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d; };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function WeeklyHoursBudget({ shifts, peakTimes }) {
  const { toast } = useToast();
  const [budget, setBudget] = useState(0);
  const [settingsId, setSettingsId] = useState(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null);

  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const startStr = toISO(weekStart), endStr = toISO(weekEnd);
  const currentMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

  const weekShifts = useMemo(() => shifts.filter(s => s.date >= startStr && s.date <= endStr), [shifts, startStr, endStr]);

  const scheduledPerDay = useMemo(() => {
    const map = {}; for (let i = 0; i < 7; i++) map[i] = 0;
    weekShifts.forEach(s => {
      if (!s.start_time || !s.end_time) return;
      const dow = new Date(s.date + "T00:00:00").getDay();
      const [shh, shm] = s.start_time.split(":").map(Number);
      const [ehh, em] = s.end_time.split(":").map(Number);
      let hrs = (ehh * 60 + em - (shh * 60 + shm)) / 60; if (hrs < 0) hrs += 24;
      map[dow] += Math.max(0, hrs);
    });
    return map;
  }, [weekShifts]);

  const requiredPerDay = useMemo(() => {
    const map = {}; for (let i = 0; i < 7; i++) map[i] = 0;
    peakTimes.forEach(p => { if (p.hour >= 6 && p.hour <= 22) map[p.day_of_week] += (p.required_staff || 1); });
    return map;
  }, [peakTimes]);

  const totalScheduled = Object.values(scheduledPerDay).reduce((a, b) => a + b, 0);
  const totalRequired = Object.values(requiredPerDay).reduce((a, b) => a + b, 0);

  // Weekly hours target now lives on the Store Budget record (current month)
  // in the Financials & Budget page and reflects back here as read-only.
  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.StoreBudget.list("-month", 100);
        const b = list.find(x => x.month === currentMonth);
        setBudget(b?.weekly_hours_budget || 0);
      } catch (e) { console.error(e); }
    })();
  }, [currentMonth]);

  const recommend = async () => {
    setRecommending(true);
    try {
      const peakSummary = {};
      for (let dow = 0; dow < 7; dow++) {
        const hours = peakTimes.filter(p => p.day_of_week === dow && p.hour >= 6 && p.hour <= 22).sort((a, b) => a.hour - b.hour)
          .map(p => `${String(p.hour).padStart(2, "0")}:00=${p.required_staff || 1}`);
        peakSummary[dow] = hours.join(", ") || "none";
      }
      const schedSummary = Object.entries(scheduledPerDay).map(([d, h]) => `${DAY_NAMES[d]}=${Math.round(h * 10) / 10}`).join(", ");
      const prompt = `You are a retail labor planner. Recommend a balanced weekly hours plan for one store.
Operating hours 06:00–22:00. Weekly hour budget cap: ${budget} hours (0 = no cap).
Peak-time required staff-hours by day (Sun..Sat): ${Object.entries(peakSummary).map(([d, h]) => `${DAY_NAMES[d]}: ${h}`).join(" | ")}
Currently scheduled staff-hours by day: ${schedSummary}
Total currently scheduled: ${Math.round(totalScheduled * 10) / 10} hrs. Total required: ${totalRequired} hrs.

Produce a recommended per-day hours allocation that:
- Covers peak demand each day (meet or slightly exceed required staff-hours).
- Stays within the weekly budget cap when set (>0). If required exceeds budget, prioritize the busiest days/hours and note the shortfall.
- Balances across the week, avoiding over-scheduling quiet days.

Return JSON: { "total_recommended": number, "per_day": [ {day_of_week:0-6, day_name:string, recommended_hours:number, reason:string} ], "notes": string }`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            total_recommended: { type: "number" },
            per_day: { type: "array", items: { type: "object", properties: { day_of_week: { type: "number" }, day_name: { type: "string" }, recommended_hours: { type: "number" }, reason: { type: "string" } } } },
            notes: { type: "string" }
          }
        }
      });
      setRecommendation(res);
      toast({ title: "AI hours recommendation ready" });
    } catch (e) { console.error(e); toast({ title: "Error generating recommendation", variant: "destructive" }); }
    setRecommending(false);
  };

  const chartData = useMemo(() => {
    const rec = recommendation?.per_day || [];
    return Array.from({ length: 7 }, (_, i) => {
      const r = rec.find(x => x.day_of_week === i);
      return {
        day: DAY_NAMES[i],
        Scheduled: Math.round(scheduledPerDay[i] * 10) / 10,
        Required: requiredPerDay[i],
        Recommended: r ? Math.round(r.recommended_hours * 10) / 10 : 0
      };
    });
  }, [recommendation, scheduledPerDay, requiredPerDay]);

  const overBudget = budget > 0 && totalScheduled > budget;
  const recTotal = recommendation?.total_recommended;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center"><Wallet className="w-4 h-4 text-indigo-600" /></div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Weekly Hours Budget</h2>
            <p className="text-xs text-gray-500">Week of {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Store budget (hrs/wk)</label>
            <div className="flex items-center gap-1.5" title="Set this target in Financials & Budget → Store Budget">
              <Input type="number" min={0} value={budget} disabled className="w-24 h-8 opacity-70" />
              <span className="text-[10px] text-gray-400 italic">set in Financials</span>
            </div>
          </div>
          <Button onClick={recommend} disabled={recommending} className="bg-indigo-600 hover:bg-indigo-700">
            {recommending ? <><Sparkles className="w-4 h-4 mr-2 animate-pulse" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-2" /> AI Recommend</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Scheduled</p>
          <p className={`text-xl font-bold ${overBudget ? "text-red-600" : "text-gray-900"}`}>{Math.round(totalScheduled * 10) / 10}<span className="text-xs font-normal text-gray-400"> hrs</span></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Required</p>
          <p className="text-xl font-bold text-gray-900">{totalRequired}<span className="text-xs font-normal text-gray-400"> hrs</span></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500">Budget</p>
          <p className="text-xl font-bold text-gray-900">{budget > 0 ? budget : "—"}{budget > 0 && <span className="text-xs font-normal text-gray-400"> hrs</span>}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-gray-500">AI Recommended</p>
          <p className="text-xl font-bold text-indigo-600">{recTotal != null ? recTotal : "—"}{recTotal != null && <span className="text-xs font-normal text-gray-400"> hrs</span>}</p>
        </div>
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Required" fill="#10b981" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Scheduled" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            {recommendation && <Bar dataKey="Recommended" fill="#8b5cf6" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {recommendation?.notes && (
        <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
          <p className="text-xs text-indigo-900 whitespace-pre-wrap">{recommendation.notes}</p>
        </div>
      )}
    </div>
  );
}