import React from "react";
import { ShoppingCart, RotateCcw, ArrowLeftRight, DollarSign, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import POSCartItem from "@/components/POSCartItem";

// Left-hand summary panel: the live cart in Sale/CS mode, the refund summary in
// Returns mode, and the returning/replacement breakdown in Exchange mode.
export default function POSTransactionSummary({
  posMode, cart, subtotal, tax, total, sidePreview,
  priceOverrideActive, onUpdateQty, onRemove, onEditPrice, onOpenLoyalty, onPay,
}) {
  const isSale = posMode === "sale" || posMode === "cs";

  return (
    <div className="w-[340px] bg-[#111638] border-r border-blue-500/10 flex flex-col flex-shrink-0">
      <div className="px-3 py-2 border-b border-blue-500/10 flex items-center justify-between">
        <p className="text-blue-300/40 text-[10px] uppercase tracking-widest">
          {posMode === "returns" ? "Return Summary" : posMode === "exchange" ? "Exchange Summary" : "Current Transaction"}
        </p>
        {isSale && (
          <button onClick={onOpenLoyalty} className="text-sky-400/70 hover:text-sky-300 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3" /> Loyalty
          </button>
        )}
      </div>

      {isSale && (
        <>
          {priceOverrideActive && (
            <div className="bg-amber-500/10 border-b-2 border-amber-500/50 px-3 py-1.5 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-400 font-bold text-[10px] uppercase tracking-widest">✎ PRICE OVERRIDE — tap edit on an item to change its price</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-blue-300/20 gap-2">
                <ShoppingCart className="w-8 h-8" />
                <p className="text-xs">No items scanned</p>
              </div>
            ) : cart.map((item) => (
              <POSCartItem key={item.sku} item={item} onUpdateQty={onUpdateQty} onRemove={onRemove} priceOverrideActive={priceOverrideActive} onEditPrice={onEditPrice} />
            ))}
          </div>
          <div className="border-t border-blue-500/10 p-3 space-y-1 flex-shrink-0">
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Tax</span><span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white text-xl font-bold pt-1.5 border-t border-blue-500/10">
              <span>TOTAL</span><span>${total.toFixed(2)}</span>
            </div>
            <Button
              onClick={onPay}
              disabled={cart.length === 0}
              className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-bold text-lg mt-1.5 rounded-xl disabled:opacity-30"
            >
              <DollarSign className="w-5 h-5 mr-1" /> PAY
            </Button>
          </div>
        </>
      )}

      {posMode === "returns" && (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {!sidePreview || sidePreview.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-purple-300/20 gap-2">
                <RotateCcw className="w-8 h-8" />
                <p className="text-xs text-center">Select items to return on the right</p>
              </div>
            ) : sidePreview.items.map((item, i) => (
              <div key={i} className="bg-[#0a0e27] rounded-lg p-2 flex items-center gap-2 border border-purple-500/10">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate font-medium">{item.name}</p>
                  <p className="text-purple-300/40 text-[10px]">${item.price.toFixed(2)} ea · qty {item.qty}</p>
                </div>
                <p className="text-purple-300 font-semibold text-xs w-14 text-right flex-shrink-0">−${item.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-purple-500/10 p-3 space-y-1 flex-shrink-0">
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Subtotal</span><span>−${(sidePreview?.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Tax</span><span>−${(sidePreview?.tax || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-purple-300 text-xl font-bold pt-1.5 border-t border-purple-500/10">
              <span>REFUND</span><span>${(sidePreview?.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}

      {posMode === "exchange" && (
        <>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {!sidePreview ? (
              <div className="flex flex-col items-center justify-center h-full text-teal-300/20 gap-2">
                <ArrowLeftRight className="w-8 h-8" />
                <p className="text-xs text-center">Select items to exchange on the right</p>
              </div>
            ) : (
              <>
                {sidePreview.returnedItems.length > 0 && (
                  <div>
                    <p className="text-purple-300/50 text-[9px] uppercase tracking-wider px-1 mb-1">Returning</p>
                    {sidePreview.returnedItems.map((item, i) => (
                      <div key={i} className="bg-[#0a0e27] rounded-lg p-2 flex items-center gap-2 border border-purple-500/10 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs truncate font-medium">{item.name}</p>
                          <p className="text-purple-300/40 text-[10px]">${item.price.toFixed(2)} · qty {item.qty}</p>
                        </div>
                        <p className="text-purple-300 font-semibold text-xs w-14 text-right flex-shrink-0">−${item.total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {sidePreview.replaceCart.length > 0 && (
                  <div>
                    <p className="text-teal-300/50 text-[9px] uppercase tracking-wider px-1 mb-1">Replacement</p>
                    {sidePreview.replaceCart.map((item, i) => (
                      <div key={i} className="bg-[#0a0e27] rounded-lg p-2 flex items-center gap-2 border border-teal-500/10 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs truncate font-medium">{item.name}</p>
                          <p className="text-teal-300/40 text-[10px]">${item.price.toFixed(2)} · qty {item.qty}</p>
                        </div>
                        <p className="text-teal-300 font-semibold text-xs w-14 text-right flex-shrink-0">+${item.total.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-teal-500/10 p-3 space-y-1 flex-shrink-0">
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Return Value</span><span>−${(sidePreview?.returnValue || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Replace Value</span><span>+${(sidePreview?.replaceValue || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs">
              <span>Net Tax</span><span>{(sidePreview?.netTax || 0) < 0 ? "−" : "+"}${Math.abs(sidePreview?.netTax || 0).toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-xl font-bold pt-1.5 border-t border-teal-500/10 ${(sidePreview?.diff || 0) > 0 ? "text-green-400" : (sidePreview?.diff || 0) < 0 ? "text-red-400" : "text-teal-300"}`}>
              <span>{(sidePreview?.diff || 0) > 0 ? "OWES" : (sidePreview?.diff || 0) < 0 ? "REFUND" : "EVEN"}</span>
              <span>${Math.abs(sidePreview?.diff || 0).toFixed(2)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}