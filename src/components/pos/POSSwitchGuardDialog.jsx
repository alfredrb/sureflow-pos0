import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const MODE_LABELS = { sale: "Sale", returns: "Returns", exchange: "Exchange", cs: "Customer Service", diagnostics: "Diagnostics" };

// Warns the operator before leaving a mode that still has an active transaction.
export default function POSSwitchGuardDialog({ open, currentMode, onStay, onSwitch }) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onStay(); }}>
      <DialogContent className="bg-[#111638] border-amber-500/30 text-white max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-sm flex items-center gap-2">⚠ Active Transaction</DialogTitle>
        </DialogHeader>
        <p className="text-blue-300/70 text-xs leading-relaxed">
          You have an active transaction in the{" "}
          <span className="text-white font-bold">{MODE_LABELS[currentMode] || currentMode}</span> tab.
          Switching tabs will not automatically cancel it, but you may lose unsaved progress.
        </p>
        <p className="text-blue-300/50 text-xs">Complete or cancel the current transaction before switching, or continue anyway.</p>
        <div className="flex gap-2 mt-1">
          <Button onClick={onStay} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Stay Here</Button>
          <Button onClick={onSwitch} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs">Switch Anyway</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}