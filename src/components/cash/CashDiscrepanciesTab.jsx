import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const dayLabel = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function CashDiscrepanciesTab({ deposits, tillCheckouts, selectedRegister, onSelectRegister, renderPushBtn }) {
  const checkedIn = tillCheckouts.filter((t) => t.status === "checked_in" && t.discrepancy !== undefined);
  const inScope = (rid) => selectedRegister === "all" || rid === selectedRegister;
  const depositRows = deposits.filter((d) => inScope(d.register_id)).sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
  const tillRows = checkedIn.filter((t) => inScope(t.register_id)).sort((a, b) => new Date(b.checkin_date) - new Date(a.checkin_date));

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={selectedRegister}
          onChange={(e) => onSelectRegister(e.target.value)}
          className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Registers</option>
          {[...new Set([...deposits.map((d) => d.register_id), ...tillCheckouts.map((t) => t.register_id)].filter(Boolean))].map((rid) => (
            <option key={rid} value={rid}>{rid}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 flex items-center">{deposits.length + checkedIn.length} records</span>
      </div>

      {deposits.length === 0 && checkedIn.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-500">No discrepancy data available</div>
      ) : (
        <div className="space-y-6">
          {deposits.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Deposit Discrepancy Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={depositRows.map((d) => ({ date: dayLabel(d.report_date), difference: d.difference || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(val) => `$${val.toFixed(2)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="difference" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Expected vs Actual</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={depositRows.slice(-10).map((d) => ({ date: dayLabel(d.report_date), expected: d.expected_cash || 0, actual: d.actual_cash_deposited || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} formatter={(val) => `$${val.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="expected" fill="#3b82f6" />
                    <Bar dataKey="actual" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {checkedIn.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Till Check-In Discrepancies</h2>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-bold text-gray-700">Date &amp; Time</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-700">Bag #</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-700">Register</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-700">Pulled / Returned By</th>
                      <th className="text-right px-4 py-3 font-bold text-gray-700">Expected ($250)</th>
                      <th className="text-right px-4 py-3 font-bold text-gray-700">Actual</th>
                      <th className="text-right px-4 py-3 font-bold text-gray-700">Discrepancy</th>
                      <th className="text-right px-4 py-3 font-bold text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tillRows.map((till, idx) => (
                      <tr key={till.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-4 py-3 text-gray-900 font-medium">{new Date(till.checkin_date).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono font-bold text-gray-900">
                          {till.bag_number || "—"}
                          {till.forced && (
                            <span
                              className="ml-2 inline-flex px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold"
                              title={`Expected bag ${till.expected_bag_number || "—"} · ${till.force_reason || ""} · ${till.force_manager_name || ""}`}
                            >
                              FORCED
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">{till.register_name}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <div>{till.operator_name || "—"}</div>
                          <div className="text-gray-400 text-xs">↩ {till.checkin_operator_name || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">$250.00</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">${till.checkin_total.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-bold ${till.discrepancy < 0 ? "text-red-600" : "text-green-600"}`}>
                          {till.discrepancy >= 0 ? "+" : ""}${till.discrepancy.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">{(till.discrepancy || 0) !== 0 && renderPushBtn(till, "till")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}