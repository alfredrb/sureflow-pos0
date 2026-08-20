import React from "react";
import { X } from "lucide-react";
import { tenderLabel } from "@/lib/tenderSplit";

// Tenders already applied to the sale, newest last. Each can be pulled back off
// until the sale is completed.
export default function POSTenderList({ tenders, onRemove }) {
  if (!tenders.length) return null;
  return (
    <div className="space-y-1 rounded-xl border border-blue-500/10 bg-[#0a0e27] p-2">
      {tenders.map((t, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-xs">
          <span className="uppercase tracking-wide text-blue-300/70">{tenderLabel(t.method)}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-white">${Number(t.amount).toFixed(2)}</span>
            <button onClick={() => onRemove(i)} className="text-blue-300/40 hover:text-red-400" title="Remove tender">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}