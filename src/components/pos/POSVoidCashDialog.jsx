import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/data";
import { findVoidableSales } from "@/lib/posVoidSale";
import { AlertTriangle } from "lucide-react";

// Void a completed CASH sale from the current shift. Step 1 picks the sale
// (scan the receipt code or tap it in the list), step 2 takes manager approval.
export default function POSVoidCashDialog({ open, onClose, registerId, operator, shiftStart, onConfirmed }) {
  const [sales, setSales] = useState([]);
  const [picked, setPicked] = useState(null);
  const [scan, setScan] = useState("");
  const [reason, setReason] = useState("");
  const [mgrId, setMgrId] = useState("");
  const [mgrPin, setMgrPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) { setPicked(null); setScan(""); setReason(""); setMgrId(""); setMgrPin(""); setError(""); return; }
    findVoidableSales({ registerId, operatorId: operator?.operator_id, shiftStart }).then(setSales);
  }, [open]);

  const pickByScan = () => {
    const hit = sales.find(s => s.transaction_id.toUpperCase() === scan.trim().toUpperCase());
    if (!hit) { setError("No voidable cash sale from this shift matches that number."); return; }
    setError(""); setPicked(hit);
  };

  const approve = async () => {
    setError("");
    if (!mgrId.trim() || !mgrPin.trim()) { setError("Enter Manager User ID and PIN"); return; }
    setBusy(true);
    try {
      const ops = await base44.entities.Operator.filter({ operator_id: mgrId.trim(), pin: mgrPin });
      const mgr = ops.find(o => o.role === "manager" && o.pos_access !== false);
      if (!mgr) { setError("Invalid credentials — a Manager is required to void a cash sale"); setBusy(false); return; }
      await onConfirmed(picked, mgr, reason.trim());
    } catch (e) {
      setError("The void could not be completed. Get a manager.");
    }
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-[#111638] border-blue-500/20 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Void Cash Transaction</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-200 leading-relaxed">
            The sale is removed from the books, stock goes back on hand and rewards are reversed.
            Hand the cash back to the customer — the drawer will read over until you do.
          </p>
        </div>

        {!picked ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                autoFocus value={scan} onChange={e => setScan(e.target.value)}
                onKeyDown={e => e.key === "Enter" && pickByScan()}
                placeholder="Scan or key the transaction number"
                className="bg-[#0a0e27] border-blue-500/20 text-white"
              />
              <Button onClick={pickByScan} className="bg-blue-600 hover:bg-blue-700">Find</Button>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-blue-300/40">Cash sales this shift</p>
            <div className="max-h-56 overflow-y-auto space-y-1.5">
              {sales.length === 0 && <p className="text-xs text-blue-300/50">No voidable cash sales on this shift.</p>}
              {sales.map(s => (
                <button key={s.id} onClick={() => setPicked(s)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#0a0e27] border border-blue-500/10 hover:border-blue-500/40">
                  <div className="flex justify-between text-xs text-white font-bold">
                    <span>{s.transaction_id}</span><span>${Number(s.total || 0).toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-blue-300/50">
                    {new Date(s.sale_date || s.created_date).toLocaleTimeString()} · {(s.items || []).length} line(s)
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-[#0a0e27] border border-blue-500/10 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-blue-300/50">Original Trans. #</span><span className="font-bold">{picked.transaction_id}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/50">Original Terminal #</span><span>{picked.register_id}</span></div>
              <div className="flex justify-between"><span className="text-blue-300/50">Original Sale Amt.</span><span className="font-bold">${Number(picked.total || 0).toFixed(2)}</span></div>
            </div>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (optional)" className="bg-[#0a0e27] border-blue-500/20 text-white" />
            <Input value={mgrId} onChange={e => setMgrId(e.target.value)} placeholder="Manager User ID" className="bg-[#0a0e27] border-blue-500/20 text-white" />
            <Input type="password" value={mgrPin} onChange={e => setMgrPin(e.target.value)} placeholder="Manager PIN" className="bg-[#0a0e27] border-blue-500/20 text-white" />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPicked(null)} className="text-blue-300 hover:text-white">Back</Button>
              <Button onClick={approve} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 font-bold">
                {busy ? "Voiding…" : "Approve & Void"}
              </Button>
            </div>
          </div>
        )}
        {!picked && error && <p className="text-xs text-red-400">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}