import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// The signature the cheque writer left on the lane's pinpad, opened from the
// ledger so the back office can compare it against the cheque itself.
export default function CheckSignatureDialog({ check, onClose }) {
  return (
    <Dialog open={!!check} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg border-blue-500/10 bg-[#111638] text-white">
        <DialogHeader>
          <DialogTitle className="text-sm text-white">
            Signature — cheque {check?.check_number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-300/70">
            <span>Writer</span><span className="text-white">{check?.customer_name || "—"}</span>
            <span>Amount</span><span className="font-mono text-white">${Number(check?.amount || 0).toFixed(2)}</span>
            <span>Captured</span>
            <span className="text-white">
              {check?.signature_captured_at ? new Date(check.signature_captured_at).toLocaleString() : "—"}
            </span>
          </div>
          {check?.signature_url ? (
            <img src={check.signature_url} alt="Customer signature"
              className="w-full rounded-lg border border-blue-500/20 bg-white p-3" />
          ) : (
            <p className="py-8 text-center text-xs text-blue-300/50">
              No signature was captured{check?.signature_skipped_reason ? ` — ${check.signature_skipped_reason}` : ""}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}