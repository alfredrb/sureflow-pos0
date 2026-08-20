import React from "react";
import { Button } from "@/components/ui/button";
import { PenLine } from "lucide-react";

// Shown on the operator's screen while the customer is doing something on the
// lane's Ingenico pinpad. The operator can always bypass — a dead pad must never
// trap a tender.
export default function POSPinpadPrompt({ title, detail, onSkip, skipLabel = "Skip — Continue Without It" }) {
  return (
    <div className="space-y-3 py-4 text-center">
      <PenLine className="mx-auto h-6 w-6 text-sky-400" />
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="animate-pulse text-xs text-sky-300">Waiting on the customer pinpad...</p>
      {detail && <p className="text-[10px] leading-snug text-blue-300/50">{detail}</p>}
      {onSkip && (
        <Button variant="outline" onClick={onSkip}
          className="h-10 w-full border-blue-500/30 text-xs text-blue-200 hover:bg-blue-500/10">
          {skipLabel}
        </Button>
      )}
    </div>
  );
}