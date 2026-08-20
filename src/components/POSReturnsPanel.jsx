import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { printReceipt } from "@/lib/printReceipt";
import { buildPanelReceiptProps } from "@/lib/posReceiptContext";
import { RotateCcw } from "lucide-react";
import POSNoReceiptReturn from "@/components/pos/POSNoReceiptReturn";
import ReturnModeButtons from "@/components/pos/ReturnModeButtons";
import ReturnReasonDialog from "@/components/pos/ReturnReasonDialog";
import POSSerialVerifyDialog from "@/components/pos/POSSerialVerifyDialog";
import { markSerialReturned, itemHasSerials, isSerialSoldForSku } from "@/lib/serialUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ReturnsPanel({ operator, products, loadData, toast, onPreviewChange, onRegisterLookup }) {
  const [returnTxId, setReturnTxId] = useState("");
  const [returnTransaction, setReturnTransaction] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedItems, setSelectedItems] = useState({}); // { [index]: returnQty }
  // Override flow
  const [overrideDialog, setOverrideDialog] = useState(false);
  const [overridePin, setOverridePin] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideOperator, setOverrideOperator] = useState(null); // set after successful override
  const [expiredItems, setExpiredItems] = useState([]); // indices of items past return period
  const [returnMode, setReturnMode] = useState("receipt"); // "receipt" | "no_receipt" | "manager_override"
  const [reasonOpen, setReasonOpen] = useState(false);
  const [itemDecisions, setItemDecisions] = useState({}); // { [index]: { reason, restockable } }
  const [pendingItem, setPendingItem] = useState(null);
  const [serialVerify, setSerialVerify] = useState(null); // { index, mode }
  const [verifiedSerials, setVerifiedSerials] = useState({}); // { [index]: serial }

  const lookUp = async (idOverride) => {
    const lookupId = (typeof idOverride === "string" ? idOverride : returnTxId).trim().toUpperCase();
    if (!lookupId) return;
    setReturnTxId(lookupId);
    setSearching(true);
    setReturnTransaction(null);
    setSelectedItems({});
    setOverrideOperator(null);
    setExpiredItems([]);
    const results = await base44.entities.Transaction.filter({ transaction_id: lookupId });
    if (results.length === 0) {
      toast({ title: "Not Found", description: "No transaction with that ID", variant: "destructive" });
    } else {
      const tx = results[0];
      if (tx.status === "voided") {
        toast({ title: "Transaction Voided", description: "This transaction was voided and is not eligible for a return.", variant: "destructive" });
      } else if (tx.status !== "completed" && tx.status !== "refunded") {
        toast({ title: "Not Eligible", description: `This transaction has status "${tx.status}" and cannot be returned.`, variant: "destructive" });
      } else {
        // Check which items are past their return period
        const txDate = new Date(tx.created_date);
        const now = new Date();
        const daysSinceTx = (now - txDate) / (1000 * 60 * 60 * 24);
        const expired = [];
        (tx.items || []).forEach((item, i) => {
          const prod = products.find(p => p.sku === item.sku);
          if (prod && prod.return_period_days && prod.return_period_days > 0) {
            if (daysSinceTx > prod.return_period_days) expired.push(i);
          }
        });
        setExpiredItems(expired);
        setReturnTransaction(tx);
      }
    }
    setSearching(false);
  };

  // refunded_qty: { [sku]: qty already refunded }
  const refundedQty = returnTransaction?.refunded_qty || {};

  // How many of this item can still be returned
  const remainingQty = (item) => item.qty - (refundedQty[item.sku] || 0);
  const isItemFullyRefunded = (item) => remainingQty(item) <= 0;
  const isItemExpired = (i) => expiredItems.includes(i);
  const isSerializedProduct = (item) => {
    const prod = products.find(p => p.sku === item.sku);
    return !!(prod?.serialized) || itemHasSerials(item);
  };

  const toggleItem = (i, item) => {
    if (isItemFullyRefunded(item)) return; // blocked
    if (item.payment_method === "giftcard") return; // gift cards non-refundable
    if (isItemExpired(i) && !overrideOperator) {
      setOverrideDialog(true);
      return;
    }
    if (selectedItems[i] !== undefined) {
      // deselect — also drop the stored reason/restock decision and any verified serial
      setSelectedItems(prev => { const n = { ...prev }; delete n[i]; return n; });
      setItemDecisions(prev => { const n = { ...prev }; delete n[i]; return n; });
      setVerifiedSerials(prev => { const n = { ...prev }; delete n[i]; return n; });
    } else {
      // selecting — serialized items must have their serial verified against the LP Serialized Sold Records first
      if (isSerializedProduct(item)) {
        setSerialVerify({ index: i, mode: "inventory" });
        return;
      }
      // prompt for return reason and restock decision first
      setPendingItem(i);
      setReasonOpen(true);
    }
  };

  const verifyReturnSerial = async (serial) => {
    const idx = serialVerify?.index;
    if (idx == null) return false;
    const item = items[idx];
    const s = (serial || "").toUpperCase();
    if ((item?.serial_numbers || []).some(x => (x || "").toUpperCase() === s)) return true;
    return await isSerialSoldForSku(item.sku, s);
  };

  const onSerialVerified = (serial) => {
    const idx = serialVerify?.index;
    setSerialVerify(null);
    if (idx == null) return;
    setVerifiedSerials(prev => ({ ...prev, [idx]: serial }));
    setPendingItem(idx);
    setReasonOpen(true);
  };

  const setReturnQty = (i, qty, item) => {
    const max = remainingQty(item);
    const val = Math.min(Math.max(1, parseInt(qty) || 1), max);
    setSelectedItems(prev => ({ ...prev, [i]: val }));
  };

  const handleOverrideSubmit = async () => {
    setOverrideError("");
    const ops = await base44.entities.Operator.filter({ pin: overridePin });
    const sup = ops.find(o => o.role === "csm" || o.role === "manager");
    if (!sup) {
      setOverrideError("Invalid PIN or insufficient role (CSM/Manager required)");
      return;
    }
    setOverrideOperator(sup);
    setOverrideDialog(false);
    setOverridePin("");
    toast({ title: "Override Granted", description: `${sup.full_name} approved the return period override` });
  };

  const items = returnTransaction?.items || [];
  const selectedCount = Object.keys(selectedItems).length;
  const returnItems = items.filter((_, i) => selectedItems[i] !== undefined).map((item, _, arr) => {
    const origIdx = items.indexOf(item);
    const qty = selectedItems[origIdx];
    const total = +(qty * item.price).toFixed(2);
    return { ...item, qty, total };
  });
  const returnSubtotal = returnItems.reduce((s, i) => s + i.total, 0);
  // Older sales didn't store tax_rate on the line item — fall back to the product's
  // current rate so the tax charged is still refunded.
  const rateFor = (i) => i.tax_rate ?? products.find(p => p.sku === i.sku)?.tax_rate ?? 0;
  const returnTax = +returnItems.reduce((s, i) => s + (i.total * (rateFor(i) / 100)), 0).toFixed(2);
  const returnTotal = +(returnSubtotal + returnTax).toFixed(2);

  // Keying a transaction number on the operator prompt line and pressing Enter
  // runs the same Look Up Transaction as the on-screen field.
  useEffect(() => {
    onRegisterLookup?.((code) => { setReturnMode("receipt"); lookUp(code); });
  }, [onRegisterLookup]);

  // Notify parent of preview state
  useEffect(() => {
    onPreviewChange({ items: returnItems, subtotal: returnSubtotal, tax: returnTax, total: returnTotal, type: "return" });
  }, [returnItems.length, returnTotal]);

  // An item is "returnable" if it still has qty remaining
  const returnableItems = items.filter(item => !isItemFullyRefunded(item));
  // Partial if not all returnable items are selected, or selected qty < remaining qty for any item
  const isPartial = selectedCount > 0 && (
    selectedCount < returnableItems.length ||
    returnItems.some(ri => {
      const origItem = items.find(it => it.sku === ri.sku);
      return origItem && ri.qty < remainingQty(origItem);
    })
  );

  const confirmReturn = () => {
    if (selectedCount === 0) { toast({ title: "No items selected", variant: "destructive" }); return; }
    const decisions = returnItems.map(ri => {
      const origIdx = items.indexOf(ri);
      const d = itemDecisions[origIdx] || {};
      return { sku: ri.sku, name: ri.name, qty: ri.qty, price: ri.price, reason: d.reason || "Other", restockable: d.restockable === true, serial: verifiedSerials[origIdx] || null };
    });
    completeReturn(decisions);
  };

  const onItemReasonComplete = (decisions) => {
    const d = decisions[0];
    if (!d || pendingItem === null) { setReasonOpen(false); setPendingItem(null); return; }
    setItemDecisions(prev => ({ ...prev, [pendingItem]: { reason: d.reason, restockable: d.restockable } }));
    const item = items[pendingItem];
    setSelectedItems(prev => ({ ...prev, [pendingItem]: isSerializedProduct(item) ? 1 : remainingQty(item) }));
    setReasonOpen(false);
    setPendingItem(null);
  };

  const onItemReasonClose = () => {
    setReasonOpen(false);
    setPendingItem(null);
  };

  const completeReturn = async (decisions) => {
    setReasonOpen(false);
    if (returnItems.length === 0) { toast({ title: "No items selected", variant: "destructive" }); return; }
    const txId = "RET-" + Date.now().toString(36).toUpperCase();

    // Restock items flagged restockable, send the rest to Claims
    let restocked = 0, claimed = 0;
    for (const d of decisions) {
      const prod = products.find(p => p.sku === d.sku);
      if (d.restockable) {
        if (prod) { try { await base44.entities.Product.update(prod.id, { stock_qty: (prod.stock_qty || 0) + d.qty }); restocked += d.qty; } catch {} }
      } else {
        const unit_cost = prod?.cost || 0;
        try { await base44.entities.Claim.create({ sku: d.sku, name: d.name, qty: d.qty, unit_cost, total_cost: +(unit_cost * d.qty).toFixed(2), reason: d.reason, condition: "pending", disposition: "pending", status: "open", transaction_id: txId, operator_name: operator.full_name, operator_id: operator.operator_id, date_created: new Date().toISOString(), profit_loss_recorded: false }); claimed += 1; } catch {}
      }
    }

    // Build updated refunded_qty map
    const newRefundedQty = { ...refundedQty };
    returnItems.forEach(ri => {
      newRefundedQty[ri.sku] = (newRefundedQty[ri.sku] || 0) + ri.qty;
    });

    // All refunded if every item's total qty is covered
    const allRefunded = items.every(item => (newRefundedQty[item.sku] || 0) >= item.qty);

    await base44.entities.Transaction.create({
      transaction_id: txId,
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
      items: returnItems,
      subtotal: returnSubtotal,
      tax: returnTax,
      total: returnTotal,
      payment_method: returnTransaction.payment_method,
      status: "refunded",
      refund_type: isPartial ? "partial" : "total",
      amount_tendered: returnTotal,
      change_due: 0,
      ...(overrideOperator ? { override_operator_id: overrideOperator.operator_id, override_operator_name: overrideOperator.full_name } : {})
    });

    await base44.entities.Transaction.update(returnTransaction.id, {
      status: allRefunded ? "refunded" : "completed",
      refund_type: isPartial ? "partial" : "total",
      refunded_qty: newRefundedQty,
      ...(overrideOperator ? { override_operator_id: overrideOperator.operator_id, override_operator_name: overrideOperator.full_name } : {})
    });

    for (const d of decisions) {
      if (d.serial) { try { await markSerialReturned(d.sku, d.serial, { returnTransactionId: txId }); } catch {} }
    }

    // Print the refund slip on the same 42-column formatter used for sales.
    printReceipt(buildPanelReceiptProps({
      operator,
      docType: "return",
      transactionId: txId,
      items: returnItems,
      subtotal: returnSubtotal,
      tax: returnTax,
      total: returnTotal,
      paymentMethod: returnTransaction.payment_method,
      amountTendered: returnTotal,
      changeDue: 0,
      openDrawer: returnTransaction.payment_method === "cash",
    }));

    toast({ title: `${isPartial ? "Partial" : "Total"} Return Processed`, description: `${txId} — $${returnTotal.toFixed(2)} returned · ${restocked} restocked · ${claimed} to Claims` });
    setReturnTxId(""); setReturnTransaction(null); setSelectedItems({}); setOverrideOperator(null); setExpiredItems([]); setVerifiedSerials({}); setItemDecisions({});
    onPreviewChange(null);
    loadData();
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <RotateCcw className="w-4 h-4 text-purple-400" />
        <p className="text-purple-300 text-xs uppercase tracking-widest font-bold">Returns / Refunds</p>
      </div>

      {/* Return type buttons */}
      <ReturnModeButtons
        returnMode={returnMode}
        onSelect={(m) => { setReturnMode(m); setReturnTransaction(null); setSelectedItems({}); setOverrideOperator(null); setExpiredItems([]); onPreviewChange(null); }}
      />

      {returnMode === "receipt" && (
      <>
      {/* Search */}
      <div className="bg-[#111638] rounded-xl border border-purple-500/10 p-3 space-y-2 flex-shrink-0">
        <label className="text-blue-300/50 text-[10px] uppercase tracking-wider block">Look Up Transaction</label>
        <div className="flex gap-2">
          <Input
            value={returnTxId}
            onChange={e => setReturnTxId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && lookUp(returnTxId)}
            placeholder="TX-XXXXXXXX"
            className="bg-[#0a0e27] border-purple-500/20 text-white font-mono placeholder:text-blue-300/20"
          />
          <Button disabled={searching || !returnTxId} onClick={() => lookUp(returnTxId)} className="bg-purple-600 hover:bg-purple-500 flex-shrink-0">
            {searching ? "..." : "Look Up"}
          </Button>
        </div>
      </div>

      {/* Result */}
      {returnTransaction ? (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* TX summary */}
          <div className="bg-[#111638] rounded-xl border border-purple-500/20 p-3 flex-shrink-0 space-y-2">
            {Object.keys(refundedQty).length > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">⚠ Partial Refund Already Issued</span>
                <span className="text-amber-300/70 text-[10px]">— remaining qty shown per item</span>
              </div>
            )}
            {overrideOperator && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                <span className="text-green-400 text-[10px] font-bold uppercase tracking-wider">✓ Override Approved</span>
                <span className="text-green-300/70 text-[10px]">by {overrideOperator.full_name}</span>
              </div>
            )}
            {expiredItems.length > 0 && !overrideOperator && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">⚠ Return Period Expired</span>
                <span className="text-red-300/70 text-[10px]">— flagged items require CSM or Manager override to select</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><p className="text-blue-300/40 text-[10px]">TX ID</p><p className="text-white font-mono text-[10px]">{returnTransaction.transaction_id}</p></div>
              <div><p className="text-blue-300/40 text-[10px]">Payment</p><p className="text-white capitalize">{returnTransaction.payment_method}</p></div>
              <div><p className="text-blue-300/40 text-[10px]">Original Total</p><p className="text-purple-300 font-bold">${returnTransaction.total?.toFixed(2)}</p></div>
            </div>
          </div>

          {/* Item selection */}
          <div className="flex-1 overflow-y-auto bg-[#111638] rounded-xl border border-purple-500/20 p-3">
            <p className="text-blue-300/40 text-[10px] uppercase tracking-wider mb-2">Select Items to Return</p>
            <div className="space-y-2">
              {items.map((item, i) => {
                const fullyRefunded = isItemFullyRefunded(item);
                const isGiftCard = item.payment_method === "giftcard";
                const expired = isItemExpired(i);
                const needsOverride = expired && !overrideOperator;
                const checked = selectedItems[i] !== undefined;
                const alreadyReturnedQty = refundedQty[item.sku] || 0;
                const maxReturnable = remainingQty(item);
                return (
                  <div key={i}
                    className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                      fullyRefunded || isGiftCard
                        ? "border-gray-700/30 bg-gray-800/20 opacity-40 cursor-not-allowed"
                        : needsOverride
                        ? "border-red-500/30 bg-red-500/5 cursor-pointer hover:border-red-500/50"
                        : checked
                        ? "border-purple-500/40 bg-purple-500/10 cursor-pointer"
                        : "border-blue-500/10 bg-[#0a0e27] hover:border-blue-500/20 cursor-pointer"
                    }`}
                    onClick={() => !fullyRefunded && !isGiftCard && toggleItem(i, item)}>
                    {/* Checkbox / status icon */}
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      fullyRefunded || isGiftCard ? "border-gray-600 bg-gray-700" :
                      needsOverride ? "border-red-500/50" :
                      checked ? "bg-purple-600 border-purple-500" : "border-blue-500/30"
                    }`}>
                      {(fullyRefunded || isGiftCard) && <span className="text-gray-400 text-[10px]">✕</span>}
                      {!fullyRefunded && !isGiftCard && checked && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${fullyRefunded || isGiftCard ? "text-gray-500" : "text-white"}`}>{item.name}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-blue-300/40 text-[10px]">${item.price?.toFixed(2)} ea</p>
                        {isGiftCard
                          ? <span className="text-[9px] text-red-400 font-bold uppercase">⚠ Refund Not Allowed</span>
                          : alreadyReturnedQty > 0 && !fullyRefunded
                          ? <span className="text-[9px] text-amber-400/80 font-bold uppercase">{alreadyReturnedQty} of {item.qty} returned · {maxReturnable} left</span>
                          : fullyRefunded
                          ? <span className="text-[9px] text-red-400/70 font-bold uppercase">All {item.qty} returned</span>
                          : <span className="text-blue-300/30 text-[10px]">qty: {item.qty}</span>
                        }
                        {needsOverride && <span className="text-[9px] text-red-400 font-bold uppercase">⚠ Past Return Period</span>}
                        {verifiedSerials[i] && <span className="text-[9px] text-indigo-400 font-bold font-mono">SN: {verifiedSerials[i]}</span>}
                      </div>
                    </div>
                    {checked && !fullyRefunded && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setReturnQty(i, (selectedItems[i] || 1) - 1, item)}
                          className="w-5 h-5 rounded bg-purple-600/30 text-purple-300 flex items-center justify-center hover:bg-purple-600/50 text-xs">−</button>
                        <span className="text-white text-xs w-5 text-center font-bold">{selectedItems[i]}</span>
                        <button onClick={() => setReturnQty(i, (selectedItems[i] || 1) + 1, item)}
                          className="w-5 h-5 rounded bg-purple-600/30 text-purple-300 flex items-center justify-center hover:bg-purple-600/50 text-xs">+</button>
                      </div>
                    )}
                    {!fullyRefunded && (
                      <p className="text-purple-300 text-xs font-semibold w-14 text-right flex-shrink-0">
                        {checked ? `$${(selectedItems[i] * item.price).toFixed(2)}` : `$${(maxReturnable * item.price).toFixed(2)}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-[#111638] rounded-xl border border-purple-500/20 p-3 flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPartial ? "bg-amber-500/20 text-amber-300" : "bg-purple-500/20 text-purple-300"}`}>
                  {selectedCount === 0 ? "NO ITEMS SELECTED" : isPartial ? "PARTIAL REFUND" : "TOTAL REFUND"}
                </span>
                <span className="text-blue-300/40 text-[10px]">{selectedCount} item{selectedCount !== 1 ? "s" : ""} selected</span>
              </div>
              <span className="text-white font-bold text-base">${returnTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setReturnTxId(""); setReturnTransaction(null); setSelectedItems({}); setOverrideOperator(null); setExpiredItems([]); onPreviewChange(null); }}
                variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10">Cancel</Button>
              <Button onClick={confirmReturn} disabled={selectedCount === 0}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-40">
                Confirm Return — ${returnTotal.toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-blue-300/20 gap-3">
          <RotateCcw className="w-12 h-12" />
          <p className="text-xs">Enter a Transaction ID above to begin a return</p>
        </div>
      )}
      </>
      )}

      {returnMode !== "receipt" && (
        <POSNoReceiptReturn
          mode={returnMode}
          operator={operator}
          products={products}
          loadData={loadData}
          toast={toast}
          onPreviewChange={onPreviewChange}
          onBack={() => { setReturnMode("receipt"); onPreviewChange(null); }}
        />
      )}

      {/* Override Dialog */}
      <Dialog open={overrideDialog} onOpenChange={v => { setOverrideDialog(v); if (!v) { setOverridePin(""); setOverrideError(""); } }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-red-400 text-sm">Return Period Override</DialogTitle></DialogHeader>
          <p className="text-blue-300/60 text-xs">This item is past its return period. A CSM or Manager PIN is required to proceed.</p>
          <Input
            type="password"
            placeholder="CSM / Manager PIN"
            value={overridePin}
            onChange={e => setOverridePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleOverrideSubmit()}
            className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
          />
          {overrideError && <p className="text-red-400 text-xs text-center">{overrideError}</p>}
          <Button onClick={handleOverrideSubmit} className="w-full bg-red-600 hover:bg-red-500 text-white">Authorize Override</Button>
        </DialogContent>
      </Dialog>

      <ReturnReasonDialog
        open={reasonOpen}
        items={pendingItem !== null ? [{ ...items[pendingItem], qty: isSerializedProduct(items[pendingItem]) ? 1 : remainingQty(items[pendingItem]) }] : []}
        onClose={onItemReasonClose}
        onComplete={onItemReasonComplete}
      />

      <POSSerialVerifyDialog
        open={!!serialVerify}
        item={serialVerify ? items[serialVerify.index] : null}
        mode={serialVerify?.mode || "inventory"}
        verify={verifyReturnSerial}
        onVerified={onSerialVerified}
        onClose={() => setSerialVerify(null)}
      />
    </div>
  );
}