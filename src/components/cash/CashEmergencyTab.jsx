export default function CashEmergencyTab({ robberies }) {
  if (robberies.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-100">
        <p className="text-sm">No robbery incidents recorded</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-red-50 border-b border-red-200">
          <tr>
            <th className="text-left px-4 py-3 font-bold text-red-700">Date &amp; Time</th>
            <th className="text-left px-4 py-3 font-bold text-red-700">Register</th>
            <th className="text-left px-4 py-3 font-bold text-red-700">Operator</th>
            <th className="text-right px-4 py-3 font-bold text-red-700">Amount Stolen</th>
            <th className="text-left px-4 py-3 font-bold text-red-700">Notes</th>
          </tr>
        </thead>
        <tbody>
          {robberies.map((rob, idx) => (
            <tr key={rob.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-red-50/20"}`}>
              <td className="px-4 py-3 text-gray-900 font-medium">{new Date(rob.created_date).toLocaleString()}</td>
              <td className="px-4 py-3 font-mono text-gray-600">{rob.register_id}</td>
              <td className="px-4 py-3 text-gray-600">
                <div>{rob.operator_name}</div>
                <div className="text-gray-400 text-xs">{rob.operator_id}</div>
              </td>
              <td className="px-4 py-3 font-bold text-right text-red-600">${rob.amount_stolen?.toFixed(2) || "0.00"}</td>
              <td className="px-4 py-3 text-gray-600 text-xs">{rob.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-red-50 border-t border-red-200">
          <tr>
            <td colSpan="3" className="px-4 py-3 font-bold text-red-700">Total Amount Stolen</td>
            <td className="px-4 py-3 font-bold text-right text-red-600">
              ${robberies.reduce((sum, r) => sum + (r.amount_stolen || 0), 0).toFixed(2)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}