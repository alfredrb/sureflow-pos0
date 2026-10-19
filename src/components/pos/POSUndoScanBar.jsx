import React from "react";
import { Undo2 } from "lucide-react";

// One-tap undo of the most recent scan — takes a single unit of that item back off.
export default function POSUndoScanBar({ item, onUndo }) {
  if (!item) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-[#0f1535] border-b border-blue-500/10 flex-shrink-0">
      <span className="text-xs text-blue-200/70 truncate">
        Last scan: <span className="font-bold text-white">{item.name}</span> · ${Number(item.price).toFixed(2)}
      </span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-600/20 border border-amber-500/40 text-amber-200 text-xs font-bold uppercase tracking-wider hover:bg-amber-600/30"
      >
        <Undo2 className="w-3.5 h-3.5" /> Undo Last Scan
      </button>
    </div>
  );
}