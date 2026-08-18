import React from "react";
import { CreditCard, Banknote, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const TENDERS = [
  { m: "cash", icon: Banknote, label: "Cash" },
  { m: "credit", icon: CreditCard, label: "Credit" },
  { m: "debit", icon: CreditCard, label: "Debit" },
  { m: "check", icon: CreditCard, label: "Check" },
  { m: "store_credit", icon: CreditCard, label: "Store Credit" },
  { m: "giftcard", icon: CreditCard, label: "Gift Card" },
];

// Tender selection + amount entry. All sale processing stays in the POS page.
export default function POSPaymentDialog({
  open, onOpenChange, amountDue, loyaltyAppliedAmount, loyaltyMember,
  paymentMethod, setPaymentMethod, allowedTenders,
  amountTendered, setAmountTendered,
  giftCardNumber, setGiftCardNumber, giftCardAmount, setGiftCardAmount, giftCardError, giftCardValidating,
  onOpenLoyaltySignup, onSubmit,
}) {
  const tenders = allowedTenders ? TENDERS.filter(t => allowedTenders.includes(t.m)) : TENDERS;
  const submitDisabled =
    (paymentMethod === "cash" && parseFloat(amountTendered || 0) < amountDue) ||
    (paymentMethod === "giftcard" && giftCardValidating);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            Payment — ${amountDue.toFixed(2)}
            {loyaltyAppliedAmount > 0 && <span className="text-sky-400 text-[10px] ml-2">(after ${loyaltyAppliedAmount.toFixed(2)} rewards)</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {tenders.map(({ m, icon: Icon, label }) => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`py-2.5 rounded-xl border flex flex-col items-center gap-1 transition-colors ${paymentMethod === m ? "bg-blue-600 border-blue-500 text-white" : "bg-[#0a0e27] border-blue-500/10 text-blue-300/50 hover:border-blue-500/30"}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block">Amount Tendered</label>
              <Input value={amountTendered} onChange={e => setAmountTendered(e.target.value)} type="number" step="0.01"
                className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" placeholder="0.00" />
              <div className="grid grid-cols-4 gap-1 mt-2">
                {[1, 5, 10, 20, 50, 100].map(v => (
                  <button key={v} onClick={() => setAmountTendered(String(v))}
                    className="py-1.5 rounded-md bg-[#0a0e27] border border-blue-500/10 text-blue-200 text-xs hover:bg-[#161d50] transition-colors">${v}</button>
                ))}
                <button onClick={() => setAmountTendered(amountDue.toFixed(2))}
                  className="py-1.5 rounded-md bg-blue-600/20 border border-blue-500/20 text-blue-300 text-xs col-span-2 hover:bg-blue-600/30 transition-colors">Exact</button>
              </div>
              {parseFloat(amountTendered) >= amountDue && (
                <p className="text-green-400 text-center mt-2 text-base font-bold">
                  Change: ${(parseFloat(amountTendered) - amountDue).toFixed(2)}
                </p>
              )}
            </div>
          )}

          {paymentMethod === "giftcard" && (
            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block">Gift Card Number</label>
              <Input value={giftCardNumber} onChange={e => setGiftCardNumber(e.target.value)}
                placeholder="Enter gift card number" className="bg-[#0a0e27] border-blue-500/10 text-white mb-3" />
              <label className="text-blue-300/60 text-[10px] mb-1 block">Amount to Charge</label>
              <Input value={giftCardAmount} onChange={e => setGiftCardAmount(e.target.value)} type="number" step="0.01"
                placeholder="0.00" className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
              {giftCardError && <p className="text-red-400 text-xs mt-2 text-center">{giftCardError}</p>}
            </div>
          )}

          <button onClick={onOpenLoyaltySignup} className="w-full text-sky-400/70 hover:text-sky-300 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 py-1">
            <Award className="w-3 h-3" /> {loyaltyMember ? "Loyalty Member Linked" : "Sign Up for Loyalty"}
          </button>

          <Button onClick={onSubmit} disabled={submitDisabled}
            className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-bold text-base rounded-xl disabled:opacity-50">
            {giftCardValidating ? "Validating..." : "Complete Sale"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}