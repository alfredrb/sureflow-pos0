import React from "react";
import { CreditCard, Banknote, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import POSTenderList from "@/components/pos/POSTenderList";
import POSCheckDialog from "@/components/pos/POSCheckDialog";
import { TENDER_OPTIONS, balanceDue, changeFrom, isSettled, resolveTenderAmount } from "@/lib/tenderSplit";
import { hasPinpad, enterNumberOnPinpad, confirmAmountOnPinpad, promptOnPinpad } from "@/lib/pinpadFlow";

// 4690 tender flow: key an amount (or leave it blank for the full balance), then
// press a tender key to COMMIT that tender. Under-tendering leaves a balance and
// waits for the next tender key — that is how split tender happens.
// Gift card stays its own single-tender path because it needs a balance check.
export default function POSPaymentDialog({
  open, onOpenChange, amountDue, loyaltyAppliedAmount, loyaltyMember,
  allowedTenders, tenders, onAddTender, onRemoveTender,
  amountTendered, setAmountTendered,
  giftCardMode, setGiftCardMode,
  giftCardNumber, setGiftCardNumber, giftCardAmount, setGiftCardAmount, giftCardError, giftCardValidating,
  onOpenLoyaltySignup, onSubmit, onSubmitGiftCard, checkContext, pinpadContext,
}) {
  const pad = pinpadContext || {};
  // Customer-facing pinpad: keys the gift card number and confirms the amount due.
  const [padBusy, setPadBusy] = React.useState("");   // "" | "giftcard" | "confirm"
  const [padNote, setPadNote] = React.useState("");
  // Check tender routes through the cheque station first (MICR read + franking)
  // and only becomes a committed tender once the cheque is accepted.
  const [checkOpen, setCheckOpen] = React.useState(false);
  const [checkAmount, setCheckAmount] = React.useState(0);
  const options = allowedTenders ? TENDER_OPTIONS.filter(t => allowedTenders.includes(t.m)) : TENDER_OPTIONS;
  const balance = balanceDue(amountDue, tenders);
  const change = changeFrom(amountDue, tenders);
  const settled = isSettled(amountDue, tenders);
  const giftCardAllowed = !allowedTenders || allowedTenders.includes("giftcard");

  const commit = (method) => {
    const amt = resolveTenderAmount(method, amountTendered, amountDue, tenders);
    if (amt <= 0) return;
    if (method === "check") {
      setCheckAmount(amt);
      setCheckOpen(true);
      return;
    }
    onAddTender({ method, amount: amt });
    setAmountTendered("");
  };

  // Gift card number keyed by the customer on the pad instead of read aloud.
  const readGiftCardFromPad = async () => {
    setPadBusy("giftcard"); setPadNote("");
    const value = await enterNumberOnPinpad(pad, { title: "ENTER GIFT CARD NUMBER", maxLength: 24 });
    setPadBusy("");
    if (value) setGiftCardNumber(value);
    else setPadNote("The pinpad did not return a number — key it here instead.");
  };

  // The customer approves the amount on the pad before the sale commits. An
  // unreachable pad reads as approved so the lane is never stuck.
  const submitWithPadApproval = async () => {
    if (!hasPinpad(pad)) { onSubmit(); return; }
    setPadBusy("confirm"); setPadNote("");
    const { approved } = await confirmAmountOnPinpad(pad, amountDue);
    setPadBusy("");
    if (!approved) {
      promptOnPinpad(pad, "CANCELLED", ["Please see the cashier."]);
      setPadNote("Customer declined the amount on the pinpad.");
      return;
    }
    onSubmit();
  };

  const onCheckAccepted = (t) => {
    setCheckOpen(false);
    setAmountTendered("");
    onAddTender({ method: "check", amount: t.amount, reference: t.reference });
  };

  return (
    <>
    {/* Cheque station prompt lives OUTSIDE the tender dialog — nested inside it the
        parent's overlay and focus trap sat on top of it, so the insert-cheque
        prompt never became visible or clickable. */}
    <POSCheckDialog open={checkOpen} onOpenChange={setCheckOpen}
      amount={checkAmount} context={checkContext || {}} onAccept={onCheckAccepted} />
    <Dialog open={open && !checkOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">
            {settled ? "Payment Complete" : `Balance Due — $${balance.toFixed(2)}`}
            {loyaltyAppliedAmount > 0 && <span className="text-sky-400 text-[10px] ml-2">(after ${loyaltyAppliedAmount.toFixed(2)} rewards)</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-between text-[11px] text-blue-300/60">
            <span>Sale total</span>
            <span className="font-mono">${Number(amountDue).toFixed(2)}</span>
          </div>

          <POSTenderList tenders={tenders} onRemove={onRemoveTender} />

          {giftCardMode ? (
            <div>
              <label className="text-blue-300/60 text-[10px] mb-1 block">Gift Card Number</label>
              <Input value={giftCardNumber} onChange={e => setGiftCardNumber(e.target.value)}
                placeholder="Enter gift card number" className="bg-[#0a0e27] border-blue-500/10 text-white mb-2" />
              {hasPinpad(pad) && (
                <button onClick={readGiftCardFromPad} disabled={!!padBusy}
                  className="mb-3 w-full rounded-lg border border-sky-500/20 bg-sky-500/10 py-2 text-[10px] uppercase tracking-wider text-sky-300 hover:bg-sky-500/20 disabled:opacity-50">
                  {padBusy === "giftcard" ? "Waiting on the pinpad..." : "Have Customer Key It On The Pinpad"}
                </button>
              )}
              {padNote && <p className="mb-2 text-center text-[10px] text-amber-300">{padNote}</p>}
              <label className="text-blue-300/60 text-[10px] mb-1 block">Amount to Charge</label>
              <Input value={giftCardAmount} onChange={e => setGiftCardAmount(e.target.value)} type="number" step="0.01"
                placeholder="0.00" className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
              {giftCardError && <p className="text-red-400 text-xs mt-2 text-center">{giftCardError}</p>}
              <button onClick={() => setGiftCardMode(false)} className="w-full text-blue-300/50 hover:text-blue-200 text-[10px] uppercase tracking-wider py-2">
                Back to tenders
              </button>
              <Button onClick={onSubmitGiftCard} disabled={giftCardValidating}
                className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-bold text-base rounded-xl disabled:opacity-50">
                {giftCardValidating ? "Validating..." : "Charge Gift Card"}
              </Button>
            </div>
          ) : (
            <>
              {!settled && (
                <div>
                  <label className="text-blue-300/60 text-[10px] mb-1 block">
                    Amount — leave blank to tender the full balance
                  </label>
                  <Input value={amountTendered} onChange={e => setAmountTendered(e.target.value)} type="number" step="0.01" autoFocus
                    className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" placeholder={balance.toFixed(2)} />
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[1, 5, 10, 20, 50, 100].map(v => (
                      <button key={v} onClick={() => setAmountTendered(String(v))}
                        className="py-1.5 rounded-md bg-[#0a0e27] border border-blue-500/10 text-blue-200 text-xs hover:bg-[#161d50] transition-colors">${v}</button>
                    ))}
                    <button onClick={() => setAmountTendered(balance.toFixed(2))}
                      className="py-1.5 rounded-md bg-blue-600/20 border border-blue-500/20 text-blue-300 text-xs col-span-2 hover:bg-blue-600/30 transition-colors">Exact</button>
                  </div>
                </div>
              )}

              {!settled && (
                <div className="grid grid-cols-3 gap-2">
                  {options.map(({ m, label }) => (
                    <button key={m} onClick={() => commit(m)}
                      className="py-2.5 rounded-xl border bg-[#0a0e27] border-blue-500/10 text-blue-200 hover:border-blue-500/40 hover:bg-[#161d50] flex flex-col items-center gap-1 transition-colors"
                    >
                      {m === "cash" ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                      <span className="text-[10px] font-medium">{label}</span>
                    </button>
                  ))}
                  {giftCardAllowed && tenders.length === 0 && (
                    <button onClick={() => setGiftCardMode(true)}
                      className="py-2.5 rounded-xl border bg-[#0a0e27] border-blue-500/10 text-blue-200 hover:border-blue-500/40 hover:bg-[#161d50] flex flex-col items-center gap-1 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Gift Card</span>
                    </button>
                  )}
                </div>
              )}

              {change > 0 && (
                <p className="text-green-400 text-center text-base font-bold">Change: ${change.toFixed(2)}</p>
              )}

              <button onClick={onOpenLoyaltySignup} className="w-full text-sky-400/70 hover:text-sky-300 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 py-1">
                <Award className="w-3 h-3" /> {loyaltyMember ? "Loyalty Member Linked" : "Sign Up for Loyalty"}
              </button>

              {padNote && !giftCardMode && <p className="text-center text-[10px] text-amber-300">{padNote}</p>}

              <Button onClick={submitWithPadApproval} disabled={!settled || !!padBusy}
                className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-bold text-base rounded-xl disabled:opacity-50">
                {padBusy === "confirm"
                  ? "Customer Approving On Pinpad..."
                  : settled ? "Complete Sale" : `$${balance.toFixed(2)} Still Due`}
              </Button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
    </>
  );
}