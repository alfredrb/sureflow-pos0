import React, { useState, useEffect } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSCardLookup from "@/components/cs/CSCardLookup";
import CSManagerAuth from "@/components/cs/CSManagerAuth";
import { cashOutCard } from "@/lib/csGiftCards";
import { logCsEvent } from "@/lib/csAudit";
import { kickDrawer } from "@/lib/drawerKick";

// Cash out the remaining balance. Manager approval runs through the shared
// credential check, and the card is closed once the cash is paid.
export default function CSGiftCardCashOutDialog({ open, onClose, operator, toast }) {
  const [card, setCard] = useState(null);
  const [manager, setManager] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setCard(null); setManager(null); } }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      const paid = await cashOutCard(card, operator, manager);
      await kickDrawer("customer_service");
      await logCsEvent({
        action: "Gift Card Cash Out",
        description: `Gift card ${card.card_number} cashed out for $${paid.toFixed(2)} — approved by ${manager.full_name}`,
        operator,
        eventType: "override",
        extra: { override_operator_id: manager.operator_id, override_operator_name: manager.full_name, override_action: "Gift Card Cash Out" },
        changes: [{ field: "balance", from: paid.toFixed(2), to: "0.00" }],
      });
      toast({ title: "Cash Out Approved", description: `$${paid.toFixed(2)} paid — card deactivated` });
      onClose();
    } catch {
      toast({ title: "Cash Out Failed", description: "The cash out could not be processed.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Gift Card Cash Out" icon={Banknote} accent="text-amber-300">
      {!card ? (
        <CSCardLookup onFound={setCard} requireBalance hint="Scan or key the card being cashed out" />
      ) : !manager ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/20 bg-[#0a0e27] p-3">
            <p className="text-white font-mono text-xs">{card.card_number}</p>
            <p className="text-amber-300 font-bold text-xl mt-1">${Number(card.balance || 0).toFixed(2)}</p>
          </div>
          <CSManagerAuth prompt="A manager must approve paying a gift card balance out in cash." onAuthorized={setManager} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-white font-mono text-xs">{card.card_number}</p>
            <p className="text-amber-300 font-bold text-2xl mt-1">${Number(card.balance || 0).toFixed(2)}</p>
            <p className="text-blue-300/50 text-[10px] mt-1">Approved by {manager.full_name}</p>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-500 font-bold disabled:opacity-40">
            {busy ? "Processing..." : "Pay Cash & Close Card"}
          </Button>
        </div>
      )}
    </CSDialogShell>
  );
}