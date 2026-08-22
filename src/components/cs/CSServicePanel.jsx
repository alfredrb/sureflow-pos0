import React, { useEffect, useState } from "react";
import { Headphones } from "lucide-react";
import { base44 } from "@/api/data";
import { visibleCards } from "@/lib/csServiceCards";
import useCsRecentActions from "@/hooks/useCsRecentActions";
import CSServiceCard from "@/components/cs/CSServiceCard";
import CSRecentRow from "@/components/cs/CSRecentRow";
import GiftCardSeller from "@/components/GiftCardSeller";
import LoyaltyLookupDialog from "@/components/pos/LoyaltyLookupDialog";
import LoyaltySignUpDialog from "@/components/pos/LoyaltySignUpDialog";
import POSNoReceiptReturn from "@/components/pos/POSNoReceiptReturn";
import CSGiftCardBalanceDialog from "@/components/cs/CSGiftCardBalanceDialog";
import CSGiftCardReloadDialog from "@/components/cs/CSGiftCardReloadDialog";
import CSGiftCardHistoryDialog from "@/components/cs/CSGiftCardHistoryDialog";
import CSGiftCardLostDialog from "@/components/cs/CSGiftCardLostDialog";
import CSGiftCardCashOutDialog from "@/components/cs/CSGiftCardCashOutDialog";
import CSCheckCashingDialog from "@/components/cs/CSCheckCashingDialog";
import CSPriceMatchDialog from "@/components/cs/CSPriceMatchDialog";
import CSGiftReceiptDialog from "@/components/cs/CSGiftReceiptDialog";
import CSPurchaseHistoryDialog from "@/components/cs/CSPurchaseHistoryDialog";
import CSRainCheckDialog from "@/components/cs/CSRainCheckDialog";

// The Customer Service desk: grouped service cards, a Recently Used row, and one
// dialog per service action. The no-receipt return takes over the panel because
// it is a full flow rather than a dialog.
export default function CSServicePanel({
  operator, products = [], cart = [], lastReceipt, toast, loadData,
  onAddGiftCard, onPreviewChange, onApplyPriceMatch, pinpadContext, checkContext,
}) {
  const [enabledCards, setEnabledCards] = useState(null);
  const [active, setActive] = useState(null);   // action id currently open
  const { recent, remember } = useCsRecentActions();

  useEffect(() => {
    base44.entities.StoreSettings.list()
      .then((rows) => setEnabledCards(rows[0]?.cs_service_cards ?? null))
      .catch(() => {});
  }, []);

  const cards = visibleCards(enabledCards);
  const close = () => setActive(null);

  const run = (actionId) => { remember(actionId); setActive(actionId); };

  // No-receipt return replaces the card grid until the operator backs out.
  if (active === "ret_no_receipt") {
    return (
      <POSNoReceiptReturn
        mode="no_receipt"
        operator={operator}
        products={products}
        loadData={loadData}
        toast={toast}
        onPreviewChange={onPreviewChange}
        onBack={() => { onPreviewChange?.(null); close(); }}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Headphones className="w-4 h-4 text-amber-400" />
        <p className="text-amber-300 text-xs uppercase tracking-widest font-bold">Customer Service</p>
      </div>

      <CSRecentRow recent={recent} onAction={run} />

      <div className="flex-1 overflow-y-auto grid grid-cols-1 xl:grid-cols-2 gap-3 auto-rows-min pr-1">
        {cards.map((card) => <CSServiceCard key={card.id} card={card} onAction={run} />)}
        {cards.length === 0 && (
          <p className="text-amber-300/30 text-xs">No service cards are enabled for this store.</p>
        )}
      </div>

      {active === "gc_sell" && (
        <GiftCardSeller operator={operator} onAddToCart={onAddGiftCard} onClose={close} />
      )}
      <CSGiftCardBalanceDialog open={active === "gc_balance"} onClose={close} pinpadContext={pinpadContext} />
      <CSGiftCardReloadDialog open={active === "gc_reload"} onClose={close} operator={operator} toast={toast} pinpadContext={pinpadContext} />
      <CSGiftCardHistoryDialog open={active === "gc_history"} onClose={close} operator={operator} toast={toast} />
      <CSGiftCardLostDialog open={active === "gc_lost"} onClose={close} operator={operator} toast={toast} />
      <CSGiftCardCashOutDialog open={active === "gc_cashout"} onClose={close} operator={operator} toast={toast} />

      <LoyaltyLookupDialog open={active === "loy_lookup"} onClose={close} canApply={false} toast={toast} />
      <LoyaltySignUpDialog open={active === "loy_signup"} onClose={close} operator={operator} toast={toast} />

      <CSPriceMatchDialog open={active === "ret_price_match"} onClose={close} operator={operator} cart={cart} onApplyPriceMatch={onApplyPriceMatch} toast={toast} />
      <CSCheckCashingDialog open={active === "chk_cash"} onClose={close} operator={operator} toast={toast} checkContext={checkContext} />
      <CSGiftReceiptDialog open={active === "rec_gift"} onClose={close} operator={operator} lastReceipt={lastReceipt} toast={toast} />
      <CSPurchaseHistoryDialog open={active === "cus_history"} onClose={close} operator={operator} toast={toast} />
      <CSRainCheckDialog open={active === "cus_raincheck"} onClose={close} operator={operator} products={products} toast={toast} />
    </div>
  );
}