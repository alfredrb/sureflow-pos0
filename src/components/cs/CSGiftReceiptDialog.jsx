import React from "react";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import CSDialogShell from "@/components/cs/CSDialogShell";
import { printGiftReceiptSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";

// Gift receipt: the last completed sale re-printed with prices and totals left
// off, so the item can be returned without showing what was paid.
export default function CSGiftReceiptDialog({ open, onClose, operator, lastReceipt, toast }) {
  const print = async () => {
    await logCsEvent({
      action: "Gift Receipt Printed",
      description: `Gift receipt printed for transaction ${lastReceipt?.transactionId || "unknown"}`,
      operator,
    });
    printGiftReceiptSlip(lastReceipt, operator).catch(() => {});
    toast({ title: "Gift Receipt Printing", description: "Prices are omitted on this copy." });
    onClose();
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Gift Receipt" icon={Receipt} accent="text-teal-300">
      {!lastReceipt ? (
        <p className="text-blue-300/50 text-xs py-4 text-center">No completed sale on this lane yet — a gift receipt can only be printed after a sale.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-teal-500/20 bg-[#0a0e27] p-3 space-y-1">
            <p className="text-white font-mono text-xs">{lastReceipt.transactionId}</p>
            <p className="text-blue-300/50 text-[10px]">
              {(lastReceipt.items || []).reduce((s, i) => s + Number(i.qty || 0), 0)} item(s) · prices will be hidden
            </p>
          </div>
          <Button onClick={print} className="w-full bg-teal-600 hover:bg-teal-500 font-bold">Print Gift Receipt</Button>
        </div>
      )}
    </CSDialogShell>
  );
}