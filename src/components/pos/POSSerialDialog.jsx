import React, { useState, useEffect, useRef } from "react";
import { ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Captures one or more serial numbers for a serialized item being added to the cart.
// `needed` = how many serials we require before confirm is allowed (default 1).
export default function POSSerialDialog({ open, product, needed = 1, onConfirm, onClose }) {
  const [serials, setSerials] = useState([]);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSerials([]);
      setCurrent("");
      setError("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const remaining = Math.max(0, needed - serials.length);

  const addSerial = () => {
    const s = current.trim();
    if (!s) { setError("Enter a serial number"); return; }
    if (serials.includes(s)) { setError("That serial was already entered"); return; }
    const next = [...serials, s];
    setSerials(next);
    setCurrent("");
    setError("");
    if (next.length >= needed) {
      onConfirm(next.slice(0, needed));
      return;
    }
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const removeSerial = (i) => setSerials(prev => prev.filter((_, idx) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111638] border-indigo-500/20 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-indigo-400" /> Serial Number Required
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-blue-300/60 text-xs">
            <span className="text-white font-medium">{product?.name}</span> is a serialized item. {needed > 1 ? `Scan/enter ${needed} serial number(s).` : "Scan or enter the serial number."}
          </p>

          {serials.length > 0 && (
            <div className="space-y-1">
              {serials.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-[#0a0e27] border border-indigo-500/20 rounded-lg px-2 py-1.5">
                  <span className="text-white text-xs font-mono">{s}</span>
                  <button onClick={() => removeSerial(i)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}

          {remaining > 0 && (
            <Input
              ref={inputRef}
              value={current}
              onChange={e => setCurrent(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSerial(); } }}
              placeholder={remaining > 1 ? `Serial #${serials.length + 1} of ${needed}` : "Enter serial number"}
              className="bg-[#0a0e27] border-indigo-500/20 text-white font-mono text-lg text-center tracking-wider"
            />
          )}
          {error && <p className="text-red-400 text-xs text-center">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            {remaining > 0 ? (
              <Button onClick={addSerial} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs">{serials.length > 0 ? `Add (${serials.length}/${needed})` : "Add"}</Button>
            ) : (
              <Button onClick={() => onConfirm(serials)} className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs">Confirm</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}