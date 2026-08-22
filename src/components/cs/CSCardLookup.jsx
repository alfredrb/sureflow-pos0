import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCard } from "@/lib/csGiftCards";

// Shared "scan or key a gift card" step used by every gift card service action.
export default function CSCardLookup({ onFound, hint = "Scan or key the gift card number", requireBalance = false }) {
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setError(""); setBusy(true);
    try {
      const card = await findCard(number);
      if (!card) setError("Card not found in this system.");
      else if (card.status === "lost") setError(`Card was reported lost — balance moved to ${card.replaced_by_card_number || "a replacement card"}.`);
      else if (requireBalance && !(card.balance > 0)) setError("Card has no remaining balance.");
      else onFound(card);
    } catch {
      setError("Lookup failed — try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-blue-300/60 text-xs">{hint}</p>
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && number.trim() && find()}
        placeholder="Gift Card Number"
        data-softkeyboard
        autoFocus
        className="bg-[#0a0e27] border-white/10 text-white font-mono"
      />
      {error && <p className="text-red-400 text-[11px]">{error}</p>}
      <Button onClick={find} disabled={busy || !number.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold disabled:opacity-40">
        {busy ? "Looking up..." : "Find Card"}
      </Button>
    </div>
  );
}