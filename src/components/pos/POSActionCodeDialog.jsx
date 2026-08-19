import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Hash } from "lucide-react";
import { resolveActionCode, ACTION_LABELS } from "@/lib/actionCodeDispatch";

// Same 3x4 keypad layout and key styling as the POS login pinpad.
const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

// Numeric action-code entry. The operator types a code and confirms; the parent
// resolves it and dispatches. Preview shows what the code maps to before running.
export default function POSActionCodeDialog({ open, onClose, codes, storeId, onSubmit }) {
  const [buffer, setBuffer] = useState("");

  useEffect(() => { if (open) setBuffer(""); }, [open]);

  const match = buffer ? resolveActionCode(codes, buffer, storeId) : null;
  const preview = !buffer ? null
    : !match || match.status === "inactive" ? { tone: "text-red-300", text: "Not supported on this system" }
    : match.status === "placeholder" ? { tone: "text-amber-300", text: `${match.label} — coming soon` }
    : { tone: "text-emerald-300", text: `${match.label} · ${ACTION_LABELS[match.action] || match.action}` };

  const submit = () => { if (buffer) onSubmit(buffer); };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="w-4 h-4 text-blue-400" />
          <h3 className="text-white font-semibold text-sm">Action Code</h3>
        </div>

        <div className="bg-[#0a0e27] rounded-xl p-3 font-mono text-xl text-white tracking-[0.4em] text-center border border-blue-500/10 min-h-[44px] flex items-center justify-center">
          {buffer || <span className="text-blue-500/20">----</span>}
        </div>
        <p className={`text-xs text-center h-4 ${preview?.tone || "text-blue-300/30"}`}>
          {preview?.text || "Enter a code"}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {PAD.map(k => (
            <button key={k} onClick={() => {
              if (k === "CLR") setBuffer("");
              else if (k === "ENT") submit();
              else setBuffer(b => (b + k).slice(0, 4));
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