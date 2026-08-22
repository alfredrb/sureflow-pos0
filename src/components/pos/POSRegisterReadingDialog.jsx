import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { usePinpadKeys } from "@/hooks/usePinpadKeys";

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

// Action Code 3 — the operator keys the register to take a reading for, then
// presses Enter and the slip prints. Same keypad as the action-code entry.
export default function POSRegisterReadingDialog({ open, onClose, defaultRegisterId = "", onSubmit }) {
  const [value, setValue] = useState("");

  useEffect(() => { if (open) setValue(defaultRegisterId); }, [open, defaultRegisterId]);

  const submit = () => { if (value.trim()) onSubmit(value.trim()); };

  usePinpadKeys({ active: open, value, setValue, maxLength: 12, onEnter: submit });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Printer className="w-4 h-4 text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Register Reading</h3>
        </div>

        <p className="text-blue-300/40 text-xs text-center">REGISTER?</p>
        <div className="bg-[#0a0e27] rounded-xl p-3 font-mono text-lg text-white tracking-widest text-center border border-blue-500/10 min-h-[44px] flex items-center justify-center">
          {value || <span className="text-blue-500/20">----</span>}
        </div>
        <p className="text-blue-300/30 text-[10px] text-center">
          Prints SOD, current and EOD totals by tender
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {PAD.map(k => (
            <button key={k} onClick={() => {
              if (k === "CLR") setValue("");
              else if (k === "ENT") submit();
              else setValue(v => (v + k).slice(0, 12));
            }}
            className={`h-10 rounded-lg font-bold text-sm transition-all active:scale-95 ${
              k === "ENT" ? "bg-blue-600 hover:bg-blue-500 text-white" :
              k === "CLR" ? "bg-red-600/20 text-red-400 border border-red-500/20" :
              "bg-[#1a1f4a] text-white border border-blue-500/10"
            }`}>
              {k}
            </button>
          ))}
        </div>

        <button onClick={onClose} className="text-blue-400/40 hover:text-blue-300 text-xs w-full text-center mt-2">
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}