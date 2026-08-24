import React from "react";
import { format } from "date-fns";
import { ASSIGNMENT_STATUS, shortRef } from "@/lib/relayUpdateStatus";

export default function ReleaseRolloutTable({ assignments, stores, windows }) {
  if (assignments.length === 0) {
    return <p className="px-5 py-4 text-xs text-gray-400">Not released yet — no stores have been queued.</p>;
  }

  const storeName = (sid) => stores.find((s) => s.store_number === sid)?.name || `Store ${sid}`;
  const windowOn = (sid) => !!windows.find((w) => w.store_id === sid)?.enabled;

  return (
    <div className="overflow-x-auto px-5 pb-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 font-semibold">Store</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 pr-3 font-semibold">Running ref</th>
            <th className="py-2 pr-3 font-semibold">Previous</th>
            <th className="py-2 pr-3 font-semibold">Window</th>
            <th className="py-2 pr-3 font-semibold">Applied</th>
            <th className="py-2 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => {
            const st = ASSIGNMENT_STATUS[a.status] || ASSIGNMENT_STATUS.pending;
            return (
              <tr key={a.id} className="border-t border-gray-50 align-top">
                <td className="py-2 pr-3 text-gray-800">
                  {storeName(a.store_id)} <span className="text-gray-400">#{a.store_id}</span>
                </td>
                <td className="py-2 pr-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                </td>
                <td className="py-2 pr-3 font-mono text-gray-700">{shortRef(a.current_ref)}</td>
                <td className="py-2 pr-3 font-mono text-gray-400">{shortRef(a.previous_ref)}</td>
                <td className="py-2 pr-3 text-gray-500">
                  {a.planned_for_date
                    ? `Planned ${a.planned_for_date}`
                    : windowOn(a.store_id)
                    ? "Next window"
                    : <span className="text-amber-600">No window enabled</span>}
                </td>
                <td className="py-2 pr-3 text-gray-500">{a.applied_at ? format(new Date(a.applied_at), "MMM d, h:mm a") : "—"}</td>
                <td className="py-2 text-gray-500">{a.error || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}