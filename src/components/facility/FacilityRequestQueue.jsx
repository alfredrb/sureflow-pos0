import React from "react";
import moment from "moment";
import { categoryMeta, STATUS_STYLES, URGENCY_STYLES } from "@/lib/facilityRequests";

export default function FacilityRequestQueue({ requests, selectedId, onSelect, showStore }) {
  if (!requests.length) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
        No facility requests match this filter.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100 bg-white">
      {requests.map((r) => {
        const meta = categoryMeta(r.category);
        const active = r.id === selectedId;
        return (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className={`flex w-full items-start gap-3 p-4 text-left transition-colors ${active ? "bg-blue-50/70" : "hover:bg-gray-50/70"}`}
          >
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50">
              <meta.icon className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-gray-900">{r.subject}</p>
                {r.urgency && r.urgency !== "normal" && r.urgency !== "low" && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${URGENCY_STYLES[r.urgency]}`}>{r.urgency}</span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {meta.label}
                {showStore && r.store_id ? ` · Store ${r.store_id}` : ""}
                {r.register_id ? ` · ${r.register_id}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {moment(r.created_date).format("MMM D, YYYY")}
                {r.submitted_by_operator_name ? ` · ${r.submitted_by_operator_name}` : ""}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[r.status] || "bg-gray-100 text-gray-600"}`}>
              {r.status}
            </span>
          </button>
        );
      })}
    </div>
  );
}