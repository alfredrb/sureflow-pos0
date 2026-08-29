import React, { useState } from "react";
import { CreditCard, Gift, Star, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SCOPayPanel({ amountDue, loyaltyMember, loyaltyApplied, payBusy, payMessage, loyaltyMessage, onPayCard, onPayGift, onAddLoyalty, onBack }) {
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftNumber, setGiftNumber] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="flex-1 flex flex-col items-center p-8 gap-6 overflow-y-auto">
      <button onClick={onBack} disabled={payBusy} className="self-start text-blue-300/60 hover:text-blue-200 flex items-center gap-2 text-lg disabled:opacity-40">
        <ArrowLeft className="w-5 h-5" /> Back to my items
      </button>

      <div className="text-center">
        <p className="text-blue-300/60 uppercase tracking-widest text-sm mb-1">Amount due</p>
        <p className="text-white font-mono font-bold text-6xl">${amountDue.toFixed(2)}</p>
      </div>

      {/* Loyalty */}
      <div className="w-full max-w-md bg-[#111638] border border-blue-500/10 rounded-2xl p-4">
        {loyaltyMember ? (
          <p className="text-emerald-300 text-sm flex items-center gap-2">
            <Star className="w-4 h-4" /> {loyaltyMember.name} — rewards linked{loyaltyApplied > 0 ? ` · $${loyaltyApplied.toFixed(2)} applied` : ""}
          </p>
        ) : (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onAddLoyalty(phone); }}>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Rewards member? Enter phone #"
              className="bg-[#0a0e27] border-blue-500/20 text-white h-12"
            />
            <button type="submit" disabled={payBusy} className="px-4 rounded-xl bg-[#1a1f4a] text-blue-200 border border-blue-500/10 text-sm font-semibold whitespace-nowrap">Find me</button>
          </form>
        )}
        {loyaltyMessage && <p className="text-amber-300/80 text-xs mt-2">{loyaltyMessage}</p>}
      </div>

      {/* Card-only lane: card + gift card tiles, no cash or check */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={onPayCard}
          disabled={payBusy}
          className="h-32 rounded-3xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-2xl font-bold flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {payBusy ? <Loader2 className="w-8 h-8 animate-spin" /> : <CreditCard className="w-8 h-8" />} Card
        </button>
        <button
          onClick={() => setGiftOpen((v) => !v)}
          disabled={payBusy}
          className="h-32 rounded-3xl bg-purple-600/80 hover:bg-purple-500 disabled:opacity-50 text-white text-2xl font-bold flex flex-col items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Gift className="w-8 h-8" /> Gift Card
        </button>
      </div>

      {giftOpen && (
        <form
          className="w-full max-w-md flex gap-2"
          onSubmit={(e) => { e.preventDefault(); if (giftNumber.trim()) onPayGift(giftNumber.trim()); }}
        >
          <Input
            value={giftNumber}
            onChange={(e) => setGiftNumber(e.target.value)}
            placeholder="Scan or type gift card number"
            autoFocus
            className="bg-[#0a0e27] border-purple-500/20 text-white h-12 font-mono"
          />
          <button type="submit" disabled={payBusy} className="px-5 rounded-xl bg-purple-600 text-white font-semibold">Apply</button>
        </form>
      )}

      {payMessage && <p className="text-amber-300 text-base text-center max-w-md">{payMessage}</p>}
      <p className="text-blue-300/30 text-sm">This lane accepts card and gift card only — for cash, please see a cashier.</p>
    </div>
  );
}