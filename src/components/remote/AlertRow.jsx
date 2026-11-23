import React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// One alert inside an AlertDropdown. On a phone the Acknowledge button drops under the
// text so both stay readable and easy to tap.
export default function AlertRow({ icon: Icon, tone, onAcknowledge, children }) {
  return (
    <div className={`bg-white rounded-xl border p-3 flex flex-wrap items-center gap-3 ${tone.row}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.chip}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <Button onClick={onAcknowledge} size="sm" variant="outline"
        className="w-full sm:w-auto flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
        <Check className="w-4 h-4" /> Acknowledge
      </Button>
    </div>
  );
}