import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ArrowRightLeft } from "lucide-react";
import { listPendingTransfers } from "@/lib/posTransfer";

// Action Code 851 — Retrieve Transferred Sale. Scan the transfer slip barcode, or
// pick the waiting sale off the list.
export default function POSTransferDialog({ open, onClose, storeId, onRetrieve, toast }) {
  const [pending, setPending] = useState([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCode(""); setLoading(true);
    listPendingTransfers(storeId).then((list) => { setPending(list); setLoading(false); });
  }, [open, storeId]);

  const submitCode = () => {
    const key = code.trim().toUpperCase();
    const hit = pending.find((r) => r.suspend_id.toUpperCase() === key);
    if (!hit) { toast?.({ title: "Transfer Not Found", description: `No waiting transfer matches "${code}".`, variant: "destructive" }); return; }
    onRetrieve(hit);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111638] border-blue-500/30 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ArrowRightLeft className="w-5 h-5 text-teal-400" /> Retrieve Transferred Sale
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitCode(); }}
            placeholder="Scan slip or key TR-XXXXXX"
            className="bg-[#0a0e27] border-blue-500/20 text-white font-mono"
          />
          <button onClick={submitCode} className="px-4 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold">Retrieve</button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2">
          {loading && <p className="text-blue-300/40 text-sm text-center py-6">Loading transfers…</p>}
          {!loading && pending.length === 0 && (
            <p className="text-blue-300/40 text-sm text-center py-6">No sales are waiting to be transferred in.</p>
          )}
          {pending.map((r) => (
            <button
              key={r.id}
              onClick={() => onRetrieve(r)}
              className="w-full text-left p-3 rounded-lg bg-[#0a0e27] border border-blue-500/20 hover:border-teal-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-teal-300">{r.suspend_id}</span>
                <span className="text-white font-bold">${Number(r.total || 0).toFixed(2)}</span>
              </div>
              <p className="text-blue-300/50 text-xs mt-1">
                {r.item_count} item(s) · from {r.register_id} · {r.operator_name}
                {r.training_mode ? " · TRAINING" : ""}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}