import React from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import moment from "moment";
import AuditCategoryBadge from "@/components/audit/AuditCategoryBadge";

// One audit entry: a summary row, and an expanded panel carrying the description and the
// field-level before/after diff.
export default function AuditEntryRow({ entry, expanded, onToggle, storeLabel, showStore }) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50/50" onClick={() => onToggle(entry.id)}>
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
          {moment(entry.created_date).format("MMM D, YYYY h:mm A")}
        </td>
        <td className="px-4 py-3"><AuditCategoryBadge category={entry.category} /></td>
        <td className="px-4 py-3 font-medium text-gray-900">{entry.action}</td>
        {showStore && (
          <td className="px-4 py-3">
            <span className={`inline-flex items-center gap-1 text-xs ${entry.store_id ? "text-gray-700" : "text-gray-400"}`}>
              <Building2 className="h-3 w-3" />{storeLabel}
            </span>
          </td>
        )}
        <td className="px-4 py-3 text-gray-700">
          <p className="text-xs">{entry.actor_name || "—"}</p>
          {entry.actor_role && <p className="text-[10px] capitalize text-gray-400">{entry.actor_role}</p>}
        </td>
        <td className="px-4 py-3 font-mono text-[11px] text-gray-500">{entry.page || "—"}</td>
      </tr>

      {expanded && (
        <tr className="bg-gray-50/40">
          <td></td>
          <td colSpan={showStore ? 6 : 5} className="px-4 pb-4 pt-1">
            {entry.description && <p className="mb-2 text-sm text-gray-700">{entry.description}</p>}
            {entry.changes?.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-gray-100 bg-white">
                <p className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Changed Fields
                </p>
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-gray-50">
                    {entry.changes.map((c, i) => (
                      <tr key={i}>
                        <td className="w-40 px-3 py-2 align-top font-mono text-gray-700">{c.field}</td>
                        <td className="px-3 py-2 align-top text-red-500 line-through opacity-70">{c.from || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 align-top text-gray-400">→</td>
                        <td className="px-3 py-2 align-top font-medium text-emerald-600">{c.to || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {entry.ip_address && (
              <p className="mt-2 text-[11px] text-gray-400">Source IP: <span className="font-mono">{entry.ip_address}</span></p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}