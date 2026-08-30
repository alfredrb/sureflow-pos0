import React from "react";
import { AlertTriangle, ShoppingCart, Moon, CreditCard } from "lucide-react";
import { SCO_REASONS, SUPERVISOR_REQUIRED } from "@/lib/scoAssist";

// One overseen self-checkout lane in the attendant panel: live state plus the
// pending assistance request with one-tap remote actions.
export default function SCOAttendantLaneCard({ lane, state, request, onApprove, onRelease }) {
  const inSale = state?.mode === "sale";
  // The lane publishes where the customer actually is, so paying reads as PAYING
  // rather than as another in-sale lane.
  const paying = state?.lane_phase === "paying";
  const canApprove = request && !SUPERVISOR_REQUIRED.includes(request.reason);

  return (
    <div className={`rounded-xl border p-3 ${request ? "border-orange-500/50 bg-orange-500/10" : "border-blue-500/10 bg-[#0a0e27]"}`}>
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold text-sm">{lane.name} <span className="text-blue-300/40 font-mono text-xs">{lane.register_id}</span></p>
        {request ? (
          <span className="text-orange-300 text-[10px] font-bold uppercase flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3" /> Needs help</span>
        ) : paying ? (
          <span className="text-emerald-300 text-[10px] font-bold uppercase flex items-center gap-1"><CreditCard className="w-3 h-3" /> Paying · ${(state?.total || 0).toFixed(2)}</span>
        ) : inSale ? (
          <span className="text-blue-300/70 text-[10px] uppercase flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> In sale · ${(state?.total || 0).toFixed(2)}</span>
        ) : (
          <span className="text-blue-300/30 text-[10px] uppercase flex items-center gap-1"><Moon className="w-3 h-3" /> Idle</span>
        )}
      </div>
      {request && (
        <div className="mt-2 space-y-2">
          <p className="text-orange-200/90 text-xs">
            {SCO_REASONS[request.reason] || request.reason}
            {request.product_name ? ` — ${request.product_name}` : ""}
            {request.detail ? ` (${request.detail})` : ""}
          </p>
          {request.reason === "serialized" ? (
            <p className="text-orange-300/60 text-[11px]">Serial required — walk over and enter it at the lane, or release below.</p>
          ) : null}
          <div className="flex gap-2">
            {canApprove && request.reason !== "serialized" && (
              <button onClick={() => onApprove(request)} className="flex-1 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">Approve</button>
            )}
            <button onClick={() => onRelease(request)} className="flex-1 h-9 rounded-lg bg-[#1a1f4a] border border-blue-500/20 text-blue-200 text-xs font-bold hover:border-blue-500/40">Release lane</button>
          </div>
        </div>
      )}
    </div>
  );
}