import React, { useState } from "react";
import { base44 } from "@/api/data";
import { Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GiftCardSeller from "@/components/GiftCardSeller";
import LoyaltyLookupDialog from "@/components/pos/LoyaltyLookupDialog";
import LoyaltySignUpDialog from "@/components/pos/LoyaltySignUpDialog";

export default function CSModePanel({ operator, onAddGiftCard, toast }) {
  const [showGiftCardSeller, setShowGiftCardSeller] = useState(false);
  const [loyaltyLookupOpen, setLoyaltyLookupOpen] = useState(false);
  const [loyaltySignupOpen, setLoyaltySignupOpen] = useState(false);
  const [balanceCheckDialog, setBalanceCheckDialog] = useState(false);
  const [balanceCheckNumber, setBalanceCheckNumber] = useState("");
  const [balanceCheckLoading, setBalanceCheckLoading] = useState(false);
  const [balanceCheckResult, setBalanceCheckResult] = useState(null);
  const [cashOutDialog, setCashOutDialog] = useState(false);
  const [cashOutNumber, setCashOutNumber] = useState("");
  const [cashOutPin, setCashOutPin] = useState("");
  const [cashOutError, setCashOutError] = useState("");
  const [cashOutLoading, setCashOutLoading] = useState(false);

  const handleBalanceCheck = async () => {
    if (!balanceCheckNumber.trim()) {
      toast({ title: "Error", description: "Please enter a gift card number", variant: "destructive" });
      return;
    }
    setBalanceCheckLoading(true);
    try {
      const cards = await base44.entities.GiftCard.filter({ card_number: balanceCheckNumber.trim() });
      if (cards.length === 0) {
        setBalanceCheckResult({ found: false });
        toast({ title: "Not Found", description: "Gift card not found in system", variant: "destructive" });
      } else {
        const card = cards[0];
        setBalanceCheckResult({ found: true, card });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to check balance", variant: "destructive" });
    }
    setBalanceCheckLoading(false);
  };

  const handleCashOut = async () => {
    if (!cashOutNumber.trim() || !cashOutPin.trim()) {
      setCashOutError("Please enter both card number and manager PIN");
      return;
    }
    setCashOutLoading(true);
    setCashOutError("");
    try {
      // Verify manager PIN
      const ops = await base44.entities.Operator.filter({ pin: cashOutPin });
      const manager = ops.find(o => o.role === "manager");
      if (!manager) {
        setCashOutError("Invalid PIN or insufficient role (Manager required)");
        setCashOutLoading(false);
        return;
      }

      // Find and update gift card
      const cards = await base44.entities.GiftCard.filter({ card_number: cashOutNumber.trim() });
      if (cards.length === 0) {
        setCashOutError("Gift card not found");
        setCashOutLoading(false);
        return;
      }

      const card = cards[0];
      if (card.balance <= 0) {
        setCashOutError("Card has no remaining balance");
        setCashOutLoading(false);
        return;
      }

      // Update card to inactive and record transaction
      await base44.entities.GiftCard.update(card.id, { 
        status: "inactive",
        balance: 0
      });

      // Log the cash out transaction with transaction data
       await base44.entities.RegisterLog.create({
          event_type: "transaction",
          operator_id: operator.operator_id,
          operator_name: operator.full_name,
          operator_role: operator.role,
          register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
          detail: `Gift card cash out: ${card.card_number} — $${card.balance.toFixed(2)} (Manager: ${manager.full_name})`,
          transaction_id: `GCCASH-${Date.now().toString(36).toUpperCase()}`,
          transaction_total: card.balance,
          items: [
            {
              sku: "GIFTCARD_CASHOUT",
              name: `Gift Card Cash Out (${card.card_number})`,
              qty: 1,
              price: card.balance,
              total: card.balance
            }
          ]
        });

      toast({ title: "Cash Out Approved", description: `$${card.balance.toFixed(2)} processed — Card deactivated`, variant: "default" });
      setCashOutDialog(false);
      setCashOutNumber("");
      setCashOutPin("");
    } catch (e) {
      setCashOutError("Failed to process cash out");
    }
    setCashOutLoading(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Headphones className="w-4 h-4 text-amber-400" />
        <p className="text-amber-300 text-xs uppercase tracking-widest font-bold">Customer Service Mode</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Sell Gift Card", color: "#059669", action: () => setShowGiftCardSeller(true) },
          { label: "Card Balance Check", color: "#7c3aed", action: () => setBalanceCheckDialog(true) },
          { label: "Gift Card Cash Out", color: "#dc2626", action: () => setCashOutDialog(true) },
          { label: "Price Match", color: "#b45309", action: () => toast({ title: "Price Match", description: "Enter competitor price to match" }) },
          { label: "Loyalty Lookup", color: "#0369a1", action: () => setLoyaltyLookupOpen(true) },
          { label: "Loyalty Sign Up", color: "#0284c7", action: () => setLoyaltySignupOpen(true) },
          { label: "Gift Receipt", color: "#047857", action: () => toast({ title: "Gift Receipt", description: "Re-print last receipt as gift receipt" }) },
        ].map(({ label, color, action }) => (
          <button
            key={label}
            onClick={action}
            className="rounded-xl text-white font-bold text-sm uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex items-center justify-center p-4 shadow-lg h-20"
            style={{ backgroundColor: color }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center text-amber-300/20">
        <p className="text-xs">Additional CS functions can be added via Admin Panel</p>
      </div>

      {showGiftCardSeller && (
        <GiftCardSeller 
          operator={operator} 
          onAddToCart={onAddGiftCard}
          onClose={() => setShowGiftCardSeller(false)} 
        />
      )}

      <LoyaltyLookupDialog
        open={loyaltyLookupOpen}
        onClose={() => setLoyaltyLookupOpen(false)}
        canApply={false}
        toast={toast}
      />

      <LoyaltySignUpDialog
        open={loyaltySignupOpen}
        onClose={() => setLoyaltySignupOpen(false)}
        operator={operator}
        toast={toast}
      />

      {/* Balance Check Dialog */}
      <Dialog open={balanceCheckDialog} onOpenChange={v => { setBalanceCheckDialog(v); if (!v) { setBalanceCheckNumber(""); setBalanceCheckResult(null); } }}>
        <DialogContent className="bg-[#111638] border-purple-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-purple-400 text-sm">Check Gift Card Balance</DialogTitle>
          </DialogHeader>
          {!balanceCheckResult ? (
            <>
              <p className="text-blue-300/60 text-xs">Scan or enter gift card number</p>
              <Input
                placeholder="Gift Card Number"
                value={balanceCheckNumber}
                onChange={e => setBalanceCheckNumber(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleBalanceCheck()}
                data-softkeyboard
                className="bg-[#0a0e27] border-purple-500/20 text-white placeholder:text-blue-300/20"
                autoFocus
              />
              <Button
                onClick={handleBalanceCheck}
                disabled={balanceCheckLoading || !balanceCheckNumber.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
              >
                {balanceCheckLoading ? "Checking..." : "Check Balance"}
              </Button>
            </>
          ) : balanceCheckResult.found ? (
            <>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-blue-300/50 text-xs">Card Number</p>
                  <p className="text-white font-mono text-sm">{balanceCheckResult.card.card_number}</p>
                </div>
                <div>
                  <p className="text-blue-300/50 text-xs">Current Balance</p>
                  <p className="text-green-400 font-bold text-2xl">${balanceCheckResult.card.balance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-blue-300/50 text-xs">Status</p>
                  <p className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${balanceCheckResult.card.status === "active" ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-300"}`}>
                    {balanceCheckResult.card.status.toUpperCase()}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => { setBalanceCheckDialog(false); setBalanceCheckNumber(""); setBalanceCheckResult(null); }}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white"
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <p className="text-red-400 text-sm font-bold">Card Not Found</p>
              </div>
              <Button
                onClick={() => { setBalanceCheckDialog(false); setBalanceCheckNumber(""); setBalanceCheckResult(null); }}
                className="w-full bg-red-600 hover:bg-red-500 text-white"
              >
                Try Again
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cash Out Dialog */}
      <Dialog open={cashOutDialog} onOpenChange={v => { setCashOutDialog(v); if (!v) { setCashOutNumber(""); setCashOutPin(""); setCashOutError(""); } }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-red-400 text-sm">Gift Card Cash Out</DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">This action requires manager approval. Enter card number and manager PIN.</p>
          <Input
            placeholder="Gift Card Number"
            value={cashOutNumber}
            onChange={e => setCashOutNumber(e.target.value)}
            data-softkeyboard
            className="bg-[#0a0e27] border-red-500/20 text-white placeholder:text-blue-300/20"
          />
          <Input
            type="password"
            placeholder="Manager PIN"
            value={cashOutPin}
            onChange={e => setCashOutPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCashOut()}
            className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
          />
          {cashOutError && <p className="text-red-400 text-xs text-center">{cashOutError}</p>}
          <Button
            onClick={handleCashOut}
            disabled={cashOutLoading || !cashOutNumber.trim() || !cashOutPin.trim()}
            className="w-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
          >
            {cashOutLoading ? "Processing..." : "Approve Cash Out"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}