import React from "react";
import POSGiftCardResultDialog from "@/components/pos/POSGiftCardResultDialog";
import POSTaxExemptDialog from "@/components/pos/POSTaxExemptDialog";
import LoyaltyLookupDialog from "@/components/pos/LoyaltyLookupDialog";
import LoyaltySignUpDialog from "@/components/pos/LoyaltySignUpDialog";
import POSIDVerifyDialog from "@/components/pos/POSIDVerifyDialog";
import POSSerialDialog from "@/components/pos/POSSerialDialog";

// Gift card result, tax exempt, loyalty, age check and serial capture dialogs.
export default function POSCustomerDialogs(p) {
  return (
    <>
      <POSGiftCardResultDialog result={p.giftCardResult} onClose={p.closeGiftCardResult} onComplete={p.completeGiftCardSale} />
      <POSTaxExemptDialog open={p.taxExemptDialog} onClose={() => p.setTaxExemptDialog(false)} onConfirm={p.confirmTaxExempt} initialId={p.taxExemptAppliedId} />
      <LoyaltyLookupDialog open={p.loyaltyLookupOpen} onClose={() => p.setLoyaltyLookupOpen(false)} canApply={true} pinpadContext={p.pinpadContext}
        onApply={(m) => p.applyLoyalty(m, true)} onLink={(m) => p.applyLoyalty(m, false)} toast={p.toast} />
      <LoyaltySignUpDialog open={p.loyaltySignupOpen} onClose={() => p.setLoyaltySignupOpen(false)} operator={p.operator} pinpadContext={p.pinpadContext}
        onCreated={(m) => { p.setLoyaltyMember(m); p.setLoyaltyAppliedAmount(0); }} toast={p.toast} />
      <POSIDVerifyDialog open={!!p.idVerify} product={p.idVerify?.product} age={p.idVerify?.age} onClose={() => p.setIdVerify(null)} onVerified={p.handleIDVerified} />
      <POSSerialDialog open={!!p.serialCapture} product={p.serialCapture?.product} needed={p.serialCapture?.needed || 1}
        onConfirm={(serials) => { const done = p.serialCapture?.onDone; p.setSerialCapture(null); if (done) done(serials); }}
        onClose={() => p.setSerialCapture(null)} />
    </>
  );
}