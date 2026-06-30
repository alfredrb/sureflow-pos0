import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function PeakTimeAnalysis() {
  const [peakTimes, setPeakTimes] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  useEffect(() => {
    loadPeakTimes();
  }, []);

  const loadPeakTimes = async () => {
    try {
      const data = await base44.entities.PeakTime.list("-created_date", 500);
      setPeakTimes(data);
    } catch (e) {
      console.error("Error loading peak times:", e);
    }
    setLoading(false);
  };

  const analyzePeakTimes = async () => {
    setAnalyzing(true);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 1000);

      const peakData = {};

      for (let day = 0; day < 7; day++) {
        peakData[day] = {};
        for (let hour = 0; hour < 24; hour++) {
          peakData[day][hour] = { count: 0, volume: 0 };
        }
      }

      transactions.forEach((tx) => {
        if (!tx.created_date || tx.status !== "completed") return;
        const date = new Date(tx.created_date);
        const dayOfWeek = date.getDay();
        const hour = date.getHours();

        peakData[dayOfWeek][hour].count += 1;
        peakData[dayOfWeek][hour].volume += tx.total || 0;
      });

      // Delete old peak times
      const allPeaks = await base44.entities.PeakTime.list("-created_date", 1000);
      for (const peak of allPeaks) {
        await base44.entities.PeakTime.delete(peak.id);
      }

      // Save new peak times
      for (let day = 0; day < 7; day++) {
        const dayData = peakData[day];
        const counts = Object.values(dayData).map((d) => d.count);
        const maxCount = Math.max(...counts);

        for (let hour = 0; hour < 24; hour++) {
          const data = dayData[hour];
          let peakLevel = "low";
          if (maxCount === 0) {
            peakLevel = "low";
          } else if (data.count >= maxCount * 0.75) {
            peakLevel = "very_high";
          } else if (data.count >= maxCount * 0.5) {
            peakLevel = "high";
          } else if (data.count > 0) {
            peakLevel = "medium";
          }

          const requiredStaff =
            peakLevel === "very_high"
              ? 4
              : peakLevel === "high"
                ? 3
                : peakLevel === "medium"
                  ? 2
                  : 1;

          await base44.entities.PeakTime.create({
            day_of_week: day,
            hour,
            transaction_count: data.count,
            transaction_volume: data.volume,
            peak_level: peakLevel,
            required_staff: requiredStaff,
            last_updated: new Date().toISOString(),
          });
        }
      }

      toast({ title: "Peak times analyzed successfully" });
      loadPeakTimes();
    } catch (e) {
      console.error("Error analyzing peak times:", e);
      toast({ title: "Error analyzing peak times", variant: "destructive" });
    }
    setAnalyzing(false);
  };

  const dayPeakData = peakTimes
    .filter((p) => p.day_of_week === selectedDay)
    .sort((a, b) => a.hour - b.hour)
    .map((p) => ({
      hour: `${String(p.hour).padStart(2, "0")}:00`,
      transactions: p.transaction_count || 0,
      volume: Math.round((p.transaction_volume || 0) * 100) / 100,
      staff: p.required_staff || 1,
    }));

  if (loading) {
    return <div className="flex justify-center"><div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Peak Time Analysis</h2>
          <p className="text-xs text-gray-500 mt-1">Staffing needs based on historical transaction data</p>
        </div>
        <Button
          size="sm"
          onClick={analyzePeakTimes}
          disabled={analyzing}
          className="bg-green-600 hover:bg-green-700"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${analyzing ? "animate-spin" : ""}`} />
          Analyze
        </Button>
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {dayNames.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDay(idx)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition ${
              selectedDay === idx
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {dayPeakData.length === 0 ? (
        <p className="text-sm text-gray-500">No data available. Click Analyze to generate peak time data from transactions.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dayPeakData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
              formatter={(val) => (typeof val === "number" ? val.toFixed(2) : val)}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="transactions" fill="#3b82f6" name="Transactions" />
            <Bar yAxisId="right" dataKey="staff" fill="#10b981" name="Recommended Staff" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}