import { Clock, Plus, Minus } from "lucide-react";

export default function CashHistoryTab({ advances, pickups }) {
  const rows = [
    ...advances.map((a) => ({ ...a, _isAdvance: true })),
    ...pickups.map((p) => ({ ...p, _isAdvance: false })),
  ].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-bold text-gray-700">Time</th>
            <th className="text-left px-4 py-3 font-bold text-gray-700">Register</th>
            <th className="text-left px-4 py-3 font-bold text-gray-700">Type</th>
            <th className="text-left px-4 py-3 font-bold text-gray-700">Amount</th>
            <th className="text-left px-4 py-3 font-bold text-gray-700">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="5" className="text-center py-8 text-gray-500">No advances or pickups recorded</td>
            </tr>
          ) : (
            rows.map((item, idx) => (
              <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(item.created_date).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{item.register_name}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${item._isAdvance ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {item._isAdvance ? <Plus className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {item._isAdvance ? "Advance" : "Pickup"}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-gray-900">${item.amount.toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-600">{item.reason || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}