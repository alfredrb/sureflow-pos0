import React from "react";
import POSActionCodeDialog from "@/components/pos/POSActionCodeDialog";
import POSVoidCashDialog from "@/components/pos/POSVoidCashDialog";
import POSRegisterReadingDialog from "@/components/pos/POSRegisterReadingDialog";
import POSPercentDiscountDialog from "@/components/pos/POSPercentDiscountDialog";
import POSTransferDialog from "@/components/pos/POSTransferDialog";
import POSPriceCheckDialog from "@/components/pos/POSPriceCheckDialog";
import POSResumeDialog from "@/components/pos/POSResumeDialog";
import POSNewsDialog from "@/components/pos/POSNewsDialog";

// Dialogs opened from action codes and register utility keys.
export default function POSActionCodeDialogs(p) {
  const storeId = sessionStorage.getItem("pos_store_id") || "";
  const registerId = sessionStorage.getItem("pos_register_num") || "";
  return (
    <>
      <POSActionCodeDialog open={p.actionCodeOpen} onClose={() => p.setActionCodeOpen(false)} codes={p.actionCodes} storeId={storeId} onSubmit={p.handleActionCode} />
      <POSVoidCashDialog open={p.voidCashOpen} onClose={() => p.setVoidCashOpen(false)} registerId={registerId || "REG-001"} operator={p.operator} shiftStart={sessionStorage.getItem("pos_shift_start")} onConfirmed={p.handleCashVoid} />
      <POSRegisterReadingDialog open={p.readingOpen} onClose={() => p.setReadingOpen(false)} defaultRegisterId={registerId} onSubmit={p.printReading} />
      <POSPercentDiscountDialog open={p.percentOpen} onClose={() => p.setPercentOpen(false)} onSubmit={p.applyPercentOff} />
      <POSTransferDialog open={p.transferOpen} onClose={() => p.setTransferOpen(false)} storeId={storeId} onRetrieve={p.retrieveTransfer} toast={p.toast} />
      <POSPriceCheckDialog open={p.priceCheckOpen} onClose={() => p.setPriceCheckOpen(false)} products={p.products} />
      <POSResumeDialog open={p.resumeOpen} onClose={() => p.setResumeOpen(false)} storeId={storeId} onResume={p.resumeSuspended} toast={p.toast} />
      <POSNewsDialog open={p.newsOpen} onOpenChange={p.setNewsOpen} announcements={p.newsAnnouncements} />
    </>
  );
}