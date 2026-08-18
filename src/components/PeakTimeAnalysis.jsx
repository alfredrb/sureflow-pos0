import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw, Sparkles, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// AI-driven peak-time analysis. Auto-runs on mount when no data exists or the
// last analysis is older than 24h. Uses InvokeLLM to classify each operating
// hour's demand and recommend staffing from the transaction histogram.
export default function PeakTimeAnalysis() {
  const [peakTimes, setPeakTimes] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoRan, setAutoRan] = useState(false);
  const [summary, setSummary] = useState("");
  const { toast } = useToast();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const loadPeakTimes = async () => {
    try {
      const data = await base44.entities.PeakTime.list("-created_date", 500);
      setPeakTimes(data);
      return data;
    } catch (e) {
      console.error("Error loading peak times:", e);
    }
  };

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 3000);

      const hist = {};
      for (let d = 0; d < 7; d++) { hist[d] = {}; for (let h = 0; h < 24; h++) hist[d][h] = { count: 0, volume: 0 }; }
      transactions.forEach((tx) => {
        if (tx.status !== "completed" || tx.training_mode) return;
        const date = new Date(tx.sale_date || tx.created_date);
        if (!date || isNaN(date.getTime())) return;
        hist[date.getDay()][date.getHours()].count += 1;
        hist[date.getDay()][date.getHours()].volume += tx.total || 0;
      });

      const summaryData = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 6; h <= 22; h++) {
          summaryData.push({ day: d, hour: h, tx: hist[d][h].count, vol: Math.round(hist[d][h].volume) });
        }
      }

      const prompt = `You are a retail workforce planner. Given transaction counts per day-of-week/hour for a store open 06:00-22:00, classify each operating hour's demand level and recommend staffing.
Data (JSON array of {day:0-6, hour, tx:transaction_count, vol:revenue}):
${JSON.stringify(summaryData)}

Rules:
- day 0=Sunday..6=Saturday.
- peak_level: one of "low", "medium", "high", "very_high" based on relative transaction volume within each day, and known retail rush patterns (lunch 11-13, evening 16-19, weekend spikes) when supported by data.
- required_staff: 1 for low, 2 for medium, 3 for high, 4 for very_high. You may raise by 1 for the very busiest hours.
- Only return operating hours (6 through 22).
Return JSON with "hours" (array of {day_of_week, hour, peak_level, required_staff}) and a one-sentence "summary" of the key staffing insight.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            hours: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day_of_week: { type: "number" },
                  hour: { type: "number" },
                  peak_level: { type: "string" },
                  required_staff: { type: "number" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      const aiHours = Array.isArray(res?.hours) ? res.hours : [];
      const aiMap = {};
      aiHours.forEach(a => { aiMap[`${a.day_of_week}|${a.hour}`] = a; });

      // Delete old peak times in batches.
      const all = await base44.entities.PeakTime.list("-created_date", 1000);
      for (let i = 0; i < all.length; i += 100) {
        await Promise.all(all.slice(i, i + 100).map(p => base44.entities.PeakTime.delete(p.id)));
      }

      const now = new Date().toISOString();
      const records = [];
      for (let d = 0; d < 7; d++) {
        for (let h = 0; h < 24; h++) {
          const a = aiMap[`${d}|${h}`];
          records.push({
            day_of_week: d,
            hour: h,
            transaction_count: hist[d][h].count,
            transaction_volume: Math.round(hist[d][h].volume * 100) / 100,
            peak_level: a?.peak_level || "low",
            required_staff: a?.required_staff || 0,
            last_updated: now
          });
        }
      }
      for (let i = 0; i < records.length; i += 200) {
        await base44.entities.PeakTime.bulkCreate(records.slice(i, i + 200));
      }

      setSummary(res?.summary || "");
      toast({ title: "AI peak-time analysis complete", description: `${aiHours.length} operating hours classified` });
      await loadPeakTimes();
    } catch (e) {
      console.error("Error running AI analysis:", e);
      toast({ title: "Error running AI analysis", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  useEffect(() => {
    (async () => {
      const data = await loadPeakTimes();
      setLoading(false);
      if (!autoRan) {
        const latest = data && data[0]?.last_updated;
        const stale = !latest || (Date.now() - new Date(latest).getTime()) > 24 * 3600 * 1000;
        if (stale) {
          setAutoRan(true);
          runAIAnalysis();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dayPeakData = peakTimes
    .filter((p) => p.day_of_week === selectedDay)
    .sort((a, b) => a.hour - b.hour)
    .map((p) => ({
      hour: `${String(p.hour).padStart(2, "0")}:00`,
      transactions: p.transaction_count || 0,
      volume: Math.round((p.transaction_volume || 0) * 100) / 100,
      staff: p.required_staff || 0,
    }));

  if (loading) {
    return <div className="flex justify-center"><div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" /> Peak Time Analysis
            {analyzing && <span className="text-xs font-normal text-emerald-600 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> AI analyzing…</span>}
          </h2>
          <p className="text-xs text-gray-500 mt-1">AI-classified staffing needs based on historical transaction data — auto-refreshes daily.</p>
        </div>
        <Button size="sm" onClick={runAIAnalysis} disabled={analyzing} className="bg-green-600 hover:bg-green-700">
          <RefreshCw className={`w-3 h-3 mr-1 ${analyzing ? "animate-spin" : ""}`} /> Re-run AI
        </Button>
      </div>

      {summary && (
        <div className="mb-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-900">{summary}</p>
        </div>
      )}

      <div className="mb-4 flex gap-2 flex-wrap">
        {dayNames.map((day, idx) => (
          <button key={idx} onClick={() => setSelectedDay(idx)} className={`px-3 py-1 rounded-md text-sm font-medium transition ${selectedDay === idx ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{day}</button>
        ))}
      </div>

      {dayPeakData.length === 0 ? (
        <p className="text-sm text-gray-500 flex items-center gap-2"><Lock className="w-4 h-4" /> No data yet — the AI analysis runs automatically once transactions exist.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dayPeakData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }} formatter={(val) => (typeof val === "number" ? val.toFixed(2) : val)} />
            <Legend />
            <Bar yAxisId="left" dataKey="transactions" fill="#3b82f6" name="Transactions" />
            <Bar yAxisId="right" dataKey="staff" fill="#10b981" name="Recommended Staff" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}