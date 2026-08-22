import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Percent } from "lucide-react";

const PADS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENTER"];

// Action Code 300 — Any Percent Off. The fixed presets (301-305) never open this
// dialog; they apply their percentage straight away.
export default function POSPercentDiscountDialog({ open, onClose, onSubmit }) {
  const [value, setValue] = useState("");

  useEffect(() => { if (open) setValue(""); }, [open]);

  const pct = parseFloat(value);
  const valid = !isNaN(pct) && pct > 0 && pct <= 100;

  const press = (k) => {
    if (k === "CLR") setValue("");
    else if (k === "ENTER") { if (valid) onSubmit(pct); }
    else setValue((v) => (v.length < 3 ? v + k : v));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-blue-500/30 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Percent className="w-5 h-5 text-amber-400" /> Percent Off Sale
          </DialogTitle>
        </DialogHeader>
        <div className="bg-[#0a0e27] border border-blue-500/20 rounded-lg p-4 text-center">
          <p className="text-blue-300/40 text-[10px] uppercase tracking-widest mb-1">Discount</p>
          <p className="text-4xl font-mono font-bold text-white">{value || "0"}<span className="text-amber-400">%</span></p>
          {value && !valid && <p className="text-red-400 text-xs mt-2">Enter 1 – 100</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PADS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={k === "ENTER" && !valid}
              className={`py-4 rounded-lg font-bold text-lg transition-colors disabled:opacity-30 ${
                k === "ENTER" ? "bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                : k === "CLR" ? "bg-red-900/60 hover:bg-red-800 text-red-200 text-sm"
                : "bg-[#0a0e27] border border-blue-500/20 text-white hover:border-blue-500/50"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}