import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingDown, TrendingUp, AlertCircle } from "lucide-react";

export default function AdminCashDiscrepancies() {
  const [deposits, setDeposits] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await base44.entities.EODCashDeposit.list("-report_date", 500);
      setDeposits(data);
      const uniqueRegs = ["all", ...new Set(data.map(d => d.register_id).filter(Boolean))];
      setRegisters(uniqueRegs);
      setLoading(false);
    })();
  }, []);

  const filtered = selectedRegister === "all" 
    ? deposits 
    : deposits.filter(d => d.register_id === selectedRegister);

  const chartData = filtered
    .sort((a, b) => new Date(a.report_date) - new Date(b.report_date))
    .map(d => ({
      date: new Date(d.report_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      register: d.register_name || d.register_id,
      difference: d.difference || 0,
      expected: d.expected_cash || 0,
      actual: d.actual_cash_deposited || 0,
    }));

  const registerSummaries = filtered.reduce((acc, d) => {
    const key = d.register_id;
    if (!acc[key]) {
      acc[key] = { register: d.register_name || d.register_id, totalDifference: 0, count: 0, shortages: 0, overages: 0 };
    }
    acc[key].totalDifference += d.difference || 0;
    acc[key].count += 1;
    if ((d.difference || 0) < 0) acc[key].shortages += 1;
    if ((d.difference || 0) > 0) acc[key].overages += 1;
    return acc;
  }, {});

  const summaryData = Object.values(registerSummaries)
    .sort((a, b) => Math.abs(b.totalDifference) - Math.abs(a.totalDifference));

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 h-full flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-amber-600" /> Cash Discrepancies
        </h1>
        <p className="text-gray-500 text-sm mt-1">Track shortages and overages in daily reconciliation</p>
      </div>

      {/* Register Filter */}
      <div className="flex gap-3">
        <select
          value={selectedRegister}
          onChange={(e) => setSelectedRegister(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {registers.map(r => (
            <option key={r} value={r}>{r === "all" ? "All Registers" : r}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 flex items-center">{filtered.length} records</span>
      </div>

      {/* Charts */}
      {chartData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart - Trends */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Discrepancy Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  formatter={(val) => `$${val.toFixed(2)}`}
                />
                <Legend />
                <Line type="monotone" dataKey="difference" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart - Expected vs Actual */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Expected vs Actual</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.slice(-10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  formatter={(val) => `$${val.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="expected" fill="#3b82f6" />
                <Bar dataKey="actual" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          No discrepancy data available
        </div>
      )}

      {/* Summary Table */}
      {summaryData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Register Summary</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Register</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Total Variance</th>
                <th className="text-center px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Shortages</th>
                <th className="text-center px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Overages</th>
                <th className="text-right px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Avg per Day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaryData.map((reg, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="px-4 py-3 font-medium text-gray-900">{reg.register}</td>
                  <td className={`text-right px-4 py-3 font-bold ${reg.totalDifference < 0 ? "text-red-600" : "text-green-600"}`}>
                    {reg.totalDifference < 0 ? "−" : "+"}${Math.abs(reg.totalDifference).toFixed(2)}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <TrendingDown className="w-3.5 h-3.5" /> {reg.shortages}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <TrendingUp className="w-3.5 h-3.5" /> {reg.overages}
                    </span>
                  </td>
                  <td className={`text-right px-4 py-3 font-semibold ${(reg.totalDifference / reg.count) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {(reg.totalDifference / reg.count) < 0 ? "−" : "+"}${Math.abs(reg.totalDifference / reg.count).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}