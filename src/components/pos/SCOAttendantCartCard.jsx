import React from "react";
import { ScanLine } from "lucide-react";

// Live cart on an overseen self-checkout lane. This is the Loss Prevention view:
// the attendant sees exactly what the customer has scanned, as it is scanned.
export default function SCOAttendantCartCard({ state }) {
  const items = state?.items || [];

  return (
    <div className="rounded-xl border border-blue-500/10 bg-[#0d1230] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-blue-300/50 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <ScanLine className="w-3 h-3" /> Live Cart
        </p>
        <span className="text-blue-300/40 text-[10px]">{items.length} line{items.length === 1 ? "" : "s"}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-blue-300/25 text-xs text-center py-3">Nothing scanned</p>
      ) : (
        <>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {items.map((i, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-blue-100/80 truncate">
                  {i.qty > 1 && <span className="text-blue-300/50 font-mono mr-1">{i.qty}×</span>}
                  {i.name}
                </span>
                <span className="text-white font-mono flex-shrink-0">${(i.total || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-blue-500/10 flex items-center justify-between text-xs">
            <span className="text-blue-300/50">Total</span>
            <span className="text-white font-bold font-mono">${(state?.total || 0).toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}