import React, { useState, useEffect } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import CSCardLookup from "@/components/cs/CSCardLookup";
import { reloadCard } from "@/lib/csGiftCards";
import { printGiftCardReloadSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";
import { promptOnPinpad, idlePinpad } from "@/lib/pinpadFlow";
import { kickDrawer } from "@/lib/drawerKick";

// Reload / add value: cash is taken at the desk, the balance goes up, the new
// balance mirrors on the customer's pinpad, and a reload slip prints.
export default function CSGiftCardReloadDialog({ open, onClose, operator, toast, pinpadContext }) {
  const [card, setCard] = useState(null);
  const [amount, setAmount] = useState("25");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!open) { setCard(null); setAmount("25"); } }, [open]);

  const finish = () => { idlePinpad(pinpadContext); onClose(); };

  const submit = async () => {
    const added = parseFloat(amount);
    if (!(added > 0)) { toast({ title: "Invalid Amount", description: "Enter an amount greater than zero.", variant: "destructive" }); return; }
    setBusy(true);
    try {
      const { balance } = await reloadCard(card, added, operator);
      await kickDrawer("customer_service");
      promptOnPinpad(pinpadContext, "GIFT CARD RELOADED", [`CARD ${card.card_number}`, `NEW BALANCE $${balance.toFixed(2)}`]);
      await logCsEvent({
        action: "Gift Card Reload",
        description: `Gift card ${card.card_number} reloaded with $${added.toFixed(2)} — new balance $${balance.toFixed(2)}`,
        operator,
        changes: [{ field: "balance", from: Number(card.balance || 0).toFixed(2), to: balance.toFixed(2) }],
      });
      printGiftCardReloadSlip({ card_number: card.card_number, added, balance }, operator).catch(() => {});
      toast({ title: "Card Reloaded", description: `${card.card_number} — new balance $${balance.toFixed(2)}` });
      finish();
    } catch {
      toast({ title: "Reload Failed", description: "The card could not be reloaded.", variant: "destructive" });
    }
    setBusy(false);
  };

  return (
    <CSDialogShell open={open} onClose={finish} title="Reload Gift Card" icon={PlusCircle} accent="text-emerald-300">
      {!card ? (
        <CSCardLookup onFound={setCard} hint="Scan or key the card being reloaded" />
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-500/20 bg-[#0a0e27] p-3">
            <p className="text-white font-mono text-xs">{card.card_number}</p>
            <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mt-1">Current balance ${Number(card.balance || 0).toFixed(2)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[25, 50, 100].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))}
                className={`py-2 rounded-lg font-bold text-sm ${amount === String(v) ? "bg-emerald-600 text-white" : "bg-[#0a0e27] border border-emerald-500/20 text-emerald-300"}`}>
                ${v}
              </button>
            ))}
          </div>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="bg-[#0a0e27] border-emerald-500/20 text-white text-xl h-12 text-center" placeholder="0.00" />
          <p className="text-blue-300/40 text-[10px] text-center">Collect the cash before adding the value.</p>
          <Button onClick={submit} disabled={busy || !amount} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-40">
            {busy ? "Reloading..." : `Add $${Number(amount || 0).toFixed(2)}`}
          </Button>
        </div>
      )}
    </CSDialogShell>
  );
}