import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";

export default function StaffingVsRevenueChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("7days");

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      const now = new Date();
      let startDate = new Date();

      if (dateRange === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (dateRange === "7days") {
        startDate.setDate(now.getDate() - 7);
      } else if (dateRange === "30days") {
        startDate.setDate(now.getDate() - 30);
      }

      const [transactions, shifts] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 2000),
        base44.entities.Shift.filter({ status: { $in: ["active", "completed"] } })
      ]);

      // Group data by date
      const dataMap = {};

      // Process transactions by date
      transactions
        .filter((tx) => new Date(tx.created_date) >= startDate && tx.status === "completed")
        .forEach((tx) => {
          const date = new Date(tx.created_date).toLocaleDateString("en-US");
          if (!dataMap[date]) {
            dataMap[date] = { date, revenue: 0, staffCount: 0 };
          }
          dataMap[date].revenue += tx.total || 0;
        });

      // Count active staff by date (assuming shift dates)
      shifts
        .filter((shift) => new Date(shift.date) >= startDate)
        .forEach((shift) => {
          if (!dataMap[shift.date]) {
            dataMap[shift.date] = { date: shift.date, revenue: 0, staffCount: 0 };
          }
          dataMap[shift.date].staffCount += 1;
        });

      const sorted = Object.values(dataMap)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30); // Last 30 days max

      setChartData(sorted);
    } catch (e) {
      console.error("Error loading chart data:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  if (chartData.length === 0) {
    return <div className="text-center text-gray-500 p-8">No data available for selected range</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Revenue vs Staffing</h2>
          <p className="text-sm text-gray-500 mt-1">Sales revenue overlay with staff count by date</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 20, right: 80, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" label={{ value: "Revenue ($)", angle: -90, position: "insideLeft" }} tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: "Staff Count", angle: 90, position: "insideRight" }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
            formatter={(val) => (typeof val === "number" ? val.toFixed(2) : val)}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue ($)" radius={[8, 8, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="staffCount" stroke="#ef4444" strokeWidth={3} dot={{ fill: "#ef4444", r: 5 }} name="Staff Count" />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-700 font-medium">Avg Daily Revenue</p>
          <p className="text-xl font-bold text-blue-900">
            ${(chartData.reduce((sum, d) => sum + (d.revenue || 0), 0) / chartData.length).toFixed(2)}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
          <p className="text-xs text-red-700 font-medium">Avg Staff per Day</p>
          <p className="text-xl font-bold text-red-900">
            {(chartData.reduce((sum, d) => sum + (d.staffCount || 0), 0) / chartData.length).toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}