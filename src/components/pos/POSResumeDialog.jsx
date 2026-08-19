import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/data";
import { PauseCircle, ScanLine } from "lucide-react";

// Resume a suspended sale. The input is auto-focused so a keyboard-wedge scanner
// can simply scan the slip's barcode and submit on its trailing Enter.
export default function POSResumeDialog({ open, onClose, storeId, onResume, toast }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(""); setError("");
    base44.entities.SuspendedTransaction
      .filter({ store_id: storeId || "", status: "suspended" }, "-created_date", 20)
      .then(setList)
      .catch(() => setList([]));
  }, [open, storeId]);

  const lookup = async (value) => {
    const entered = String(value || "").trim().toUpperCase();
    if (!entered) return;
    setLoading(true); setError("");
    try {
      const found = await base44.entities.SuspendedTransaction.filter({ suspend_id: entered });
      const rec = found[0];
      if (!rec) setError("Suspend number not found");
      else if (rec.status === "resumed") setError("This suspend was already resumed");
      else if (rec.status !== "suspended") setError(`This suspend is ${rec.status} and cannot be resumed`);
      else if ((rec.store_id || "") !== (storeId || "")) setError("This suspend belongs to another store");
      else { onResume(rec); return; }
    } catch (e) {
      setError("Lookup failed — try again");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#0a0e27] border-blue-500/20 text-white max-w-md">
        <div className="flex items-center gap-2 text-blue-300/60 text-xs uppercase tracking-widest">
          <PauseCircle className="w-3.5 h-3.5" /> Resume Suspended Sale
        </div>

        <div className="relative">
          <ScanLine className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/40" />
          <input
            autoFocus
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => { if (e.key === "Enter") lookup(code); }}
            placeholder="SCAN SLIP OR KEY SUSPEND #"
            className="w-full bg-black/40 border border-blue-500/20 rounded-xl pl-9 pr-4 py-3 font-mono tracking-widest text-white outline-none focus:border-blue-500/60 placeholder:text-blue-300/25 placeholder:text-xs"
          />
        </div>
        {error && <p className="text-red-300 text-sm text-center">{error}</p>}

        <div>
          <p className="text-blue-300/30 text-[10px] uppercase tracking-widest mb-2">Suspended At This Store</p>
          <div className="max-h-56 overflow-y-auto space-y-1.5 scrollbar-hide">
            {list.length === 0 && (
              <p className="text-blue-300/30 text-sm text-center py-4">No suspended sales</p>
            )}
            {list.map(s => (
              <button
                key={s.id}
                onClick={() => lookup(s.suspend_id)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm text-blue-200">{s.suspend_id}</span>
                  <span className="text-sm font-bold">${Number(s.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-blue-300/40 mt-0.5">
                  <span>{s.item_count} item(s) · {s.register_id}</span>
                  <span>{s.operator_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-transparent border-white/15 text-blue-200/70 hover:bg-white/5 hover:text-white">Cancel</Button>
          <Button onClick={() => lookup(code)} disabled={!code || loading} className="flex-1 bg-blue-600 hover:bg-blue-700">Resume</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}