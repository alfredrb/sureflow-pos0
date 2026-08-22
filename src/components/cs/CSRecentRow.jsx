import React from "react";
import { Clock } from "lucide-react";
import { findAction } from "@/lib/csServiceCards";

// The operator's most-used service actions, floated above the cards.
export default function CSRecentRow({ recent = [], onAction }) {
  const items = recent.map(findAction).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Clock className="w-3 h-3 text-amber-300/50 flex-shrink-0" />
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => onAction(a.id)}
            className="whitespace-nowrap rounded-full bg-[#111638] border border-amber-500/25 text-amber-200 hover:border-amber-500/60 text-[10px] uppercase tracking-wider font-semibold px-3 py-1.5 transition-colors"
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}