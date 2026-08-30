import React from "react";
import { AlertTriangle, ShoppingCart, CreditCard, Moon, ScanLine, Users } from "lucide-react";
import { SCO_REASONS } from "@/lib/scoAssist";

// One self-checkout lane on the Remote Workstation: live customer state, the live
// cart (the Loss Prevention view) and any pending assistance request. Read-only —
// requests are resolved by the attendant at the lane, not from the office.
export default function SCOLaneCard({ lane, state, request }) {
  const items = state?.items || [];
  const paying = state?.lane_phase === "paying";
  const inSale = state?.mode === "sale";

  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${request ? "border-orange-300 ring-2 ring-orange-200" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{lane.name}</p>
            <p className="text-gray-400 text-xs font-mono">{lane.register_id}</p>
          </div>
        </div>
        {request ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-orange-700 bg-orange-100 border border-orange-300 rounded-full px-2 py-0.5 animate-pulse">
            <AlertTriangle className="w-3 h-3" /> Needs help
          </span>
        ) : paying ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2 py-0.5">
            <CreditCard className="w-3 h-3" /> Paying
          </span>
        ) : inSale ? (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
            <ShoppingCart className="w-3 h-3" /> In sale
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
            <Moon className="w-3 h-3" /> Idle
          </span>
        )}
      </div>

      {request && (
        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2">
          <p className="text-orange-800 text-xs font-semibold">{SCO_REASONS[request.reason] || request.reason}</p>
          {(request.product_name || request.detail) && (
            <p className="text-orange-700/80 text-[10px]">{[request.product_name, request.detail].filter(Boolean).join(" · ")}</p>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <ScanLine className="w-3 h-3" /> Live Cart
          </p>
          <span className="text-[10px] text-gray-400">{items.length} line{items.length === 1 ? "" : "s"}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-2">Nothing scanned</p>
        ) : (
          <>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {items.map((i, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-700 truncate">
                    {i.qty > 1 && <span className="text-gray-400 font-mono mr-1">{i.qty}×</span>}
                    {i.name}
                  </span>
                  <span className="text-gray-800 font-mono flex-shrink-0">${(i.total || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900 font-mono">${(state?.total || 0).toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}