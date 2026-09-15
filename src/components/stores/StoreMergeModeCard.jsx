import React from "react";
import { Copy, DoorClosed } from "lucide-react";

const MODES = {
  consolidate: {
    icon: Copy,
    title: "Consolidate Duplicate",
    blurb: "Two records describe the same site. Moves everything — sales, EOD, lanes, staff, stock — onto the surviving store, then deletes this record.",
    accent: "border-blue-500 bg-blue-50",
  },
  close: {
    icon: DoorClosed,
    title: "Close & Transfer",
    blurb: "This store shut down. Moves only the living business — lanes, staff, stock, gift cards. Sales history stays here so the receiving store's books stay clean.",
    accent: "border-amber-500 bg-amber-50",
  },
};

// The two jobs hiding inside the word "merge". They do opposite things with history, so
// the admin picks deliberately rather than discovering the difference afterwards.
export default function StoreMergeModeCard({ mode, selected, onSelect }) {
  const cfg = MODES[mode];
  const Icon = cfg.icon;

  return (
    <button onClick={() => onSelect(mode)}
      className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${selected ? cfg.accent : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-gray-900" : "text-gray-400"}`} />
        <div>
          <p className="text-sm font-semibold text-gray-900">{cfg.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{cfg.blurb}</p>
        </div>
      </div>
    </button>
  );
}