import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSCardLookup from "@/components/cs/CSCardLookup";
import { promptOnPinpad, idlePinpad } from "@/lib/pinpadFlow";

// Balance check. The balance is also thrown up on the customer's pinpad so they
// see it themselves instead of leaning over the operator screen.
export default function CSGiftCardBalanceDialog({ open, onClose, pinpadContext }) {
  const [card, setCard] = useState(null);

  useEffect(() => { if (!open) setCard(null); }, [open]);

  const show = (c) => {
    setCard(c);
    promptOnPinpad(pinpadContext, "GIFT CARD BALANCE", [`CARD ${c.card_number}`, `$${Number(c.balance || 0).toFixed(2)}`]);
  };

  const done = () => { idlePinpad(pinpadContext); onClose(); };

  return (
    <CSDialogShell open={open} onClose={done} title="Gift Card Balance" icon={Search} accent="text-emerald-300">
      {!card ? (
        <CSCardLookup onFound={show} />
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
            <p className="text-blue-300/50 text-[10px] uppercase tracking-wider">Card Number</p>
            <p className="text-white font-mono text-sm">{card.card_number}</p>
            <p className="text-blue-300/50 text-[10px] uppercase tracking-wider pt-1">Current Balance</p>
            <p className="text-emerald-300 font-bold text-3xl">${Number(card.balance || 0).toFixed(2)}</p>
            <p className="text-blue-300/40 text-[10px] uppercase tracking-wider">Status {String(card.status || "").toUpperCase()}</p>
          </div>
          <Button onClick={done} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold">Done</Button>
        </div>
      )}
    </CSDialogShell>
  );
}