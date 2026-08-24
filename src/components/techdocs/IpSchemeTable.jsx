import React from "react";
import { ShieldOff, Globe } from "lucide-react";

// One VLAN's address allocation. Same at every store, which is the whole point.
export default function IpSchemeTable({ plan, tone }) {
  const isolated = tone === "isolated";
  const Icon = isolated ? ShieldOff : Globe;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className={`flex items-start gap-2 border-b border-gray-100 p-4 ${isolated ? "bg-orange-50/60" : "bg-sky-50/60"}`}>
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${isolated ? "text-orange-600" : "text-sky-600"}`} />
        <div>
          <p className="text-sm font-semibold text-gray-900">{plan.vlan}</p>
          <p className="mt-0.5 font-mono text-[11px] text-gray-500">{plan.subnet}</p>
        </div>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
            <th className="p-3 font-semibold">Role</th>
            <th className="p-3 font-semibold">Address</th>
            <th className="p-3 font-semibold">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {plan.rows.map((r) => (
            <tr key={r.addr}>
              <td className="p-3 align-top text-xs font-medium text-gray-900">{r.role}</td>
              <td className="whitespace-nowrap p-3 align-top font-mono text-xs text-blue-700">{r.addr}</td>
              <td className="p-3 align-top text-xs leading-relaxed text-gray-500">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}