import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { ArrowLeftRight, Search, X, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import POSSerialVerifyDialog from "@/components/pos/POSSerialVerifyDialog";
import POSSerialDialog from "@/components/pos/POSSerialDialog";
import { markSerialReturned, recordSerializedSales, itemHasSerials, verifySerialInStock } from "@/lib/serialUtils";

export default function ExchangePanel({ operator, products, loadData, toast, onPreviewChange }) {
  const [txId, setTxId] = useState("");
  const [origTx, setOrigTx] = useState(null);
  const [searching, setSearching] = useState(false);
  // returnItems: { [index]: qty } — items being returned
  const [returnSel, setReturnSel] = useState({});
  // replaceItems: products to give the customer in exchange
  const [replaceCart, setReplaceCart] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [step, setStep] = useState("lookup"); // "lookup" | "select"
  const [returnSerialVerify, setReturnSerialVerify] = useState(null); // { index }
  const [replaceSerialCapture, setReplaceSerialCapture] = useState(null); // { product }
  const [verifiedReturnSerials, setVerifiedReturnSerials] = useState({}); // { [index]: serial }

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
    if (itemHasSerials(item)) {
      setReturnSerialVerify({ index: i });
      return;
    }
    setReturnSel(prev => {
      if (prev[i] !== undefined) { const n = { ...prev }; delete n[i]; return n; }
      return { ...prev, [i]: remainingQty(item) };
    });
  };

  const verifyExchangeReceiptSerial = async (serial) => {
    const idx = returnSerialVerify?.index;
    if (idx == null) return false;
    const item = origItems[idx];
    return (item?.serial_numbers || []).map(s => (s || "").toUpperCase()).includes((serial || "").toUpperCase());
  };

  const onReturnSerialVerified = (serial) => {
    const idx = returnSerialVerify?.index;
    setReturnSerialVerify(null);
    if (idx == null) return;
    setVerifiedReturnSerials(prev => ({ ...prev, [idx]: serial }));
    setReturnSel(prev => ({ ...prev, [idx]: 1 }));
  };

  const setReturnQty = (i, qty, item) => {
    const max = remainingQty(item);
    setReturnSel(prev => ({ ...prev, [i]: Math.min(Math.max(1, parseInt(qty) || 1), max) }));
  };

  const addReplace = (product) => {
    if (product.serialized) {
      setReplaceSerialCapture({ product });
      return;
    }
    setReplaceCart(prev => {
      const ex = prev.find(i => i.sku === product.sku && !i.serialized);
      if (ex) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1, total: +(( i.qty + 1) * i.price).toFixed(2) } : i);
      return [...prev, { sku: product.sku, name: product.name, price: product.price, qty: 1, total: product.price, tax_rate: product.tax_rate || 0 }];
    });
  };

  const onReplaceSerialCaptured = async (serials) => {
    const prod = replaceSerialCapture?.product;
    const sn = serials[0];
    if (prod && sn) {
      if (replaceCart.some(i => i.sku === prod.sku && (i.serial_numbers || []).includes(sn))) {
        toast({ title: "Duplicate Serial", description: "That serial is already in this exchange.", variant: "destructive" });
        setReplaceSerialCapture(null);
        return;
      }
      const check = await verifySerialInStock(prod.sku, sn);
      if (!check.ok) {
        toast({ title: "Serial Not Verified", description: check.reason, variant: "destructive" });
        setReplaceSerialCapture(null);
        return;
      }
      setReplaceCart(prev => [...prev, { sku: prod.sku, name: prod.name, price: prod.price, qty: 1, total: prod.price, tax_rate: prod.tax_rate || 0, serialized: true, serial_numbers: [sn] }]);
    }
    setReplaceSerialCapture(null);
  };

  const removeReplace = (key) => setReplaceCart(prev => prev.filter(i => (i.serial_numbers?.[0] || i.sku) !== key));

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
    recordSerializedSales({ items: replaceCart, transactionId: exTxId, operator, storeId: sessionStorage.getItem("pos_store_id") || "" }).catch(() => {});
    // Track exchanged quantities the same way as refunds
    const newRefundedQty = { ...refundedQty };
    returnedItems.forEach(ri => { newRefundedQty[ri.sku] = (newRefundedQty[ri.sku] || 0) + ri.qty; });
    const allExchanged = origItems.every(item => (newRefundedQty[item.sku] || 0) >= item.qty);
    await base44.entities.Transaction.update(origTx.id, {
      refund_type: "exchange",
      refunded_qty: newRefundedQty,
      status: allExchanged ? "exchanged" : "completed"
    });
    for (const ri of returnedItems) {
      const idx = origItems.indexOf(ri);
      const serial = verifiedReturnSerials[idx];
      if (serial) { try { await markSerialReturned(ri.sku, serial, { returnTransactionId: exTxId, exchanged: true }); } catch {} }
    }
    const msg = diff > 0 ? `Customer owes $${diff.toFixed(2)}` : diff < 0 ? `Refund $${Math.abs(diff).toFixed(2)} to customer` : "Even exchange";
    toast({ title: "Exchange Processed", description: `${exTxId} — ${msg}` });
    setTxId(""); setOrigTx(null); setReturnSel({}); setReplaceCart([]); setVerifiedReturnSerials({}); setStep("lookup");
    onPreviewChange(null);
    loadData();
  };

  const reset = () => { setTxId(""); setOrigTx(null); setReturnSel({}); setReplaceCart([]); setVerifiedReturnSerials({}); setStep("lookup"); onPreviewChange(null); };

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
                        {itemHasSerials(item) && verifiedReturnSerials[i] && <span className="text-[9px] text-indigo-400 font-mono">SN: {verifiedReturnSerials[i]}</span>}
                        {itemHasSerials(item) && !verifiedReturnSerials[i] && checked && <span className="text-[9px] text-indigo-400/70 font-mono">awaiting serial</span>}
                      </div>
                    </div>
                    {checked && (
                      <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        {!itemHasSerials(item) && <button onClick={() => setReturnQty(i, returnSel[i] - 1, item)} className="w-4 h-4 rounded bg-teal-600/30 text-teal-300 flex items-center justify-center text-[10px]">−</button>}
                        <span className="text-white text-[10px] w-4 text-center">{returnSel[i]}</span>
                        {!itemHasSerials(item) && <button onClick={() => setReturnQty(i, returnSel[i] + 1, item)} className="w-4 h-4 rounded bg-teal-600/30 text-teal-300 flex items-center justify-center text-[10px]">+</button>}
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
                  <div key={i.serial_numbers?.[0] || i.sku} className="flex items-center justify-between text-[10px]">
                    <span className="text-white truncate flex items-center gap-1">{i.qty}× {i.name}{i.serialized && <><ScanLine className="w-3 h-3 text-indigo-400" /><span className="text-indigo-400 font-mono">{i.serial_numbers?.[0]}</span></>}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-300">${i.total.toFixed(2)}</span>
                      <button onClick={() => removeReplace(i.serial_numbers?.[0] || i.sku)} className="text-red-400/50 hover:text-red-400"><X className="w-3 h-3" /></button>
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

      <POSSerialVerifyDialog
        open={!!returnSerialVerify}
        item={returnSerialVerify ? origItems[returnSerialVerify.index] : null}
        mode="receipt"
        verify={verifyExchangeReceiptSerial}
        onVerified={onReturnSerialVerified}
        onClose={() => setReturnSerialVerify(null)}
      />
      <POSSerialDialog
        open={!!replaceSerialCapture}
        product={replaceSerialCapture?.product}
        needed={1}
        onConfirm={onReplaceSerialCaptured}
        onClose={() => setReplaceSerialCapture(null)}
      />
    </div>
  );
}