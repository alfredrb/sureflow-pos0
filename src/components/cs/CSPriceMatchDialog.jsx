import React, { useState, useEffect } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CSDialogShell from "@/components/cs/CSDialogShell";
import { printPriceMatchSlip } from "@/lib/csSlips";
import { logCsEvent } from "@/lib/csAudit";

// Price match against an item already on the sale: the competitor price becomes
// the item price and the delta is recorded as the discount.
export default function CSPriceMatchDialog({ open, onClose, operator, cart = [], onApplyPriceMatch, toast }) {
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [competitor, setCompetitor] = useState("");

  useEffect(() => { if (!open) { setSku(""); setPrice(""); setCompetitor(""); } }, [open]);

  const item = cart.find((i) => i.sku === sku);

  const submit = async () => {
    const matched = parseFloat(price);
    if (!item || !(matched >= 0)) { toast({ title: "Price Match", description: "Pick an item and key the competitor price.", variant: "destructive" }); return; }
    if (matched >= item.price) { toast({ title: "No Discount", description: "The matched price must be lower than our price.", variant: "destructive" }); return; }
    onApplyPriceMatch(item.sku, matched);
    await logCsEvent({
      action: "Price Match Applied",
      description: `Price match on ${item.name} (${item.sku}) — $${item.price.toFixed(2)} matched down to $${matched.toFixed(2)}${competitor ? ` (competitor: ${competitor})` : ""}`,
      operator,
      eventType: "override",
      changes: [{ field: "price", from: item.price.toFixed(2), to: matched.toFixed(2) }],
    });
    printPriceMatchSlip({ item_name: item.name, sku: item.sku, was: item.price, now: matched, competitor }, operator).catch(() => {});
    toast({ title: "Price Matched", description: `${item.name} — now $${matched.toFixed(2)}` });
    onClose();
  };

  return (
    <CSDialogShell open={open} onClose={onClose} title="Price Match" icon={Tag} accent="text-fuchsia-300">
      {cart.length === 0 ? (
        <p className="text-blue-300/50 text-xs py-4 text-center">Ring the item up first, then apply the price match to it.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {cart.map((i) => (
              <button key={i.sku} onClick={() => setSku(i.sku)}
                className={`w-full flex items-center justify-between rounded-lg px-2 py-2 text-left border ${sku === i.sku ? "bg-fuchsia-600/20 border-fuchsia-500/40" : "bg-[#0a0e27] border-white/5"}`}>
                <span className="text-white text-xs truncate">{i.name}</span>
                <span className="text-blue-300/50 text-[10px] font-mono">${Number(i.price).toFixed(2)}</span>
              </button>
            ))}
          </div>
          <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="Competitor price" className="bg-[#0a0e27] border-fuchsia-500/20 text-white text-lg h-11 text-center" />
          <Input value={competitor} onChange={(e) => setCompetitor(e.target.value)} data-softkeyboard
            placeholder="Competitor name (optional)" className="bg-[#0a0e27] border-white/10 text-white text-sm" />
          <Button onClick={submit} disabled={!item || !price} className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 font-bold disabled:opacity-40">
            Apply Price Match
          </Button>
        </div>
      )}
    </CSDialogShell>
  );
}