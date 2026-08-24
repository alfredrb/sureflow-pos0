import React from "react";
import moment from "moment";
import { CheckCircle, XCircle, CalendarClock, User, Boxes } from "lucide-react";
import { categoryMeta, STATUS_STYLES, URGENCY_STYLES } from "@/lib/facilityRequests";

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function FacilityRequestDetail({ request }) {
  const meta = categoryMeta(request.category);
  const decided = request.status === "denied" ? "denied" : ["approved", "scheduled", "completed"].includes(request.status) ? "approved" : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-gray-900">{request.subject}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
              {request.store_id ? ` · Store ${request.store_id}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[request.status] || "bg-gray-100 text-gray-600"}`}>{request.status}</span>
            {request.urgency && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${URGENCY_STYLES[request.urgency]}`}>{request.urgency}</span>
            )}
          </div>
        </div>

        {request.description && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{request.description}</p>}

        <div className="mt-3 divide-y divide-gray-50 border-t pt-2">
          <Row label="Register" value={request.register_id} />
          <Row label="Item / Part" value={request.affected_sku} />
          <Row label="Quantity" value={request.quantity} />
          <Row label="Preferred Date" value={request.preferred_date ? moment(request.preferred_date).format("MMM D, YYYY") : null} />
          <Row label="Submitted By" value={request.submitted_by_operator_name} />
          <Row label="Submitted" value={moment(request.created_date).format("MMM D, YYYY h:mm A")} />
        </div>
      </div>

      {decided && (
        <div className={`rounded-2xl border p-4 ${decided === "approved" ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"}`}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${decided === "approved" ? "text-emerald-700" : "text-red-700"}`}>
            {decided === "approved" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {decided === "approved" ? "Approved by HQ" : "Denied by HQ"}
          </p>
          <div className="mt-2 space-y-2 text-sm text-gray-700">
            {request.assigned_operator_name && (
              <p className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> {request.assigned_operator_name} is assigned</p>
            )}
            {request.scheduled_date && (
              <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-gray-400" /> Scheduled for {moment(request.scheduled_date).format("dddd, MMM D, YYYY")}</p>
            )}
            {request.assigned_hardware && (
              <p className="flex items-center gap-2"><Boxes className="h-4 w-4 text-gray-400" /> {request.assigned_hardware}</p>
            )}
            {request.denial_reason && <p className="whitespace-pre-wrap">{request.denial_reason}</p>}
            {request.hq_notes && <p className="whitespace-pre-wrap text-gray-600">{request.hq_notes}</p>}
            <p className="text-[11px] text-gray-400">
              {request.decided_by_name || "HQ"}
              {request.decided_at ? ` · ${moment(request.decided_at).format("MMM D, YYYY h:mm A")}` : ""}
              {request.maintenance_log_id ? " · posted to the store's Maintenance Log" : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}