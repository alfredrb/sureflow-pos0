import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44, invalidateEntity } from "@/api/data";
import { LogOut, ShoppingCart, CreditCard, DollarSign, Banknote, X, Search, List, RotateCcw, Headphones, ArrowLeftRight, AlertTriangle } from "lucide-react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import POSCartItem from "@/components/POSCartItem";
import SODProtocolModal from "@/components/SODProtocolModal";
import POSCashManagement from "@/components/POSCashManagement";
import ExportCashHistory from "@/components/ExportCashHistory";
import POSReceipt from "@/components/POSReceipt";
import GiftCardSeller from "@/components/GiftCardSeller";
import POSTaxExemptDialog from "@/components/pos/POSTaxExemptDialog";

const SALE_ACTIONS = ["subtotal", "quantity", "discount_item", "discount_total", "price_override", "repeat_last"];
const NON_SALE_ACTIONS = ["void_item", "void_transaction", "no_sale", "refund", "cash_management", "reprint_receipt", "request_cash_pickup", "request_cash_advance"];
const MISC_ACTIONS = ["price_check", "tax_exempt", "suspend", "resume", "none"];

const SECTION_TABS = [
  { id: "sale", label: "Sale" },
  { id: "non_sale", label: "Non-Sale" },
  { id: "item_list", label: "Item List" },
  { id: "misc", label: "Misc" },
  { id: "advance", label: "Advance" },
];

function getKeysForSection(sectionId, functionKeys) {
  switch (sectionId) {
    case "sale": return functionKeys.filter(fk => SALE_ACTIONS.includes(fk.action));
    case "non_sale": return functionKeys.filter(fk => NON_SALE_ACTIONS.includes(fk.action));
    case "misc": return functionKeys.filter(fk => MISC_ACTIONS.includes(fk.action));
    case "advance": return functionKeys.filter(fk => fk.requires_supervisor);
    default: return [];
  }
}

// ── Returns Panel ────────────────────────────────────────────────────────────
function ReturnsPanel({ operator, products, loadData, toast, onPreviewChange }) {
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

  const lookUp = async () => {
    if (!returnTxId) return;
    setSearching(true);
    setReturnTransaction(null);
    setSelectedItems({});
    setOverrideOperator(null);
    setExpiredItems([]);
    const results = await base44.entities.Transaction.filter({ transaction_id: returnTxId });
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

  const toggleItem = (i, item) => {
    if (isItemFullyRefunded(item)) return; // blocked
    if (item.payment_method === "giftcard") return; // gift cards non-refundable
    if (isItemExpired(i) && !overrideOperator) {
      setOverrideDialog(true);
      return;
    }
    setSelectedItems(prev => {
      if (prev[i] !== undefined) { const n = { ...prev }; delete n[i]; return n; }
      return { ...prev, [i]: remainingQty(item) }; // default to max returnable qty
    });
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
  const returnTax = returnItems.reduce((s, i) => s + (i.total * ((i.tax_rate || 0) / 100)), 0);
  const returnTotal = +(returnSubtotal + returnTax).toFixed(2);

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

  const confirmReturn = async () => {
    if (selectedCount === 0) { toast({ title: "No items selected", variant: "destructive" }); return; }
    const txId = "RET-" + Date.now().toString(36).toUpperCase();

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

    toast({ title: `${isPartial ? "Partial" : "Total"} Return Processed`, description: `${txId} — $${returnTotal.toFixed(2)} returned` });
    setReturnTxId(""); setReturnTransaction(null); setSelectedItems({}); setOverrideOperator(null); setExpiredItems([]);
    onPreviewChange(null);
    loadData();
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <RotateCcw className="w-4 h-4 text-purple-400" />
        <p className="text-purple-300 text-xs uppercase tracking-widest font-bold">Returns / Refunds</p>
      </div>

      {/* Search */}
      <div className="bg-[#111638] rounded-xl border border-purple-500/10 p-3 space-y-2 flex-shrink-0">
        <label className="text-blue-300/50 text-[10px] uppercase tracking-wider block">Look Up Transaction</label>
        <div className="flex gap-2">
          <Input
            value={returnTxId}
            onChange={e => setReturnTxId(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && lookUp()}
            placeholder="TX-XXXXXXXX"
            className="bg-[#0a0e27] border-purple-500/20 text-white font-mono placeholder:text-blue-300/20"
          />
          <Button disabled={searching || !returnTxId} onClick={lookUp} className="bg-purple-600 hover:bg-purple-500 flex-shrink-0">
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
    </div>
  );
}

// ── Exchange Panel ────────────────────────────────────────────────────────────
function ExchangePanel({ operator, products, loadData, toast, onPreviewChange }) {
  const [txId, setTxId] = useState("");
  const [origTx, setOrigTx] = useState(null);
  const [searching, setSearching] = useState(false);
  // returnItems: { [index]: qty } — items being returned
  const [returnSel, setReturnSel] = useState({});
  // replaceItems: products to give the customer in exchange
  const [replaceCart, setReplaceCart] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [step, setStep] = useState("lookup"); // "lookup" | "select"

  const lookUp = async () => {
    if (!txId) return;
    setSearching(true);
    setOrigTx(null); setReturnSel({}); setReplaceCart([]);
    // Allow looking up completed OR partially-refunded (still "completed") transactions
    const results = await base44.entities.Transaction.filter({ transaction_id: txId });
    const valid = results.filter(t => t.status === "completed");
    if (valid.length === 0) toast({ title: "Not Found", description: "No eligible transaction with that ID", variant: "destructive" });
    else { setOrigTx(valid[0]); setStep("select"); }
    setSearching(false);
  };

  const refundedQty = origTx?.refunded_qty || {};
  const remainingQty = (item) => item.qty - (refundedQty[item.sku] || 0);
  const isFullyRefunded = (item) => remainingQty(item) <= 0;

  const toggleReturn = (i, item) => {
    if (isFullyRefunded(item)) return;
    if (item.payment_method === "giftcard") return; // gift cards non-refundable
    setReturnSel(prev => {
      if (prev[i] !== undefined) { const n = { ...prev }; delete n[i]; return n; }
      return { ...prev, [i]: remainingQty(item) };
    });
  };

  const setReturnQty = (i, qty, item) => {
    const max = remainingQty(item);
    setReturnSel(prev => ({ ...prev, [i]: Math.min(Math.max(1, parseInt(qty) || 1), max) }));
  };

  const addReplace = (product) => {
    setReplaceCart(prev => {
      const ex = prev.find(i => i.sku === product.sku);
      if (ex) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1, total: +(( i.qty + 1) * i.price).toFixed(2) } : i);
      return [...prev, { sku: product.sku, name: product.name, price: product.price, qty: 1, total: product.price, tax_rate: product.tax_rate || 0 }];
    });
  };

  const removeReplace = (sku) => setReplaceCart(prev => prev.filter(i => i.sku !== sku));

  const origItems = origTx?.items || [];
  const returnedItems = origItems.filter((_, i) => returnSel[i] !== undefined).map(item => {
    const idx = origItems.indexOf(item);
    const qty = returnSel[idx];
    return { ...item, qty, total: +(qty * item.price).toFixed(2) };
  });
  const returnValue = returnedItems.reduce((s, i) => s + i.total, 0);
  const replaceValue = replaceCart.reduce((s, i) => s + i.total, 0);
  const diff = +(replaceValue - returnValue).toFixed(2);

  // Notify parent of exchange preview
  useEffect(() => {
    if (returnedItems.length > 0 || replaceCart.length > 0) {
      onPreviewChange({ returnedItems, replaceCart, returnValue, replaceValue, diff, type: "exchange" });
    } else {
      onPreviewChange(null);
    }
  }, [returnedItems.length, replaceCart.length, diff]);

  const filteredProducts = products.filter(p =>
    !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.sku.includes(itemSearch)
  );

  const confirmExchange = async () => {
    if (returnedItems.length === 0 || replaceCart.length === 0) {
      toast({ title: "Incomplete", description: "Select items to return and replacement items", variant: "destructive" }); return;
    }
    const exTxId = "EXC-" + Date.now().toString(36).toUpperCase();
    await base44.entities.Transaction.create({
      transaction_id: exTxId,
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
      items: replaceCart,
      subtotal: replaceValue,
      tax: 0,
      total: diff,
      payment_method: origTx.payment_method,
      status: "completed",
      refund_type: "exchange",
      amount_tendered: Math.max(0, diff),
      change_due: diff < 0 ? Math.abs(diff) : 0
    });
    // Track exchanged quantities the same way as refunds
    const newRefundedQty = { ...refundedQty };
    returnedItems.forEach(ri => { newRefundedQty[ri.sku] = (newRefundedQty[ri.sku] || 0) + ri.qty; });
    const allExchanged = origItems.every(item => (newRefundedQty[item.sku] || 0) >= item.qty);
    await base44.entities.Transaction.update(origTx.id, {
      refund_type: "exchange",
      refunded_qty: newRefundedQty,
      status: allExchanged ? "exchanged" : "completed"
    });
    const msg = diff > 0 ? `Customer owes $${diff.toFixed(2)}` : diff < 0 ? `Refund $${Math.abs(diff).toFixed(2)} to customer` : "Even exchange";
    toast({ title: "Exchange Processed", description: `${exTxId} — ${msg}` });
    setTxId(""); setOrigTx(null); setReturnSel({}); setReplaceCart([]); setStep("lookup");
    onPreviewChange(null);
    loadData();
  };

  const reset = () => { setTxId(""); setOrigTx(null); setReturnSel({}); setReplaceCart([]); setStep("lookup"); onPreviewChange(null); };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <ArrowLeftRight className="w-4 h-4 text-teal-400" />
        <p className="text-teal-300 text-xs uppercase tracking-widest font-bold">Item Exchange</p>
      </div>

      {step === "lookup" && (
        <>
          <div className="bg-[#111638] rounded-xl border border-teal-500/10 p-3 space-y-2 flex-shrink-0">
            <label className="text-blue-300/50 text-[10px] uppercase tracking-wider block">Look Up Original Transaction</label>
            <div className="flex gap-2">
              <Input value={txId} onChange={e => setTxId(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && lookUp()}
                placeholder="TX-XXXXXXXX" className="bg-[#0a0e27] border-teal-500/20 text-white font-mono placeholder:text-blue-300/20" />
              <Button disabled={searching || !txId} onClick={lookUp} className="bg-teal-600 hover:bg-teal-500 flex-shrink-0">
                {searching ? "..." : "Look Up"}
              </Button>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-blue-300/20 gap-3">
            <ArrowLeftRight className="w-12 h-12" />
            <p className="text-xs">Enter a Transaction ID to start an exchange</p>
          </div>
        </>
      )}

      {step === "select" && origTx && (
        <div className="flex-1 flex gap-3 overflow-hidden">
          {/* Left: items to return */}
          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            <p className="text-blue-300/40 text-[10px] uppercase tracking-wider flex-shrink-0">① Select Items to Return</p>
            <div className="flex-1 overflow-y-auto bg-[#111638] rounded-xl border border-teal-500/20 p-2 space-y-1.5">
              {origItems.map((item, i) => {
                const fullyRefunded = isFullyRefunded(item);
                const isGiftCard = item.payment_method === "giftcard";
                const checked = returnSel[i] !== undefined;
                const alreadyRet = refundedQty[item.sku] || 0;
                const maxQty = remainingQty(item);
                return (
                  <div key={i} onClick={() => !fullyRefunded && !isGiftCard && toggleReturn(i, item)}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                      fullyRefunded || isGiftCard
                        ? "border-gray-700/30 bg-gray-800/20 opacity-40 cursor-not-allowed"
                        : checked
                        ? "border-teal-500/40 bg-teal-500/10 cursor-pointer"
                        : "border-blue-500/10 bg-[#0a0e27] hover:border-teal-500/20 cursor-pointer"
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${fullyRefunded || isGiftCard ? "border-gray-600 bg-gray-700" : checked ? "bg-teal-600 border-teal-500" : "border-blue-500/30"}`}>
                      {(fullyRefunded || isGiftCard) && <span className="text-gray-400 text-[10px]">✕</span>}
                      {!fullyRefunded && !isGiftCard && checked && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-medium truncate ${fullyRefunded || isGiftCard ? "text-gray-500" : "text-white"}`}>{item.name}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-blue-300/40 text-[9px]">${item.price?.toFixed(2)} ea</p>
                        {isGiftCard
                          ? <span className="text-[9px] text-red-400 font-bold uppercase">⚠ Refund Not Allowed</span>
                          : alreadyRet > 0 && !fullyRefunded && <span className="text-[9px] text-amber-400/80 font-bold uppercase">{alreadyRet} refunded · {maxQty} left</span>}
                        {fullyRefunded && !isGiftCard && <span className="text-[9px] text-red-400/70 font-bold uppercase">Already refunded</span>}
                      </div>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setReturnQty(i, returnSel[i] - 1, item)} className="w-4 h-4 rounded bg-teal-600/30 text-teal-300 flex items-center justify-center text-[10px]">−</button>
                        <span className="text-white text-[10px] w-4 text-center">{returnSel[i]}</span>
                        <button onClick={() => setReturnQty(i, returnSel[i] + 1, item)} className="w-4 h-4 rounded bg-teal-600/30 text-teal-300 flex items-center justify-center text-[10px]">+</button>
                      </div>
                    )}
                    {!fullyRefunded && (
                      <p className="text-teal-300 text-[10px] font-semibold w-10 text-right flex-shrink-0">
                        ${checked ? (returnSel[i] * item.price).toFixed(2) : (maxQty * item.price).toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="bg-[#111638] rounded-lg border border-teal-500/10 p-2 flex justify-between text-xs flex-shrink-0">
              <span className="text-blue-300/50">Return Value</span>
              <span className="text-teal-300 font-bold">${returnValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Right: replacement items */}
          <div className="flex-1 flex flex-col gap-2 overflow-hidden">
            <p className="text-blue-300/40 text-[10px] uppercase tracking-wider flex-shrink-0">② Select Replacement Items</p>
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-300/30" />
              <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search products..."
                className="pl-7 bg-[#0a0e27] border-teal-500/10 text-white text-xs h-7 placeholder:text-blue-300/20" />
            </div>
            <div className="flex-1 overflow-y-auto bg-[#111638] rounded-xl border border-teal-500/20 p-2 space-y-1.5">
              {filteredProducts.slice(0, 20).map(p => (
                <button key={p.id} onClick={() => addReplace(p)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border border-blue-500/10 bg-[#0a0e27] hover:border-teal-500/30 hover:bg-teal-500/5 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[10px] font-medium truncate">{p.name}</p>
                    <p className="text-blue-300/40 text-[9px]">{p.sku}</p>
                  </div>
                  <span className="text-teal-400 text-[10px] font-bold flex-shrink-0">${p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            {/* Replace cart */}
            {replaceCart.length > 0 && (
              <div className="bg-[#111638] rounded-xl border border-teal-500/20 p-2 space-y-1 flex-shrink-0 max-h-28 overflow-y-auto">
                <p className="text-blue-300/40 text-[9px] uppercase tracking-wider">Replacement Cart</p>
                {replaceCart.map(i => (
                  <div key={i.sku} className="flex items-center justify-between text-[10px]">
                    <span className="text-white">{i.qty}× {i.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-300">${i.total.toFixed(2)}</span>
                      <button onClick={() => removeReplace(i.sku)} className="text-red-400/50 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-[#111638] rounded-lg border border-teal-500/10 p-2 flex justify-between text-xs flex-shrink-0">
              <span className="text-blue-300/50">Replace Value</span>
              <span className="text-teal-300 font-bold">${replaceValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {step === "select" && (
        <div className="bg-[#111638] rounded-xl border border-teal-500/20 p-3 flex-shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diff > 0 ? "bg-green-500/20 text-green-300" : diff < 0 ? "bg-red-500/20 text-red-300" : "bg-teal-500/20 text-teal-300"}`}>
              {diff > 0 ? `CUSTOMER OWES $${diff.toFixed(2)}` : diff < 0 ? `REFUND $${Math.abs(diff).toFixed(2)}` : "EVEN EXCHANGE"}
            </span>
            <span className="text-blue-300/40 text-[10px]">{returnedItems.length} returning · {replaceCart.length} replacing</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10">Cancel</Button>
            <Button onClick={confirmExchange} disabled={returnedItems.length === 0 || replaceCart.length === 0}
              className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold disabled:opacity-40">
              Confirm Exchange
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CS Mode Panel ────────────────────────────────────────────────────────────
function CSModePanel({ operator, onAddGiftCard, toast }) {
  const [showGiftCardSeller, setShowGiftCardSeller] = useState(false);
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
          { label: "Loyalty Lookup", color: "#0369a1", action: () => toast({ title: "Loyalty Lookup", description: "Scan or enter loyalty card number" }) },
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

// ── Main Component ───────────────────────────────────────────────────────────
export default function POSRegister() {
  const [operator, setOperator] = useState(null);
  const [products, setProducts] = useState([]);
  const [functionKeys, setFunctionKeys] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amountTendered, setAmountTendered] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState("All");
  const [itemListOpen, setItemListOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [qtyDialog, setQtyDialog] = useState(false);
  const [qtyValue, setQtyValue] = useState("1");
  const [activeSection, setActiveSection] = useState("sale");
  const [registerFeatures, setRegisterFeatures] = useState({ feature_returns: false, feature_customer_service: false, feature_exchange: false });
  // Supervisor override for function keys
  const [supOverrideDialog, setSupOverrideDialog] = useState(false);
  const [supOverridePin, setSupOverridePin] = useState("");
  const [supOverrideError, setSupOverrideError] = useState("");
  const [pendingFunctionKey, setPendingFunctionKey] = useState(null);
  // Remote override
  const [remoteRequestSent, setRemoteRequestSent] = useState(null); // { requestId, action }
  const [remotePolling, setRemotePolling] = useState(false);
  const remotePollingRef = React.useRef(null);
  const [remoteResultDialog, setRemoteResultDialog] = useState(null); // { approved, action, by, note }
  // Top-level mode: "sale" | "returns" | "cs"
  const [posMode, setPosMode] = useState("sale");
  // Preview data from returns/exchange panels shown in the left panel
  const [sidePreview, setSidePreview] = useState(null);
  // Tab-switch guard
  const [switchGuard, setSwitchGuard] = useState(null); // { targetMode } when pending confirmation
  const [currentTime, setCurrentTime] = useState(new Date());
  const [discounts, setDiscounts] = useState([]);
  const [sodModal, setSODModal] = useState(false);
  const [cashMgmtDialog, setCashMgmtDialog] = useState(false);
  const [exportCashDialog, setExportCashDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [storeConfig, setStoreConfig] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [registerPaused, setRegisterPaused] = useState(false);
  const [pauseUnlockPin, setPauseUnlockPin] = useState("");
  const [pauseUnlockError, setPauseUnlockError] = useState("");
  const [remoteLogout, setRemoteLogout] = useState({ requested: false, reason: "" });
  const [remoteLogoutDialog, setRemoteLogoutDialog] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [robberyDialog, setRobberyDialog] = useState(false);
  const [calculatedRobberyAmount, setCalculatedRobberyAmount] = useState(0);
  const [robberyLoading, setRobberyLoading] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [trainingModeDialog, setTrainingModeDialog] = useState(false);
  const [trainingModePin, setTrainingModePin] = useState("");
  const [trainingModeError, setTrainingModeError] = useState("");
  const [giftCardPaymentDialog, setGiftCardPaymentDialog] = useState(false);
  const [giftCardNumber, setGiftCardNumber] = useState("");
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardError, setGiftCardError] = useState("");
  const [giftCardResult, setGiftCardResult] = useState(null); // { approved: bool, card: {...}, message: string }
  const [taxExemptDialog, setTaxExemptDialog] = useState(false);
  const [taxExemptAppliedId, setTaxExemptAppliedId] = useState("");
  const [taxExemptProfile, setTaxExemptProfile] = useState(null);
  const loadDataDebounceRef = React.useRef(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (receiptData) {
      const barcodeId = `barcode-${receiptData.transactionId}`;
      const barcodeElement = document.getElementById(barcodeId);
      if (barcodeElement) {
        try {
          JsBarcode(`#${barcodeId}`, receiptData.transactionId, {
            format: "CODE128",
            width: 2,
            height: 50,
            displayValue: true
          });
        } catch (e) {
          console.error("Barcode generation error:", e);
        }
      }
    }
  }, [receiptData]);

  // Get applicable discounts
  const getApplicableDiscounts = (productCategory) => {
    const now = new Date();
    return discounts.filter(d => {
      if (!d.active) return false;
      if (d.start_date && new Date(d.start_date) > now) return false;
      if (d.end_date && new Date(d.end_date) < now) return false;
      if (d.categories.length > 0 && !d.categories.includes(productCategory)) return false;
      return true;
    });
  };

  const writeLog = (eventType, detail, extra = {}) => {
    const op = operator || JSON.parse(sessionStorage.getItem("pos_operator") || "{}");
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    base44.entities.RegisterLog.create({
      event_type: eventType,
      operator_id: op.operator_id || "",
      operator_name: op.full_name || "",
      operator_role: op.role || "",
      register_id: registerId,
      detail,
      ...extra
    });
  };

  useEffect(() => {
    const op = sessionStorage.getItem("pos_operator");
    if (!op) { navigate("/pos/login"); return; }
    const parsed = JSON.parse(op);
    setOperator(parsed);
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    
    // Check if SOD is needed
    const checkSOD = async () => {
      const today = new Date().toISOString().split("T")[0];
      const sodRecord = await base44.entities.SODProtocol.filter({ 
        protocol_date: today, 
        register_id: registerId,
        status: "completed"
      });
      if (sodRecord.length === 0) {
        setSODModal(true);
      }
    };
    
    base44.entities.RegisterLog.create({
      event_type: "login",
      operator_id: parsed.operator_id || "",
      operator_name: parsed.full_name || "",
      operator_role: parsed.role || "",
      register_id: registerId,
      detail: `${parsed.full_name} logged into ${registerId}`
    });
    loadData();
    checkSOD();
  }, []);

  const loadData = async () => {
    if (loadDataDebounceRef.current) clearTimeout(loadDataDebounceRef.current);
    loadDataDebounceRef.current = setTimeout(async () => {
      try {
        const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
        const [prods, fkeys, regs, discs, config] = await Promise.all([
          base44.entities.Product.filter({ status: "active" }),
          base44.entities.FunctionKey.list("key_number"),
          base44.entities.Register.filter({ register_id: registerId }),
          base44.entities.DiscountType.list(),
          base44.entities.ReceiptConfig.list()
        ]);
        setProducts(prods);
        setFunctionKeys(fkeys);
        setDiscounts(discs);
        if (config.length > 0) setStoreConfig(config[0]);
        if (regs.length > 0) {
          setRegisterFeatures({ feature_returns: regs[0].feature_returns || false, feature_customer_service: regs[0].feature_customer_service || false, feature_exchange: regs[0].feature_exchange || false });
          setRegisterPaused(regs[0].paused || false);
          // Auto-detect and update IP address
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            if (ipData.ip && ipData.ip !== regs[0].ip_address) {
              await base44.entities.Register.update(regs[0].id, { ip_address: ipData.ip });
            }
          } catch (e) {
            console.error("Could not auto-detect IP:", e);
          }
        }
        const cats = ["All", ...new Set(prods.map(p => p.category).filter(Boolean))];
        setCategories(cats);
        setLoading(false);
      } catch (e) {
        console.error("Error loading data:", e);
        setLoading(false);
      }
    }, 500);
  };

  const addToCart = (product) => {
    setCart(prev => {
      const applicableDiscounts = getApplicableDiscounts(product.category);
      const bestDiscount = applicableDiscounts.length > 0 ? applicableDiscounts[0] : null;
      const discountedPrice = bestDiscount ? product.price * (1 - bestDiscount.percentage / 100) : product.price;
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * discountedPrice, discount_type: bestDiscount?.name || null, discount_percentage: bestDiscount?.percentage || 0, original_price: product.price } : i);
      return [...prev, { sku: product.sku, name: product.name, price: discountedPrice, qty: 1, total: discountedPrice, tax_rate: taxExemptAppliedId ? 0 : (product.tax_rate || 0), discount_type: bestDiscount?.name || null, discount_percentage: bestDiscount?.percentage || 0, original_price: product.price }];
    });
  };

  const removeFromCart = (sku) => setCart(prev => prev.filter(i => i.sku !== sku));

  const updateQty = (sku, delta) => {
    setCart(prev => prev.map(i => {
      if (i.sku !== sku) return i;
      const newQty = Math.max(0, i.qty + delta);
      if (newQty === 0) return null;
      return { ...i, qty: newQty, total: newQty * i.price };
    }).filter(Boolean));
  };

  const subtotal = cart.reduce((s, i) => s + i.total, 0);
  const tax = cart.reduce((s, i) => s + (i.total * (i.tax_rate / 100)), 0);
  const total = subtotal + tax;
  const receiptTaxExempt = receiptData?.taxExempt || taxExemptProfile;

  const executeFunctionKey = (fkey) => {
    switch (fkey.action) {
      case "void_transaction": setCart([]); setTaxExemptAppliedId(""); setTaxExemptProfile(null); writeLog("void", "Entire transaction voided"); break;
      case "void_item":
        if (cart.length > 0) { const voided = cart[cart.length - 1]; removeFromCart(voided.sku); writeLog("void", `Item voided: ${voided.name}`); }
        break;
      case "subtotal": break;
      case "quantity": setQtyDialog(true); break;
      case "no_sale": writeLog("no_sale", "No Sale — cash drawer opened"); break;
      case "cash_management": setCashMgmtDialog(true); break;
      case "reprint_receipt":
        if (lastReceipt) {
          setReceiptData(lastReceipt);
          writeLog("reprint_receipt", "Receipt reprinted");
        } else {
          toast({ title: "No Receipt", description: "No previous receipt to reprint", variant: "destructive" });
        }
        break;
      case "tax_exempt":
        setTaxExemptDialog(true);
        break;
      case "discount_item":
        if (cart.length > 0) {
          setCart(prev => prev.map((item, idx) => idx === prev.length - 1 ? { ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) } : item));
        }
        break;
      case "discount_total":
        setCart(prev => prev.map(item => ({ ...item, price: +(item.price * 0.9).toFixed(2), total: +(item.qty * item.price * 0.9).toFixed(2) })));
        break;
      case "price_check":
        break;
      case "request_cash_pickup":
        base44.entities.RegisterLog.create({
          event_type: "cash_request",
          operator_id: operator.operator_id,
          operator_name: operator.full_name,
          operator_role: operator.role,
          register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
          detail: `Cash pickup requested by ${operator.full_name}`
        });
        toast({ title: "Request Sent", description: "Cash pickup request logged — visible to admin", variant: "default" });
        break;
      case "request_cash_advance":
        base44.entities.RegisterLog.create({
          event_type: "cash_request",
          operator_id: operator.operator_id,
          operator_name: operator.full_name,
          operator_role: operator.role,
          register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
          detail: `Cash advance requested by ${operator.full_name}`
        });
        toast({ title: "Request Sent", description: "Cash advance request logged — visible to admin", variant: "default" });
        break;
      default: break;
      }
      };

  const handleFunctionKey = (fkey) => {
    const effectiveRole = fkey.requires_role || (fkey.requires_supervisor ? "csm" : "none");
    const needsOverride =
      (effectiveRole === "csm" && operator?.role === "cashier") ||
      (effectiveRole === "manager" && (operator?.role === "cashier" || operator?.role === "csm"));
    if (needsOverride) {
      setPendingFunctionKey(fkey);
      setSupOverridePin("");
      setSupOverrideError("");
      setSupOverrideDialog(true);
      return;
    }
    executeFunctionKey(fkey);
  };

  const handleSupOverrideSubmit = async () => {
    setSupOverrideError("");
    const ops = await base44.entities.Operator.filter({ pin: supOverridePin });
    const requiredRole = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
    const sup = ops.find(o =>
      requiredRole === "manager" ? o.role === "manager" : (o.role === "csm" || o.role === "manager")
    );
    if (!sup) {
      setSupOverrideError(requiredRole === "manager" ? "Invalid PIN — Manager required" : "Invalid PIN — CSM or Manager required");
      return;
    }
    setSupOverrideDialog(false);
    setSupOverridePin("");
    toast({ title: "Override Granted", description: `${sup.full_name} authorized the action` });
    if (pendingFunctionKey) {
      writeLog("override", `Override for "${pendingFunctionKey.label}" authorized by ${sup.full_name}`, {
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: pendingFunctionKey.label
      });
      executeFunctionKey(pendingFunctionKey);
      setPendingFunctionKey(null);
    }
  };

  const sendRemoteOverrideRequest = async () => {
    if (!pendingFunctionKey) return;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const req = await base44.entities.OverrideRequest.create({
      register_id: registerId,
      action: pendingFunctionKey.label,
      requested_by_operator_id: operator?.operator_id || "",
      requested_by_operator_name: operator?.full_name || "",
      status: "pending"
    });
    setRemoteRequestSent({ requestId: req.id, action: pendingFunctionKey.label });
    setSupOverrideDialog(false);
    setSupOverridePin("");
    // Listen for realtime approval/decline instead of polling
    setRemotePolling(true);
    const stopRemoteWatch = () => {
      if (typeof remotePollingRef.current === "function") remotePollingRef.current();
      remotePollingRef.current = null;
      setRemotePolling(false);
    };
    const checkOverride = async () => {
      invalidateEntity("OverrideRequest");
      const updated = await base44.entities.OverrideRequest.filter({ id: req.id });
      if (updated.length === 0) return;
      const r = updated[0];
      if (r.status === "approved") {
        stopRemoteWatch();
        setRemoteRequestSent(null);
        writeLog("override", `Remote override for "${r.action}" approved by ${r.approved_by_operator_name}`, {
          override_operator_id: r.approved_by_operator_id,
          override_operator_name: r.approved_by_operator_name,
          override_action: r.action
        });
        executeFunctionKey(pendingFunctionKey);
        setPendingFunctionKey(null);
        setRemoteResultDialog({ approved: true, action: r.action, by: r.approved_by_operator_name, note: r.note || "" });
      } else if (r.status === "declined" || r.status === "expired") {
        stopRemoteWatch();
        setRemoteRequestSent(null);
        setPendingFunctionKey(null);
        setRemoteResultDialog({ approved: false, action: r.action, by: r.approved_by_operator_name || null, note: r.note || "", expired: r.status === "expired" });
      }
    };
    remotePollingRef.current = base44.entities.OverrideRequest.subscribe(() => checkOverride());
    checkOverride();
    // Auto-cancel after 5 minutes
    setTimeout(() => {
      stopRemoteWatch();
      setRemoteRequestSent(null);
    }, 5 * 60 * 1000);
  };

  // Cleanup realtime watch and debounce on unmount
  useEffect(() => {
    return () => {
      if (typeof remotePollingRef.current === "function") remotePollingRef.current();
      if (loadDataDebounceRef.current) clearTimeout(loadDataDebounceRef.current);
    };
  }, []);

  // Listen for realtime register status changes (pause/unpause from admin) instead of polling
  useEffect(() => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const refreshRegister = async () => {
      try {
        invalidateEntity("Register");
        const regs = await base44.entities.Register.filter({ register_id: registerId });
        if (regs.length > 0) {
          setRegisterPaused(regs[0].paused || false);
          setRemoteLogout({ requested: regs[0].remote_logout_requested || false, reason: regs[0].remote_logout_reason || "" });
        }
      } catch (e) {
        console.error("Error checking register status:", e);
      }
    };
    refreshRegister();
    const unsub = base44.entities.Register.subscribe(() => refreshRegister());
    return () => unsub();
  }, []);

  const handlePauseUnlock = async () => {
    setPauseUnlockError("");
    const ops = await base44.entities.Operator.filter({ pin: pauseUnlockPin });
    const sup = ops.find(o => o.role === "csm" || o.role === "manager");
    if (!sup) {
      setPauseUnlockError("Invalid PIN or insufficient role (CSM/Manager required)");
      return;
    }
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    if (regs.length > 0) {
      await base44.entities.Register.update(regs[0].id, { paused: false });
      setRegisterPaused(false);
      setPauseUnlockPin("");
      toast({ title: "Register Unlocked", description: `${sup.full_name} unpaused the register` });
    }
  };

  const confirmTaxExempt = (profile) => {
    setCart(prev => prev.map(i => ({ ...i, tax_rate: 0 })));
    setTaxExemptAppliedId(profile.tax_exempt_id);
    setTaxExemptProfile(profile);
    writeLog("override", `Tax exempt applied — ${profile.name} (${profile.tax_exempt_id})`);
    toast({ title: "Tax Exempt Applied", description: `${profile.name} — tax removed from sale` });
    setTaxExemptDialog(false);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const changeDue = paymentMethod === "cash" ? Math.max(0, parseFloat(amountTendered || 0) - total) : 0;

    // Training mode: simulate the sale without recording anything — no transaction log
    // entry, no stock changes, no register log. Only show a receipt for practice.
    if (trainingMode) {
      toast({ title: "Training Sale Complete", description: `${txId} — Change: $${changeDue.toFixed(2)} (not recorded)` });
      setReceiptData({
        transactionId: txId,
        operatorName: operator.full_name,
        registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart, subtotal, tax, total,
        paymentMethod,
        amountTendered: parseFloat(amountTendered || total),
        changeDue
      });
      setLastReceipt({
         taxExempt: taxExemptProfile,
         transactionId: txId,
        operatorName: operator.full_name,
        registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart, subtotal, tax, total,
        paymentMethod,
        amountTendered: parseFloat(amountTendered || total),
        changeDue
      });
      setCart([]); setPaymentOpen(false); setAmountTendered(""); setTaxExemptAppliedId("");
      return;
    }

    try {
      await base44.entities.Transaction.create({
        transaction_id: txId, operator_id: operator.operator_id, operator_name: operator.full_name,
        register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
        items: cart.map(item => ({
          sku: item.sku, name: item.name, qty: item.qty, price: item.price, total: item.total,
          discount_type: item.discount_type || null, discount_percentage: item.discount_percentage || 0, original_price: item.original_price || item.price
        })),
        subtotal, tax, total, payment_method: paymentMethod, status: "completed",
        amount_tendered: parseFloat(amountTendered || total), change_due: changeDue,
        training_mode: trainingMode,
        tax_exempt_id: taxExemptAppliedId || null
      });
      for (const item of cart) {
        const prod = products.find(p => p.sku === item.sku);
        if (prod) await base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
      }
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Change: $${changeDue.toFixed(2)}` });
       writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { 
         transaction_id: txId, 
         transaction_total: total,
         items: cart.map(item => ({
           sku: item.sku,
           name: item.name,
           qty: item.qty,
           price: item.price,
           total: item.total,
           tax_rate: item.tax_rate,
           discount_type: item.discount_type || null,
           discount_percentage: item.discount_percentage || 0,
           original_price: item.original_price || item.price
         }))
       });
       // Show receipt dialog
       setReceiptData({
         transactionId: txId,
         operatorName: operator.full_name,
         registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
         items: cart,
         subtotal,
         tax,
         total,
         paymentMethod,
         amountTendered: parseFloat(amountTendered || total),
         changeDue
       });
       setCart([]); setPaymentOpen(false); setAmountTendered(""); setTaxExemptAppliedId("");
       setLastReceipt({
          transactionId: txId,
          operatorName: operator.full_name,
          registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
          items: cart,
          subtotal,
          tax,
          total,
          paymentMethod,
          amountTendered: parseFloat(amountTendered || total),
          changeDue
        });
        loadData();
       } catch (e) {
       toast({ title: "Error", description: "Failed to process sale", variant: "destructive" });
       }
       };

  // Remote logout (from admin Remote Workstation) — only prompt when the cart is clear
  useEffect(() => {
    if (remoteLogout.requested && cart.length === 0) setRemoteLogoutDialog(true);
  }, [remoteLogout.requested, cart.length]);

  const handleRemoteLogoutAck = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) {
        await base44.entities.Register.update(regs[0].id, { remote_logout_requested: false, remote_logout_reason: "" });
      }
    } catch (e) {
      console.error("Error clearing remote logout flag:", e);
    }
    setRemoteLogoutDialog(false);
    logout();
  };

  const logout = () => {
    writeLog("logout", `${operator?.full_name} logged out of ${sessionStorage.getItem("pos_register_num") || "REG-001"}`);
    sessionStorage.removeItem("pos_operator");
    navigate("/pos");
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = !itemSearch || p.name.toLowerCase().includes(itemSearch.toLowerCase()) || p.sku.includes(itemSearch);
    const matchCat = selectedCat === "All" || p.category === selectedCat;
    return matchSearch && matchCat;
  });

  const handleSectionClick = (sectionId) => {
    if (sectionId === "item_list") setItemListOpen(true);
    else setActiveSection(sectionId);
  };

  const requestCSM = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await base44.entities.OverrideRequest.create({
        register_id: registerId,
        action: "Help Needed",
        requested_by_operator_id: operator?.operator_id || "",
        requested_by_operator_name: operator?.full_name || "",
        status: "pending"
      });
      writeLog("override", `CSM Help Requested — ${operator?.full_name || "Unknown operator"}`);
      toast({ title: "Help Request Sent", description: "CSM has been notified", variant: "default" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to send help request", variant: "destructive" });
    }
    setHelpMenuOpen(false);
  };

  const calculateStolenAmount = async () => {
    setRobberyLoading(true);
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const registerName = sessionStorage.getItem("pos_register_name") || "REG-001";
    const today = new Date().toISOString().split("T")[0];
    try {
      // Log emergency alert immediately when button is pressed
      await base44.entities.EmergencyAlert.create({
        alert_type: "robbery",
        register_id: registerId,
        register_name: registerName,
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        operator_role: operator?.role || "",
        timestamp: new Date().toISOString(),
        status: "active"
      });

      // Get SOD for today
      const sodRecords = await base44.entities.SODProtocol.filter({
        protocol_date: today,
        register_id: registerId,
        status: "completed"
      });
      const sodStartingBalance = sodRecords.length > 0 ? sodRecords[0].till_starting_balance || 0 : 0;

      // Get all cash transactions for today
      const txs = await base44.entities.Transaction.filter({ register_id: registerId });
      const todayTxs = txs.filter(t => t.created_date.split("T")[0] === today && t.status === "completed");
      const totalSales = todayTxs.reduce((sum, t) => sum + (t.payment_method === "cash" ? t.total : 0), 0);

      // Get cash advances (money given to register)
      const advances = await base44.entities.CashAdvance.filter({ register_id: registerId, status: "approved" });
      const todayAdvances = advances.filter(a => a.created_date.split("T")[0] === today).reduce((sum, a) => sum + (a.amount || 0), 0);

      // Get cash pickups (money taken from register)
      const pickups = await base44.entities.CashPickup.filter({ register_id: registerId, status: "approved" });
      const todayPickups = pickups.filter(p => p.created_date.split("T")[0] === today).reduce((sum, p) => sum + (p.amount || 0), 0);

      // Calculate expected cash: SOD + Sales + Advances - Pickups
      const expectedCash = sodStartingBalance + totalSales + todayAdvances - todayPickups;
      setCalculatedRobberyAmount(Math.max(0, expectedCash));
      setRobberyDialog(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to calculate amount", variant: "destructive" });
    }
    setRobberyLoading(false);
  };

  const confirmRobbery = async () => {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    try {
      await base44.entities.Robbery.create({
        register_id: registerId,
        register_name: sessionStorage.getItem("pos_register_name") || "REG-001",
        operator_id: operator?.operator_id || "",
        operator_name: operator?.full_name || "",
        amount_stolen: calculatedRobberyAmount,
        report_date: new Date().toISOString().split("T")[0]
      });
      
      // Pause the register
      const regs = await base44.entities.Register.filter({ register_id: registerId });
      if (regs.length > 0) {
        await base44.entities.Register.update(regs[0].id, { paused: true });
        setRegisterPaused(true);
      }
      
      writeLog("robbery", `Robbery reported — $${calculatedRobberyAmount.toFixed(2)} stolen (calculated) — Register paused`);
      toast({ title: "Robbery Reported", description: "Register paused for security", variant: "default" });
      setCalculatedRobberyAmount(0);
      setRobberyDialog(false);
      setHelpMenuOpen(false);
    } catch (e) {
      toast({ title: "Error", description: "Failed to report robbery", variant: "destructive" });
    }
  };

  const visibleKeys = getKeysForSection(activeSection, functionKeys);
  const gridSlots = [...visibleKeys.slice(0, 9)];
  while (gridSlots.length < 9) gridSlots.push(null);

  // Build mode buttons dynamically based on enabled features
  const modeTabs = [
    { id: "sale", label: "Sale", icon: ShoppingCart, activeColor: "bg-blue-600 text-white", inactiveColor: "bg-[#0a0e27] text-blue-300/50 border border-blue-500/10 hover:border-blue-500/30" },
    ...(registerFeatures.feature_returns ? [{ id: "returns", label: "Returns", icon: RotateCcw, activeColor: "bg-purple-600 text-white", inactiveColor: "bg-[#0a0e27] text-purple-300/50 border border-purple-500/10 hover:border-purple-500/30" }] : []),
    ...(registerFeatures.feature_exchange ? [{ id: "exchange", label: "Exchange", icon: ArrowLeftRight, activeColor: "bg-teal-600 text-white", inactiveColor: "bg-[#0a0e27] text-teal-300/50 border border-teal-500/10 hover:border-teal-500/30" }] : []),
    ...(registerFeatures.feature_customer_service ? [{ id: "cs", label: "CS Mode", icon: Headphones, activeColor: "bg-amber-600 text-white", inactiveColor: "bg-[#0a0e27] text-amber-300/50 border border-amber-500/10 hover:border-amber-500/30" }] : []),
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (registerPaused) return (
    <div className="h-screen bg-[#0a0e27] flex items-center justify-center max-w-[1024px] max-h-[768px] mx-auto">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Register Paused</h1>
          <p className="text-blue-300/60 text-sm">This register has been locked by an administrator</p>
        </div>
        
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-red-400 text-sm">Unlock Register</DialogTitle>
            </DialogHeader>
            <p className="text-blue-300/60 text-xs">A CSM or Manager PIN is required to unlock this register.</p>
            <Input
              type="password"
              placeholder="CSM / Manager PIN"
              value={pauseUnlockPin}
              onChange={e => setPauseUnlockPin(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePauseUnlock()}
              className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
              autoFocus
            />
            {pauseUnlockError && <p className="text-red-400 text-xs text-center">{pauseUnlockError}</p>}
            <Button onClick={handlePauseUnlock} className="w-full bg-red-600 hover:bg-red-500 text-white">Unlock Register</Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#0a0e27] flex flex-col overflow-hidden max-w-[1024px] max-h-[768px] mx-auto">

      {/* Top bar */}
      <div className="bg-[#111638] border-b border-blue-500/10 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold text-sm">SurePOS</span>
            <div className="text-right leading-tight">
              <span className="text-blue-300/40 text-[10px] block">{sessionStorage.getItem("pos_register_num") || "REG-001"}</span>
              <span className="text-blue-300/25 text-[9px] block">OP: {operator?.operator_id || "—"}</span>
            </div>
          </div>

          {/* Mode Buttons */}
          <div className="flex items-center gap-1">
            {modeTabs.map(({ id, label, icon: Icon, activeColor, inactiveColor }) => (
              <button
                key={id}
                onClick={() => {
                  if (id === posMode) return;
                  // Check if current mode has an active transaction
                  const hasActive =
                    (posMode === "sale" && cart.length > 0) ||
                    (posMode === "returns" && sidePreview && sidePreview.items && sidePreview.items.length > 0) ||
                    (posMode === "exchange" && sidePreview && (sidePreview.returnedItems?.length > 0 || sidePreview.replaceCart?.length > 0)) ||
                    (posMode === "cs" && cart.length > 0);
                  if (hasActive) { setSwitchGuard({ targetMode: id }); }
                  else { setPosMode(id); setSidePreview(null); }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${posMode === id ? activeColor : inactiveColor}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Clock */}
          <div className="text-center leading-tight pointer-events-none">
            <p className="text-white text-sm font-bold tabular-nums">{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
            <p className="text-blue-300/40 text-[10px]">{currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
          </div>
        </div>



        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-200/60 text-xs">{operator?.full_name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              operator?.role === "manager" ? "bg-red-500/20 text-red-300" :
              operator?.role === "csm" ? "bg-amber-500/20 text-amber-300" :
              "bg-blue-500/20 text-blue-300"
            }`}>{operator?.role === "manager" ? "Manager" : operator?.role === "csm" ? "CSM" : "Cashier"}</span>
          </div>
          <div className="relative">
            <button onClick={() => setHelpMenuOpen(!helpMenuOpen)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors">
              HELP
            </button>
            {helpMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#111638] border border-red-500/30 rounded-lg shadow-lg z-50 min-w-[180px]">
                <button onClick={() => {
                  if (trainingMode) {
                    setTrainingMode(false);
                    setHelpMenuOpen(false);
                    toast({ title: "Training Mode Disabled", description: "Normal operations resumed" });
                  } else {
                    setTrainingModeDialog(true);
                    setHelpMenuOpen(false);
                  }
                }} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-orange-600 transition-colors border-b border-red-500/10">
                  {trainingMode ? "Exit Training Mode" : "Enter Training Mode"}
                </button>
                <button onClick={requestCSM} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-blue-600 transition-colors border-b border-red-500/10">
                  Request CSM
                </button>
                <button onClick={calculateStolenAmount} disabled={robberyLoading} className="w-full text-left px-4 py-2 text-white text-sm hover:bg-red-600 rounded-b-lg transition-colors disabled:opacity-50">
                  {robberyLoading ? "Calculating..." : "Report Robbery"}
                </button>
              </div>
            )}
          </div>
          <button onClick={logout} className="text-red-400/60 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Training Mode Banner */}
      {trainingMode && (
        <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/15 to-orange-500/10 border-b-2 border-orange-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-xs uppercase tracking-widest">⚠ TRAINING MODE — TRANSACTIONS NOT RECORDED</span>
        </div>
      )}

      {/* Tax Exempt Banner */}
      {taxExemptAppliedId && (
        <div className="bg-emerald-500/10 border-b-2 border-emerald-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">✓ TAX EXEMPT — {taxExemptAppliedId}</span>
        </div>
      )}

      {/* Remote Logout Pending Banner */}
      {remoteLogout.requested && cart.length > 0 && (
        <div className="bg-blue-600/10 border-b-2 border-blue-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-300 font-bold text-xs uppercase tracking-widest">⏱ REMOTE LOGOUT PENDING — {remoteLogout.reason || "Admin requested logout"}. Complete your transaction to log out.</span>
        </div>
      )}

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Current Transaction (always visible) */}
        <div className="w-[340px] bg-[#111638] border-r border-blue-500/10 flex flex-col flex-shrink-0">
          <div className="px-3 py-2 border-b border-blue-500/10">
            <p className="text-blue-300/40 text-[10px] uppercase tracking-widest">
              {posMode === "returns" ? "Return Summary" : posMode === "exchange" ? "Exchange Summary" : "Current Transaction"}
            </p>
          </div>

          {/* SALE mode — normal cart */}
          {(posMode === "sale" || posMode === "cs") && (
            <>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-blue-300/20 gap-2">
                    <ShoppingCart className="w-8 h-8" />
                    <p className="text-xs">No items scanned</p>
                  </div>
                ) : cart.map((item) => (
                  <POSCartItem key={item.sku} item={item} onUpdateQty={updateQty} onRemove={removeFromCart} />
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
                  onClick={() => cart.length > 0 && setPaymentOpen(true)}
                  disabled={cart.length === 0}
                  className="w-full h-11 bg-green-600 hover:bg-green-500 text-white font-bold text-lg mt-1.5 rounded-xl disabled:opacity-30"
                >
                  <DollarSign className="w-5 h-5 mr-1" /> PAY
                </Button>
              </div>
            </>
          )}

          {/* RETURNS mode — show selected return items */}
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

          {/* EXCHANGE mode — show returning + replacement items */}
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
                <div className={`flex justify-between text-xl font-bold pt-1.5 border-t border-teal-500/10 ${(sidePreview?.diff || 0) > 0 ? "text-green-400" : (sidePreview?.diff || 0) < 0 ? "text-red-400" : "text-teal-300"}`}>
                  <span>{(sidePreview?.diff || 0) > 0 ? "OWES" : (sidePreview?.diff || 0) < 0 ? "REFUND" : "EVEN"}</span>
                  <span>${Math.abs(sidePreview?.diff || 0).toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — switches based on posMode */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {posMode === "sale" && (
            <>
              {/* 3x3 Function Key Grid */}
              <div className="flex-1 p-3 flex flex-col">
                <p className="text-blue-300/30 text-[10px] uppercase tracking-widest mb-2">
                  {SECTION_TABS.find(t => t.id === activeSection)?.label} Functions
                </p>
                <div className="grid grid-cols-3 grid-rows-3 gap-2 flex-1">
                  {gridSlots.map((fk, idx) => (
                    fk ? (
                      <button
                        key={fk.id}
                        onClick={() => handleFunctionKey(fk)}
                        className="rounded-xl text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 active:scale-95 hover:brightness-110 border border-white/10 flex flex-col items-center justify-center gap-1 p-2 shadow-lg"
                        style={{ backgroundColor: fk.color }}
                      >
                        <span className="text-center leading-tight">{fk.label}</span>
                        {(fk.requires_role === "manager" || (fk.requires_supervisor && !fk.requires_role)) && (
                          <span className="text-[8px] font-normal opacity-70 bg-black/20 px-1.5 py-0.5 rounded-full">MGR</span>
                        )}
                        {fk.requires_role === "csm" && (
                          <span className="text-[8px] font-normal opacity-70 bg-black/20 px-1.5 py-0.5 rounded-full">CSM</span>
                        )}
                      </button>
                    ) : (
                      <div key={`empty-${idx}`} className="rounded-xl border border-blue-500/5 bg-[#111638]/50" />
                    )
                  ))}
                </div>
              </div>

              {/* Section Menu */}
              <div className="flex-shrink-0 border-t border-blue-500/10 bg-[#111638]">
                <div className="grid grid-cols-5">
                  {SECTION_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleSectionClick(tab.id)}
                      className={`py-3 text-xs font-bold uppercase tracking-wider transition-colors border-t-2 ${
                        activeSection === tab.id && tab.id !== "item_list"
                          ? "border-blue-500 text-blue-400 bg-blue-500/10"
                          : "border-transparent text-blue-300/40 hover:text-blue-200 hover:bg-white/5"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {posMode === "returns" && (
            <ReturnsPanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} />
          )}

          {posMode === "exchange" && (
            <ExchangePanel operator={operator} products={products} loadData={loadData} toast={toast} onPreviewChange={setSidePreview} />
          )}

          {posMode === "cs" && (
           <CSModePanel operator={operator} onAddGiftCard={(giftCard) => { setCart(prev => [...prev, giftCard]); }} toast={toast} />
          )}
        </div>
      </div>

      {/* Item List Dialog */}
      <Dialog open={itemListOpen} onOpenChange={v => { setItemListOpen(v); if (!v) { setItemSearch(""); setSelectedCat("All"); } }}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2 text-sm">
              <List className="w-4 h-4" /> Item List
            </DialogTitle>
          </DialogHeader>
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300/40" />
            <Input
              placeholder="Search items..."
              value={itemSearch}
              onChange={e => setItemSearch(e.target.value)}
              className="pl-8 bg-[#0a0e27] border-blue-500/10 text-white placeholder:text-blue-300/30 text-sm h-8"
              autoFocus
            />
          </div>
          <div className="flex gap-1 flex-shrink-0 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCat(cat)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${selectedCat === cat ? "bg-blue-600 text-white" : "bg-[#0a0e27] text-blue-300/50 hover:text-blue-200 border border-blue-500/10"}`}
              >{cat}</button>
            ))}
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-1.5">
              {filteredProducts.map(p => (
                <button key={p.id}
                  onClick={() => { addToCart(p); setItemListOpen(false); setItemSearch(""); setSelectedCat("All"); }}
                  className="bg-[#0a0e27] border border-blue-500/10 rounded-lg p-2 text-left hover:border-blue-500/40 hover:bg-[#161d50] transition-all active:scale-95"
                >
                  <p className="text-white text-xs font-medium leading-tight truncate">{p.name}</p>
                  <p className="text-blue-300/40 text-[10px]">{p.sku}</p>
                  <p className="text-blue-400 font-bold text-sm mt-1">${p.price.toFixed(2)}</p>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-3 text-center py-8 text-blue-300/20 text-xs">No items found</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-sm">Payment — ${total.toFixed(2)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[{ m: "cash", icon: Banknote, label: "Cash" }, { m: "credit", icon: CreditCard, label: "Credit" }, { m: "debit", icon: CreditCard, label: "Debit" }, { m: "check", icon: CreditCard, label: "Check" }, { m: "store_credit", icon: CreditCard, label: "Store Credit" }, { m: "giftcard", icon: CreditCard, label: "Gift Card" }].map(({ m, icon: Icon, label }) => (
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
                   <button onClick={() => setAmountTendered(total.toFixed(2))}
                     className="py-1.5 rounded-md bg-blue-600/20 border border-blue-500/20 text-blue-300 text-xs col-span-2 hover:bg-blue-600/30 transition-colors">Exact</button>
                 </div>
                 {parseFloat(amountTendered) >= total && (
                   <p className="text-green-400 text-center mt-2 text-base font-bold">
                     Change: ${(parseFloat(amountTendered) - total).toFixed(2)}
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
            <Button onClick={() => {
              if (paymentMethod === "giftcard") {
                if (!giftCardNumber.trim() || !giftCardAmount.trim()) {
                  setGiftCardError("Please enter gift card number and amount");
                  return;
                }
                setGiftCardValidating(true);
                setGiftCardError("");
                base44.entities.GiftCard.filter({ card_number: giftCardNumber.trim() }).then(cards => {
                  if (cards.length === 0) {
                    setGiftCardError("Gift card not found");
                    setGiftCardValidating(false);
                    return;
                  }
                  const card = cards[0];
                  if (card.status !== "active") {
                    setGiftCardError("Gift card is not active");
                    setGiftCardValidating(false);
                    return;
                  }
                  const chargeAmount = parseFloat(giftCardAmount);
                  if (chargeAmount <= 0) {
                    setGiftCardError("Amount must be greater than zero");
                    setGiftCardValidating(false);
                    return;
                  }
                  if (chargeAmount > card.balance) {
                    setGiftCardResult({ approved: false, card, message: `Insufficient balance. Card has $${card.balance.toFixed(2)}, but $${chargeAmount.toFixed(2)} was requested.` });
                  } else {
                    setGiftCardResult({ approved: true, card, chargeAmount, message: `Payment approved. New balance: $${(card.balance - chargeAmount).toFixed(2)}` });
                  }
                  setGiftCardValidating(false);
                }).catch(e => {
                  setGiftCardError("Error validating gift card");
                  setGiftCardValidating(false);
                });
              } else {
                completeSale();
              }
            }} disabled={paymentMethod === "cash" && parseFloat(amountTendered || 0) < total || paymentMethod === "giftcard" && giftCardValidating}
              className="w-full h-10 bg-green-600 hover:bg-green-500 text-white font-bold text-base rounded-xl disabled:opacity-50">
              {giftCardValidating ? "Validating..." : "Complete Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Override Authorization Dialog */}
      <Dialog open={supOverrideDialog} onOpenChange={v => { setSupOverrideDialog(v); if (!v) { setSupOverridePin(""); setSupOverrideError(""); setPendingFunctionKey(null); } }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-red-400 text-sm">
              {(() => {
                const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
                return role === "manager" ? "Manager Authorization Required" : "CSM / Manager Authorization Required";
              })()}
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">
            <span className="text-white font-bold">"{pendingFunctionKey?.label}"</span>{" "}
            {(() => {
              const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
              return role === "manager" ? "requires Manager authorization." : "requires CSM or Manager authorization.";
            })()} Enter their PIN or send a remote override request.
          </p>
          <Input
            type="password"
            placeholder={(() => {
              const role = pendingFunctionKey?.requires_role || (pendingFunctionKey?.requires_supervisor ? "csm" : "csm");
              return role === "manager" ? "Manager PIN" : "CSM / Manager PIN";
            })()}
            value={supOverridePin}
            onChange={e => setSupOverridePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSupOverrideSubmit()}
            className="bg-[#0a0e27] border-red-500/20 text-white text-center text-lg tracking-widest"
            autoFocus
          />
          {supOverrideError && <p className="text-red-400 text-xs text-center">{supOverrideError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => setSupOverrideDialog(false)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Cancel</Button>
            <Button onClick={handleSupOverrideSubmit} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">Authorize</Button>
          </div>
          <div className="border-t border-blue-500/10 pt-3">
            <p className="text-blue-300/40 text-[10px] text-center mb-2">No one present to authorize?</p>
            <Button onClick={sendRemoteOverrideRequest} variant="outline" className="w-full border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs">
              📡 Send Remote Override Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Override Result Dialog */}
      <Dialog open={!!remoteResultDialog} onOpenChange={v => { if (!v) setRemoteResultDialog(null); }}>
        <DialogContent className={`bg-[#111638] text-white max-w-xs ${remoteResultDialog?.approved ? "border-green-500/30" : "border-red-500/30"}`}>
          <DialogHeader>
            <DialogTitle className={`text-sm flex items-center gap-2 ${remoteResultDialog?.approved ? "text-green-400" : "text-red-400"}`}>
              {remoteResultDialog?.approved ? "✓ Remote Override Approved" : remoteResultDialog?.expired ? "⏱ Override Request Expired" : "✕ Remote Override Declined"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className={`rounded-lg border p-3 space-y-1.5 ${remoteResultDialog?.approved ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
              <div className="flex justify-between text-xs">
                <span className="text-blue-300/50">Action</span>
                <span className="text-white font-bold">"{remoteResultDialog?.action}"</span>
              </div>
              {remoteResultDialog?.by && (
                <div className="flex justify-between text-xs">
                  <span className="text-blue-300/50">{remoteResultDialog?.approved ? "Approved by" : "Declined by"}</span>
                  <span className="text-white font-medium">{remoteResultDialog?.by}</span>
                </div>
              )}
              {remoteResultDialog?.note && (
                <div className="pt-1.5 border-t border-white/10">
                  <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-1">Note</p>
                  <p className="text-white/80 text-xs">{remoteResultDialog?.note}</p>
                </div>
              )}
            </div>
            <Button onClick={() => setRemoteResultDialog(null)} className={`w-full text-white font-bold text-xs ${remoteResultDialog?.approved ? "bg-green-600 hover:bg-green-500" : "bg-red-600 hover:bg-red-500"}`}>
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Override Pending Banner */}
      {remoteRequestSent && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-violet-700 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 border border-violet-400/30">
          <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          <div>
            <p className="text-xs font-bold">Remote Override Pending</p>
            <p className="text-[10px] text-violet-200">Waiting for admin approval of "{remoteRequestSent.action}"…</p>
          </div>
          <button onClick={() => { if (typeof remotePollingRef.current === "function") remotePollingRef.current(); setRemotePolling(false); setRemoteRequestSent(null); setPendingFunctionKey(null); }}
            className="ml-2 text-violet-300 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Tab Switch Guard Dialog */}
      <Dialog open={!!switchGuard} onOpenChange={v => { if (!v) setSwitchGuard(null); }}>
        <DialogContent className="bg-[#111638] border-amber-500/30 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-amber-400 text-sm flex items-center gap-2">
              ⚠ Active Transaction
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/70 text-xs leading-relaxed">
            You have an active transaction in the{" "}
            <span className="text-white font-bold capitalize">{posMode}</span> tab.
            Switching tabs will not automatically cancel it, but you may lose unsaved progress.
          </p>
          <p className="text-blue-300/50 text-xs">Complete or cancel the current transaction before switching, or continue anyway.</p>
          <div className="flex gap-2 mt-1">
            <Button onClick={() => setSwitchGuard(null)} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              Stay Here
            </Button>
            <Button
              onClick={() => { setPosMode(switchGuard.targetMode); setSidePreview(null); setSwitchGuard(null); }}
              className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs"
            >
              Switch Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOD Protocol Modal */}
      {operator && (
        <SODProtocolModal 
          isOpen={sodModal} 
          registerId={sessionStorage.getItem("pos_register_num") || "REG-001"}
          registerName={operator?.register_name || "REG-001"}
          operatorId={operator?.operator_id || ""}
          operatorName={operator?.full_name || ""}
          onComplete={() => setSODModal(false)}
        />
      )}

      {/* Cash Management Dialog */}
      <POSCashManagement operator={operator} isOpen={cashMgmtDialog} onClose={() => setCashMgmtDialog(false)} />

      {/* Export Cash History Dialog */}
      <ExportCashHistory isOpen={exportCashDialog} onClose={() => setExportCashDialog(false)} />

      {/* Receipt Dialog */}
      {receiptData && (
        <Dialog open={!!receiptData} onOpenChange={(open) => { if (!open) { setReceiptData(null); setTaxExemptProfile(null); } }}>
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
                  {receiptData.items.map((item) => (
                    <div key={item.sku} className="flex justify-between">
                      <span>{item.qty}x {item.name}</span>
                      <span>${item.total.toFixed(2)}</span>
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
                {receiptTaxExempt && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-2 text-left space-y-0.5">
                    <p className="text-emerald-400 font-bold text-[9px] uppercase tracking-wider">Tax Exempt — {receiptTaxExempt.name}</p>
                    <p className="text-emerald-400/70 text-[9px]">{receiptTaxExempt.tax_exempt_id} · {receiptTaxExempt.exemption_type}{receiptTaxExempt.tax_id_number ? ` · Tax ID ${receiptTaxExempt.tax_id_number}` : ""}</p>
                    <p className="text-emerald-400/60 text-[9px]">{[receiptTaxExempt.address_street, receiptTaxExempt.address_city, receiptTaxExempt.address_state, receiptTaxExempt.address_zip].filter(Boolean).join(", ")}</p>
                  </div>
                )}
                  <p className="text-center text-[10px] text-blue-300/60">Thank You!</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReceiptData(null)} className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
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
                  changeDue={receiptData.changeDue} taxExempt={receiptTaxExempt}
                  storeConfig={storeConfig}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Quantity Dialog */}
      <Dialog open={qtyDialog} onOpenChange={setQtyDialog}>
        <DialogContent className="bg-[#111638] border-blue-500/10 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-white text-sm">Set Quantity</DialogTitle></DialogHeader>
          <Input value={qtyValue} onChange={e => setQtyValue(e.target.value)} type="number"
            className="bg-[#0a0e27] border-blue-500/10 text-white text-xl h-12 text-center" />
          <Button onClick={() => {
            const q = parseInt(qtyValue);
            if (q > 0 && cart.length > 0) {
              const last = cart[cart.length - 1];
              setCart(prev => prev.map(i => i.sku === last.sku ? { ...i, qty: q, total: q * i.price } : i));
            }
            setQtyDialog(false); setQtyValue("1");
          }} className="bg-blue-600 hover:bg-blue-500 text-white">Apply</Button>
        </DialogContent>
      </Dialog>

      {/* Training Mode Authorization Dialog */}
      <Dialog open={trainingModeDialog} onOpenChange={v => { setTrainingModeDialog(v); if (!v) { setTrainingModePin(""); setTrainingModeError(""); } }}>
        <DialogContent className="bg-[#111638] border-orange-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-orange-400 text-sm">Enable Training Mode</DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">Training mode disables all financial logging. A CSM or Manager PIN is required to enable.</p>
          <Input
            type="password"
            placeholder="CSM / Manager PIN"
            value={trainingModePin}
            onChange={e => setTrainingModePin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (async () => {
              setTrainingModeError("");
              const ops = await base44.entities.Operator.filter({ pin: trainingModePin });
              const sup = ops.find(o => o.role === "csm" || o.role === "manager");
              if (!sup) {
                setTrainingModeError("Invalid PIN or insufficient role (CSM/Manager required)");
                return;
              }
              setTrainingMode(true);
              setTrainingModeDialog(false);
              setTrainingModePin("");
              toast({ title: "Training Mode Enabled", description: "Transactions will not be recorded" });
            })()}
            className="bg-[#0a0e27] border-orange-500/20 text-white text-center text-lg tracking-widest"
            autoFocus
          />
          {trainingModeError && <p className="text-red-400 text-xs text-center">{trainingModeError}</p>}
          <Button 
            onClick={async () => {
              setTrainingModeError("");
              const ops = await base44.entities.Operator.filter({ pin: trainingModePin });
              const sup = ops.find(o => o.role === "csm" || o.role === "manager");
              if (!sup) {
                setTrainingModeError("Invalid PIN or insufficient role (CSM/Manager required)");
                return;
              }
              setTrainingMode(true);
              setTrainingModeDialog(false);
              setTrainingModePin("");
              toast({ title: "Training Mode Enabled", description: "Transactions will not be recorded" });
            }}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white"
          >
            Enable Training Mode
          </Button>
        </DialogContent>
      </Dialog>

      {/* Remote Logout Dialog */}
      <Dialog open={remoteLogoutDialog} onOpenChange={v => { if (!v) setRemoteLogoutDialog(false); }}>
        <DialogContent className="bg-[#111638] border-blue-500/20 text-white max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-blue-400 text-sm flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Remote Logout Requested
            </DialogTitle>
          </DialogHeader>
          <p className="text-blue-300/60 text-xs">An administrator has requested that you log out of this register.</p>
          {remoteLogout.reason && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
              <p className="text-blue-300/50 text-[10px] uppercase tracking-wider mb-0.5">Reason</p>
              <p className="text-white text-sm">{remoteLogout.reason}</p>
            </div>
          )}
          <Button onClick={handleRemoteLogoutAck} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
            Acknowledge & Log Out
          </Button>
        </DialogContent>
      </Dialog>

      {/* Robbery Report Dialog */}
      <Dialog open={robberyDialog} onOpenChange={v => { setRobberyDialog(v); if (!v) setCalculatedRobberyAmount(0); }}>
        <DialogContent className="bg-[#111638] border-red-500/20 text-white max-w-xs">
          <DialogHeader><DialogTitle className="text-red-400 text-sm">Confirm Robbery Report</DialogTitle></DialogHeader>
          <p className="text-blue-300/60 text-xs">Calculated amount stolen based on SOD, transactions, and cash movements:</p>
          <div className="bg-[#0a0e27] border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-400 text-sm font-bold">Amount Stolen</p>
            <p className="text-white text-3xl font-bold mt-2">${calculatedRobberyAmount.toFixed(2)}</p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => { setRobberyDialog(false); setCalculatedRobberyAmount(0); }} variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              Cancel
            </Button>
            <Button onClick={confirmRobbery} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs">
              Confirm & Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gift Card Payment Result Dialog */}
      <Dialog open={!!giftCardResult} onOpenChange={v => { if (!v) { setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setGiftCardError(""); } }}>
        <DialogContent className={`bg-[#111638] text-white max-w-xs ${giftCardResult?.approved ? "border-green-500/20" : "border-red-500/20"}`}>
          <DialogHeader>
            <DialogTitle className={giftCardResult?.approved ? "text-green-400" : "text-red-400"}>
              {giftCardResult?.approved ? "✓ Payment Approved" : "✕ Payment Declined"}
            </DialogTitle>
          </DialogHeader>
          <div className={`rounded-lg border p-3 space-y-2 ${giftCardResult?.approved ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"}`}>
            <p className="text-white text-sm">{giftCardResult?.message}</p>
            {giftCardResult?.approved && (
              <div className="space-y-1 text-xs pt-2 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-blue-300/50">Card</span>
                  <span className="text-white font-mono">{giftCardResult.card.card_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300/50">Charge Amount</span>
                  <span className="text-white">${giftCardResult.chargeAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-300/50">Old Balance</span>
                  <span className="text-white">${giftCardResult.card.balance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-green-400">
                  <span>New Balance</span>
                  <span>${(giftCardResult.card.balance - giftCardResult.chargeAmount).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setGiftCardError(""); if (giftCardResult?.approved) { setPaymentOpen(false); } }} 
              variant="outline" className="flex-1 border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">
              {giftCardResult?.approved ? "Close" : "Back"}
            </Button>
            {giftCardResult?.approved && (
              <Button onClick={() => {
                // Process the sale with gift card payment
                const txId = "TX-" + Date.now().toString(36).toUpperCase();
                const chargeAmount = giftCardResult.chargeAmount;

                // Training mode: do not deduct the gift card balance, record a transaction,
                // or change stock — just show a receipt for practice.
                if (trainingMode) {
                  toast({ title: "Training Sale Complete", description: `${txId} — Paid with gift card (not recorded)` });
                  setReceiptData({
                    transactionId: txId,
                    operatorName: operator.full_name,
                    registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
                    items: cart, subtotal, tax, total,
                    paymentMethod: "giftcard",
                    amountTendered: chargeAmount,
                    changeDue: 0
                  });
                  setLastReceipt({
                    transactionId: txId,
                    operatorName: operator.full_name,
                    registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
                    items: cart, subtotal, tax, total,
                    paymentMethod: "giftcard",
                    amountTendered: chargeAmount,
                    changeDue: 0
                  });
                  setCart([]); setPaymentOpen(false); setTaxExemptAppliedId("");
                  setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setAmountTendered("");
                  return;
                }

                const newBalance = giftCardResult.card.balance - chargeAmount;

                base44.entities.GiftCard.update(giftCardResult.card.id, { balance: newBalance }).then(() => {
                  base44.entities.Transaction.create({
                    transaction_id: txId,
                    operator_id: operator.operator_id,
                    operator_name: operator.full_name,
                    register_id: sessionStorage.getItem("pos_register_num") || "REG-001",
                    items: cart,
                    subtotal, tax, total,
                    payment_method: "giftcard",
                    giftcard_number: giftCardResult.card.card_number,
                    status: "completed",
                    amount_tendered: chargeAmount,
                    change_due: 0,
                    training_mode: trainingMode,
                    tax_exempt_id: taxExemptAppliedId || null
                  }).then(() => {
                    for (const item of cart) {
                      const prod = products.find(p => p.sku === item.sku);
                      if (prod) base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
                    }
                    toast({ title: "Sale Complete", description: `Transaction ${txId} — Paid with gift card` });
                    writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { transaction_id: txId, transaction_total: total, items: cart });
                    setReceiptData({
                      transactionId: txId,
                      operatorName: operator.full_name,
                      registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
                      items: cart,
                      subtotal, tax, total,
                      paymentMethod: "giftcard",
                      amountTendered: chargeAmount,
                      changeDue: 0
                    });
                    setCart([]);
                    setPaymentOpen(false);
                    setTaxExemptAppliedId("");
                    setGiftCardResult(null);
                    setGiftCardNumber("");
                    setGiftCardAmount("");
                    setAmountTendered("");
                    setLastReceipt({ taxExempt: taxExemptProfile, transactionId: txId, operatorName: operator.full_name, registerName: sessionStorage.getItem("pos_register_num") || "REG-001", items: cart, subtotal, tax, total, paymentMethod: "giftcard", amountTendered: chargeAmount, changeDue: 0 });
                    loadData();
                  });
                });
              }} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold text-xs">
                Complete Payment
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <POSTaxExemptDialog open={taxExemptDialog} onClose={() => setTaxExemptDialog(false)} onConfirm={confirmTaxExempt} initialId={taxExemptAppliedId} />
      </div>
      );
      }