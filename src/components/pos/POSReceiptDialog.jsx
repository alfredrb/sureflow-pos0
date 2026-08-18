import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import POSReceipt from "@/components/POSReceipt";

// On-screen receipt shown after a completed sale. Presentational only — the
// barcode is rendered into the svg id below by the POS page.
export default function POSReceiptDialog({ receiptData, taxExempt, storeConfig, storeInfo, operator, registerId, onClose, onDone }) {
  if (!receiptData) return null;

  return (
    <Dialog open={!!receiptData} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white text-sm">Transaction Complete</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-[#0a0e27] rounded-lg p-4 space-y-2 font-mono text-xs">
            <div className="text-center font-bold border-b pb-2">RECEIPT</div>
            <div className="space-y-1">
              <div>TX ID: {receiptData.transactionId}</div>
              <div>Date: {new Date().toLocaleString()}</div>
              <div>Register: {receiptData.registerName}</div>
              <div>Operator: {receiptData.operatorName}</div>
            </div>
            <div className="border-t border-b py-2 space-y-1">
              {receiptData.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>{item.qty}x {item.name}</span>
                    <span>${item.total.toFixed(2)}</span>
                  </div>
                  {item.serial_numbers && item.serial_numbers.length > 0 && (
                    <div className="pl-2">
                      {item.serial_numbers.map((sn, i) => (
                        <div key={i} className="text-[10px] text-indigo-300/70">SN: {sn}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${receiptData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>${receiptData.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>TOTAL:</span>
                <span>${receiptData.total.toFixed(2)}</span>
              </div>
              {receiptData.rewardsApplied > 0 && (
                <>
                  <div className="flex justify-between text-sky-400">
                    <span>Rewards Credit:</span>
                    <span>−${receiptData.rewardsApplied.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Amount Due:</span>
                    <span>${(receiptData.total - receiptData.rewardsApplied).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
            {receiptData.paymentMethod === "cash" && (
              <div className="border-t pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Tendered:</span>
                  <span>${receiptData.amountTendered.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Change:</span>
                  <span>${receiptData.changeDue.toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="border-t pt-3 space-y-3">
              <div className="flex justify-center">
                <svg id={`barcode-${receiptData.transactionId}`} style={{ maxWidth: "90%" }}></svg>
              </div>
              {receiptData.items.some(i => i.is_giftcard) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded px-2 py-2">
                  <p className="text-center text-amber-400 font-bold text-[9px] uppercase tracking-wider">⚠ Gift Cards Not Refundable</p>
                  <p className="text-center text-amber-400/70 text-[8px] mt-1">Cannot be exchanged for cash or credit</p>
                </div>
              )}
              {taxExempt && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-2 text-left space-y-0.5">
                  <p className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">Tax Exempt — {taxExempt.name}</p>
                  <p className="text-emerald-400/70 text-[9px]">{taxExempt.tax_exempt_id} · {taxExempt.exemption_type}{taxExempt.tax_id_number ? ` · Tax ID ${taxExempt.tax_id_number}` : ""}</p>
                  <p className="text-emerald-400/60 text-[9px]">{[taxExempt.address_street, taxExempt.address_city, taxExempt.address_state, taxExempt.address_zip].filter(Boolean).join(", ")}</p>
                </div>
              )}
              {receiptData.loyaltyMember && (
                <div className="bg-sky-500/10 border border-sky-500/30 rounded px-2 py-2 text-left space-y-0.5">
                  <p className="text-sky-400 font-bold text-[9px] uppercase tracking-wider">Loyalty Member — {receiptData.loyaltyMember.name}</p>
                  <p className="text-sky-400/70 text-[9px]">{receiptData.loyaltyMember.loyalty_id}</p>
                  <p className="text-sky-400/70 text-[9px]">Earned this visit: ${receiptData.rewardsEarned.toFixed(2)}</p>
                  <p className="text-sky-400 font-bold text-[9px]">Remaining Balance: ${receiptData.newBalance != null ? receiptData.newBalance.toFixed(2) : (receiptData.loyaltyMember.rewards_balance || 0).toFixed(2)}</p>
                </div>
              )}
              <p className="text-center text-[10px] text-blue-300/60">Thank You!</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDone} className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              Done
            </Button>
            <POSReceipt
              transactionId={receiptData.transactionId}
              operatorName={receiptData.operatorName}
              registerName={receiptData.registerName}
              items={receiptData.items}
              subtotal={receiptData.subtotal}
              tax={receiptData.tax}
              total={receiptData.total}
              paymentMethod={receiptData.paymentMethod}
              amountTendered={receiptData.amountTendered}
              changeDue={receiptData.changeDue}
              taxExempt={taxExempt}
              storeConfig={storeConfig}
              loyaltyMember={receiptData.loyaltyMember}
              rewardsApplied={receiptData.rewardsApplied || 0}
              rewardsEarned={receiptData.rewardsEarned || 0}
              newBalance={receiptData.newBalance}
              operatorPin={operator?.pin}
              registerId={registerId}
              storeNumber={storeInfo?.store_number}
              managerName={storeInfo?.manager_name}
              taxRate={storeInfo?.default_tax_rate}
              storeInfo={storeInfo}
              autoPrint
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}