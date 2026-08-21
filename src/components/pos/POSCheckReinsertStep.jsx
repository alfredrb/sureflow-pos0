import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

// Second pass of the cheque tender. The lane's printer has no endorsement unit, so
// the back of the cheque can only be reached by physically turning it over — the
// cheque has just been ejected and the printer is waiting for it to come back in.
export default function POSCheckReinsertStep({ onEndorse, onSkip, busy }) {
  return (
    <div className="space-y-3 text-center">
      <RotateCcw className="mx-auto h-7 w-7 text-amber-400" />
      <p className="text-sm font-bold text-white">TURN THE CHEQUE OVER</p>
      <p className="text-xs leading-relaxed text-blue-200">
        Take the cheque from the slot, turn it face-DOWN, and reinsert it. The endorsement prints on the back.
      </p>
      <Button onClick={onEndorse} disabled={busy} className="h-11 w-full bg-blue-600 font-bold hover:bg-blue-500 disabled:opacity-40">
        {busy ? "Printing endorsement..." : "Cheque Reinserted — Print Endorsement"}
      </Button>
      <button
        onClick={onSkip}
        disabled={busy}
        className="w-full py-1 text-[10px] uppercase tracking-wider text-blue-300/50 hover:text-blue-200 disabled:opacity-40"
      >
        Skip endorsement — endorse by hand
      </button>
    </div>
  );
}