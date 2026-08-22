import React, { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSCardLookup from "@/components/cs/CSCardLookup";
import { reissueLostCard } from "@/lib/csGiftCards";
import { printGiftCardReissueSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";

// Lost / stolen: the reported card is deactivated and its remaining balance is
// moved onto a fresh number, so the old number can never be tendered again.
export default function CSGiftCardLostDialog({ open, onClose, operator, toast }) {
  const [card, setCard] = useState(null);
  const [reason, setReason] = useState("Reported lost or stolen");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setCard(null); setReason("Reported lost or stolen"); } }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const { replacement, balance } = await reissueLostCard(card, operator, reason);
      await logCsEvent({
        action: "Gift Card Reissued (Lost/Stolen)",
        description: `Gift card ${card.card_number} deactivated as lost/stolen — $${balance.toFixed(2)} transferred to ${replacement}. Reason: ${reason}`,
        operator,
        eventType: "override",
        changes: [
          { field: "status", from: String(card.status || "active"), to: "lost" },
          { field: "balance", from: balance.toFixed(2), to: "0.00" },
        ],
      });
      printGiftCardReissueSlip({ old_number: card.card_number, new_number: replacement, balance, reason }, operator).catch(() => {});
      toast({ title: "Replacement Issued", description: `${replacement} — $${balance.toFixed(2)} transferred` });
      onClose();
    } catch {
      toast({ title: "Reissue Failed", description: "The card could not be reissued.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Lost / Stolen Card" icon={ShieldAlert} accent="text-red-300">
      {!card ? (
        <CSCardLookup onFound={setCard} hint="Scan or key the card being reported" />
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-500/20 bg-[#0a0e27] p-3">
            <p className="text-white font-mono text-xs">{card.card_number}</p>
            <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mt-1">
              Balance to transfer ${Number(card.balance || 0).toFixed(2)}
            </p>
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} data-softkeyboard placeholder="Reason"
            className="bg-[#0a0e27] border-red-500/20 text-white text-sm" />
          <p className="text-red-300/70 text-[11px]">
            The old number is deactivated immediately and a new card number is issued with the same balance.
          </p>
          <Button onClick={submit} disabled={busy} className="w-full bg-red-600 hover:bg-red-500 font-bold disabled:opacity-40">
            {busy ? "Reissuing..." : "Deactivate & Reissue"}
          </Button>
        </div>
      )}
    </CSDialogShell>
  );
}