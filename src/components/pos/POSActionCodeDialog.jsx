import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Hash, Delete } from "lucide-react";
import { resolveActionCode, ACTION_LABELS } from "@/lib/actionCodeDispatch";

const PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

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
      <DialogContent className="bg-[#0a0e27] border-blue-500/20 text-white max-w-sm">
        <div className="flex items-center gap-2 text-blue-300/60 text-xs uppercase tracking-widest mb-1">
          <Hash className="w-3.5 h-3.5" /> Action Code
        </div>
        <input
          autoFocus
          value={buffer}
          onChange={e => setBuffer(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          placeholder="000"
          className="w-full bg-black/40 border border-blue-500/20 rounded-xl px-4 py-4 text-center text-4xl font-mono tracking-[0.3em] text-white outline-none focus:border-blue-500/60"
        />
        <p className={`text-sm text-center h-5 ${preview?.tone || "text-blue-300/30"}`}>
          {preview?.text || "Enter a code"}
        </p>

        <div className="grid grid-cols-3 gap-2">
          {PAD.map(d => (
            <button key={d} onClick={() => setBuffer(b => (b + d).slice(0, 4))}
              className="py-4 rounded-xl bg-white/5 border border-white/10 text-xl font-mono hover:bg-white/10 transition-colors">
              {d}
            </button>
          ))}
          <button onClick={() => setBuffer(b => b.slice(0, -1))}
            className="py-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
            <Delete className="w-5 h-5" />
          </button>
          <button onClick={() => setBuffer("")}
            className="py-4 rounded-xl bg-white/5 border border-white/10 text-xs uppercase tracking-wider hover:bg-white/10 transition-colors">
            Clear
          </button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent border-white/15 text-blue-200/70 hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={submit} disabled={!buffer} className="flex-1 bg-blue-600 hover:bg-blue-700">Enter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}