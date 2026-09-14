import React from "react";
import { Edit2, Building2, Globe2, MapPin, Monitor } from "lucide-react";

const TYPE_LABELS = {
  supercenter: "Supercenter",
  standard: "Standard",
  express: "Express",
  distribution: "Distribution",
  support_office: "Support Office",
};

const TYPE_CLS = {
  supercenter: "bg-violet-100 text-violet-700",
  standard: "bg-blue-100 text-blue-700",
  express: "bg-teal-100 text-teal-700",
  distribution: "bg-amber-100 text-amber-700",
  support_office: "bg-slate-100 text-slate-700",
};

// The chain directory. Lane count comes from the registers already loaded by the page
// so a store's real footprint is visible without opening it.
export default function StoreDirectoryTable({ stores, laneCounts, onEdit, onView }) {
  if (stores.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
        <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">No stores yet — create the first one to start the chain.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <th className="px-5 py-3 text-left">Store</th>
              <th className="px-3 py-3 text-left">Type</th>
              <th className="px-3 py-3 text-left">Region</th>
              <th className="px-3 py-3 text-left">Location</th>
              <th className="px-3 py-3 text-left">Manager</th>
              <th className="px-3 py-3 text-right">Lanes</th>
              <th className="px-3 py-3 text-left">Status</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3">
                  <p className="font-mono text-xs font-semibold text-gray-900">{s.store_number}</p>
                  <p className="text-sm font-medium text-gray-700">{s.name}</p>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${TYPE_CLS[s.store_type] || "bg-gray-100 text-gray-600"}`}>
                    {TYPE_LABELS[s.store_type] || s.store_type || "—"}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500">
                  {s.region ? (
                    <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3 text-gray-400" />{s.region}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-3 text-gray-500">
                  {s.address_city || s.address_state ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      {[s.address_city, s.address_state].filter(Boolean).join(", ")}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-3 text-gray-500">{s.manager_name || "—"}</td>
                <td className="px-3 py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-gray-700">
                    <Monitor className="h-3 w-3 text-gray-400" />
                    {laneCounts[s.store_number] || 0}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${s.status === "inactive" ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-700"}`}>
                    {s.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => onView(s)} title="View this store's data"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
                      <Building2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onEdit(s)} title="Edit store"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}