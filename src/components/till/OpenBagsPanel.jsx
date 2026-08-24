import { Briefcase } from "lucide-react";

// Every till still checked out — which bags, and whose cash, are still on the floor.
export default function OpenBagsPanel({ tillCheckouts }) {
  const open = (tillCheckouts || [])
    .filter((t) => t.status === "checked_out")
    .sort((a, b) => new Date(b.checkout_date) - new Date(a.checkout_date));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-sm sm:text-base text-gray-900">Outstanding Bags</h2>
        </div>
        <span className="text-sm text-gray-500">
          {open.length} bag{open.length !== 1 ? "s" : ""} out · ${(open.length * 250).toFixed(2)} expected
        </span>
      </div>
      {open.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">No tills are currently checked out</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-bold text-gray-700">Bag #</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700">Register</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700">Pulled By</th>
                <th className="text-left px-4 py-3 font-bold text-gray-700">Checked Out</th>
                <th className="text-right px-4 py-3 font-bold text-gray-700">Float</th>
              </tr>
            </thead>
            <tbody>
              {open.map((t, idx) => (
                <tr key={t.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-4 py-3 font-mono font-bold text-gray-900">{t.bag_number || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{t.register_name || t.register_id}</td>
                  <td className="px-4 py-3 text-gray-600">{t.operator_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.checkout_date ? new Date(t.checkout_date).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ${(t.checkout_total || 250).toFixed(2)}
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