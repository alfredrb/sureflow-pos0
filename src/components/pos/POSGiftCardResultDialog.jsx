import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Approval / decline result for a gift-card tender. Sale processing lives in the POS page.
export default function POSGiftCardResultDialog({ result, onClose, onComplete }) {
  const approved = !!result?.approved;

  return (
    <Dialog open={!!result} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className={`bg-[#111638] text-white max-w-xs ${approved ? "border-green-500/20" : "border-red-500/20"}`}>
        <DialogHeader>
          <DialogTitle className={approved ? "text-green-400" : "text-red-400"}>
            {approved ? "✓ Payment Approved" : "✕ Payment Declined"}
          </DialogTitle>
        </DialogHeader>
        <div className={`rounded-lg border p-3 space-y-2 ${approved ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className="text-white text-sm">{result?.message}</p>
          {approved && (
            <div className="space-y-1 text-xs pt-2 border-t border-white/10">
              <div className="flex justify-between">
                <span className="text-blue-300/50">Card</span>
                <span className="text-white font-mono">{result.card.card_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-300/50">Charge Amount</span>
                <span className="text-white">${result.chargeAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-300/50">Old Balance</span>
                <span className="text-white">${result.card.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-green-400">
                <span>New Balance</span>
                <span>${(result.card.balance - result.chargeAmount).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
            {approved ? "Close" : "Back"}
          </Button>
          {approved && (
            <Button onClick={onComplete} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold text-xs">
              Complete Payment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}