import React, { useState } from "react";
import { AlertTriangle, ChevronDown, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import AlertRow from "@/components/remote/AlertRow";

const TONES = {
  critical: { box: "bg-red-50 border-red-400 ring-red-400", title: "text-red-800", row: "border-red-300", chip: "bg-red-100 text-red-600" },
  red: { box: "bg-red-50 border-red-300 ring-red-200", title: "text-red-800", row: "border-red-200", chip: "bg-red-100 text-red-600" },
  orange: { box: "bg-orange-50 border-orange-300 ring-orange-200", title: "text-orange-800", row: "border-orange-200", chip: "bg-orange-100 text-orange-600" },
};

// A Remote Workstation alert banner that stays closed until it is opened: the header
// always shows how many alerts are waiting, and opening it lists them with their
// Acknowledge buttons. "Acknowledge all" needs a second tap, so one stray tap cannot
// clear a whole list of alerts nobody has read.
export default function AlertDropdown({ title, tone = "red", pulse = false, icon, items, renderItem, onAcknowledge }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const t = TONES[tone];

  return (
    <div className={`border rounded-2xl flex-shrink-0 ring-2 ${t.box}`}>
      <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setConfirming(false); }}
        className={`w-full flex items-center gap-2 px-4 py-3 rounded-2xl text-left font-bold text-sm ${t.title}`}>
        <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${pulse ? "animate-pulse" : ""}`} />
        <span className="flex-1">{title} ({items.length})</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {items.length > 1 && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onBlur={() => setConfirming(false)}
                onClick={() => { if (confirming) onAcknowledge(items); setConfirming(!confirming); }}
                className="bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <CheckCheck className="w-4 h-4" />
                {confirming ? `Tap again to acknowledge all ${items.length}` : "Acknowledge all"}
              </Button>
            </div>
          )}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {items.map(item => (
              <AlertRow key={item.id} icon={icon} tone={t} onAcknowledge={() => onAcknowledge([item])}>
                {renderItem(item)}
              </AlertRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}