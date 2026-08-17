import React, { useState, useEffect, useRef } from "react";
import { ScanLine, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Prompts for a serial number and verifies it.
// `verify` is an async function (serial) => boolean. On success calls onVerified(serial).
// On mismatch, the operator is prompted to retype/rescan (the input clears and refocuses).
// `mode` = "receipt" (match against the receipt) or "inventory" (match sold serialized inventory).
export default function POSSerialVerifyDialog({ open, item, mode = "receipt", verify, onVerified, onClose }) {
  const [serial, setSerial] = useState("");
  const [checking, setChecking] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSerial("");
      setMismatch(false);
      setChecking(false);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const submit = async () => {
    const s = serial.trim();
    if (!s) return;
    setChecking(true);
    setMismatch(false);
    try {
      const ok = await verify(s);
      if (ok) {
        onVerified(s);
        return;
      }
      setMismatch(true);
      setSerial("");
      setTimeout(() => inputRef.current?.focus(), 30);
    } catch {
      setMismatch(true);
      setSerial("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
    setChecking(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#111638] border-rose-500/20 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-rose-400" /> Verify Serial Number
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-blue-300/60 text-xs">
            <span className="text-white font-medium">{item.name}</span> is serialized. {mode === "receipt" ? "Enter the serial number printed on the receipt for this item." : "Enter the serial number of the item being returned."}
          </p>

          {mismatch && (
            <div className="bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-rose-300 text-xs">
                {mode === "receipt"
                  ? "That serial does not match this receipt. Please retype or rescan the serial number."
                  : "That serial was not found in sold serialized inventory. Please retype or rescan the serial number."}
              </p>
            </div>
          )}

          <Input
            ref={inputRef}
            value={serial}
            onChange={e => setSerial(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="Scan or enter serial number"
            className="bg-[#0a0e27] border-rose-500/20 text-white font-mono text-lg text-center tracking-wider"
          />

          <div className="flex gap-2">
            <Button onClick={onClose} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={submit} disabled={checking || !serial.trim()} className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs">{checking ? "Verifying..." : "Verify"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}