import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { FileX, ShieldCheck, ArrowLeft, Search, Trash2, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function makeGiftCardNumber() {
  return "GC-" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
}

function buildReceiptHTML({ store, txId, operatorName, registerName, items, subtotal, tax, total, paymentMethod, giftCardNumber, customerId, mode, managerName, refusal, denialReason, limitWarn }) {
  const storeName = store?.store_name || "Supermart";
  const isManager = mode === "manager_override";
  const title = refusal ? "NO-RECEIPT RETURN DENIED" : isManager ? "MANAGER OVERRIDE RETURN" : "NO-RECEIPT RETURN";
  const itemsHTML = (items || []).map(i => `<div class="row"><span>${i.qty}x ${i.name}</span><span>$${i.total.toFixed(2)}</span></div>`).join("");
  const refusalBlock = refusal ? `<div class="refusal">CUSTOMER ID ${customerId} IS NOT PERMITTED TO MAKE NO-RECEIPT RETURNS.${denialReason ? `<br>${denialReason}` : ""} PLEASE SEE A MANAGER.</div>` : "";
  const warnBlock = !refusal && limitWarn ? `<div class="warn">${limitWarn}</div>` : "";
  const custBlock = !refusal && customerId ? `<div class="row"><span>Customer ID:</span><span>${customerId}</span></div>` : "";
  const mgrBlock = !refusal && isManager && managerName ? `<div class="row"><span>Authorized by:</span><span>${managerName}</span></div>` : "";
  const totalsBlock = !refusal
    ? `<div class="div"></div>
       <div class="row"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
       <div class="row"><span>Tax:</span><span>$${tax.toFixed(2)}</span></div>
       <div class="row bold"><span>REFUND TOTAL:</span><span>$${total.toFixed(2)}</span></div>
       <div class="row bold"><span>REFUND TO GIFT CARD:</span><span>${giftCardNumber}</span></div>`
    : "";
  return `<!DOCTYPE html><html><head><style>
    body{font-family:monospace;width:80mm;margin:0;padding:10mm}
    .center{text-align:center}
    .header{font-weight:bold;font-size:14px}
    .sub{font-size:11px;line-height:1.4}
    .div{border-top:1px solid #000;margin:8px 0}
    .row{display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px}
    .bold{font-weight:bold;font-size:13px}
    .title{font-weight:bold;font-size:12px;text-align:center;margin:8px 0}
    .refusal{border:2px solid #000;padding:8px;margin:10px 0;font-weight:bold;font-size:11px;text-align:center}
    .warn{border:2px solid #000;background:#fff3cd;padding:6px;margin:8px 0;font-weight:bold;font-size:10px;text-align:center}
  </style></head><body>
    <div class="center">
      <div class="header">${storeName}</div>
      ${store?.store_address ? `<div class="sub">${store.store_address}</div>` : ""}
      ${store?.store_phone ? `<div class="sub">${store.store_phone}</div>` : ""}
      <div class="div"></div>
      <div class="title">${title}</div>
      <div class="div"></div>
      <div class="row"><span>TX ID:</span><span>${txId}</span></div>
      <div class="row"><span>Date:</span><span>${new Date().toLocaleString()}</span></div>
      <div class="row"><span>Register:</span><span>${registerName}</span></div>
      <div class="row"><span>Operator:</span><span>${operatorName}</span></div>
      ${custBlock}
      ${mgrBlock}
      <div class="div"></div>
      ${itemsHTML}
      ${refusalBlock}
      ${totalsBlock}
      ${warnBlock}
      <div class="div"></div>
      <div class="sub center">No-receipt returns are logged and monitored for fraud.</div>
      <div class="sub center">Thank You!</div>
    </div>
  </body></html>`;
}

function printDoc(html) {
  const w = window.open("", "", "width=400,height=600");
  w.document.write(html);
  w.document.close();
  w.print();
}

export default function POSNoReceiptReturn({ mode, operator, products, loadData, toast, onPreviewChange, onBack }) {
  const isManager = mode === "manager_override";
  const THEME = isManager ? {
    icon: "text-orange-400", text: "text-orange-300", border: "border-orange-500/20",
    label: "text-orange-300/60", btn: "bg-orange-600 hover:bg-orange-500 text-white",
    totalText: "text-orange-300",
  } : {
    icon: "text-fuchsia-400", text: "text-fuchsia-300", border: "border-fuchsia-500/20",
    label: "text-fuchsia-300/60", btn: "bg-fuchsia-600 hover:bg-fuchsia-500 text-white",
    totalText: "text-fuchsia-300",
  };

  const [store, setStore] = useState(null);
  const [managerAuth, setManagerAuth] = useState(null);
  const [managerPin, setManagerPin] = useState("");
  const [managerError, setManagerError] = useState("");
  const [authorizing, setAuthorizing] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerVerified, setCustomerVerified] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [customerRec, setCustomerRec] = useState(null);
  const [posWarn, setPosWarn] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    base44.entities.StoreSettings.list().then(s => { if (s[0]) setStore(s[0]); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (returnItems.length === 0) { onPreviewChange(null); return; }
    const sub = returnItems.reduce((s, i) => s + i.total, 0);
    const tx = returnItems.reduce((s, i) => s + (i.total * ((i.tax_rate || 0) / 100)), 0);
    onPreviewChange({ items: returnItems, subtotal: sub, tax: tx, total: +(sub + tx).toFixed(2), type: "return" });
  }, [returnItems]);

  const authorizeManager = async () => {
    setManagerError("");
    setAuthorizing(true);
    try {
      const ops = await base44.entities.Operator.filter({ pin: managerPin });
      const mgr = ops.find(o => o.role === "manager" && o.pos_access !== false);
      if (!mgr) { setManagerError("Invalid PIN — Manager required"); setAuthorizing(false); return; }
      setManagerAuth(mgr);
      setManagerPin("");
      toast({ title: "Manager Authorized", description: `${mgr.full_name} approved the manager override return` });
    } catch (e) { setManagerError("Authorization failed"); }
    setAuthorizing(false);
  };

  const lookupCustomer = async () => {
    if (!customerId.trim()) return;
    setBlocked(false);
    setPosWarn("");
    try {
      const records = await base44.entities.NoReceiptCustomer.filter({ customer_id: customerId.trim() });
      const rec = records[0];
      const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
      const lim = store?.no_receipt_return_limit || 0;
      const used = rec?.return_count || 0;
      if (rec && rec.disabled) {
        setBlockReason("is disabled from making no-receipt returns.");
        setBlocked(true);
        base44.entities.RegisterLog.create({
          event_type: "override",
          operator_id: operator.operator_id,
          operator_name: operator.full_name,
          operator_role: operator.role,
          register_id: registerId,
          detail: `No-receipt return BLOCKED — Customer ID ${customerId.trim()} is disabled from no-receipt returns`,
        });
        printDoc(buildReceiptHTML({ store, txId: "DENIED-" + Date.now().toString(36).toUpperCase(), operatorName: operator.full_name, registerName: registerId, items: [], subtotal: 0, tax: 0, total: 0, paymentMethod: "", customerId: customerId.trim(), mode, managerName: managerAuth?.full_name, refusal: true }));
        toast({ title: "Customer Blocked", description: "Receipt printed — customer cannot make no-receipt returns. See manager.", variant: "destructive" });
        return;
      }
      if (lim > 0 && used >= lim) {
        setBlockReason(`has reached the no-receipt return limit (${used} of ${lim} used).`);
        setBlocked(true);
        base44.entities.RegisterLog.create({
          event_type: "override",
          operator_id: operator.operator_id,
          operator_name: operator.full_name,
          operator_role: operator.role,
          register_id: registerId,
          detail: `No-receipt return BLOCKED — Customer ID ${customerId.trim()} reached the return limit (${used}/${lim})`,
        });
        printDoc(buildReceiptHTML({ store, txId: "DENIED-" + Date.now().toString(36).toUpperCase(), operatorName: operator.full_name, registerName: registerId, items: [], subtotal: 0, tax: 0, total: 0, paymentMethod: "", customerId: customerId.trim(), mode, managerName: managerAuth?.full_name, refusal: true, denialReason: `Return limit reached (${used}/${lim}).` }));
        toast({ title: "Return Limit Reached", description: "Customer has hit the no-receipt return limit. See manager.", variant: "destructive" });
        return;
      }
      setCustomerRec(rec || null);
      if (lim > 0 && used >= Math.ceil(0.75 * lim)) {
        setPosWarn(`High-risk customer: ${used} of ${lim} no-receipt returns used (75%+). They will be cut off soon.`);
      } else {
        setPosWarn("");
      }
      setCustomerVerified(true);
    } catch (e) {
      toast({ title: "Error", description: "Could not verify customer", variant: "destructive" });
    }
  };

  const matchedProducts = useMemo(() => {
    if (!itemSearch.trim()) return [];
    const q = itemSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || p.sku.includes(itemSearch)).slice(0, 6);
  }, [itemSearch, products]);

  const addItem = (prod) => {
    const existing = returnItems.find(i => i.sku === prod.sku);
    if (existing) {
      setReturnItems(prev => prev.map(i => i.sku === prod.sku ? { ...i, qty: i.qty + 1, total: +((i.qty + 1) * i.price).toFixed(2) } : i));
    } else {
      setReturnItems(prev => [...prev, { sku: prod.sku, name: prod.name, qty: 1, price: prod.price, total: prod.price, tax_rate: prod.tax_rate || 0 }]);
    }
    setItemSearch("");
  };

  const setQty = (sku, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setReturnItems(prev => prev.map(i => i.sku === sku ? { ...i, qty: q, total: +(q * i.price).toFixed(2) } : i));
  };

  const removeItem = (sku) => setReturnItems(prev => prev.filter(i => i.sku !== sku));

  const subtotal = returnItems.reduce((s, i) => s + i.total, 0);
  const tax = returnItems.reduce((s, i) => s + (i.total * ((i.tax_rate || 0) / 100)), 0);
  const total = +(subtotal + tax).toFixed(2);

  const processRefund = async () => {
    if (returnItems.length === 0) { toast({ title: "No items to return", variant: "destructive" }); return; }
    setProcessing(true);
    try {
      const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
      const prefix = isManager ? "MO-" : "NR-";
      const txId = prefix + Date.now().toString(36).toUpperCase();
      const custId = customerId.trim();

      const giftCardNumber = makeGiftCardNumber();
      await base44.entities.GiftCard.create({
        card_number: giftCardNumber,
        balance: total,
        original_amount: total,
        purchase_date: new Date().toISOString(),
        purchased_by_operator_id: operator.operator_id,
        purchased_by_operator_name: operator.full_name,
        register_id: registerId,
        status: "active",
        notes: `Issued for ${isManager ? "manager override" : "no-receipt"} return — Customer ID ${custId}`,
        transactions: [{ transaction_id: txId, amount: total, transaction_date: new Date().toISOString(), operator_id: operator.operator_id, operator_name: operator.full_name, register_id: registerId, type: "refund", remaining_balance: total }],
      });

      await base44.entities.Transaction.create({
        transaction_id: txId,
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        register_id: registerId,
        items: returnItems.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price, total: i.total })),
        subtotal, tax, total,
        payment_method: "giftcard",
        giftcard_number: giftCardNumber,
        status: "refunded",
        refund_type: "total",
        amount_tendered: total,
        change_due: 0,
        customer_id: custId,
        no_receipt: true,
        manager_override_return: isManager,
        ...(managerAuth ? { override_operator_id: managerAuth.operator_id, override_operator_name: managerAuth.full_name } : {}),
      });

      const lim = store?.no_receipt_return_limit || 0;
      let newCount = 1;
      const existing = await base44.entities.NoReceiptCustomer.filter({ customer_id: custId });
      if (existing.length > 0) {
        const r = existing[0];
        newCount = (r.return_count || 0) + 1;
        await base44.entities.NoReceiptCustomer.update(r.id, {
          return_count: newCount,
          total_refunded: +((r.total_refunded || 0) + total).toFixed(2),
          last_return_date: new Date().toISOString(),
          last_store_id: sessionStorage.getItem("pos_store_id") || "",
        });
      } else {
        await base44.entities.NoReceiptCustomer.create({
          customer_id: custId,
          return_count: 1,
          total_refunded: total,
          last_return_date: new Date().toISOString(),
          last_store_id: sessionStorage.getItem("pos_store_id") || "",
        });
      }
      let receiptWarn = "";
      if (lim > 0) {
        if (newCount >= lim) receiptWarn = `You have reached your no-receipt return limit (${newCount}/${lim}). Future no-receipt returns will be denied.`;
        else if (newCount >= Math.ceil(0.75 * lim)) receiptWarn = `You have reached 75% of your no-receipt return limit (${newCount}/${lim}). You will be cut off soon.`;
      }

      base44.entities.RegisterLog.create({
        event_type: "override",
        operator_id: operator.operator_id,
        operator_name: operator.full_name,
        operator_role: operator.role,
        register_id: registerId,
        detail: `${isManager ? "Manager override return" : "No-receipt return"} — Customer ID ${custId} — $${total.toFixed(2)} (refunded to gift card ${giftCardNumber})`,
        ...(managerAuth ? { override_operator_id: managerAuth.operator_id, override_operator_name: managerAuth.full_name, override_action: "Manager Override Return" } : {}),
      });

      printDoc(buildReceiptHTML({ store, txId, operatorName: operator.full_name, registerName: registerId, items: returnItems, subtotal, tax, total, paymentMethod: "giftcard", giftCardNumber, customerId: custId, mode, managerName: managerAuth?.full_name, refusal: false, limitWarn: receiptWarn }));

      toast({ title: "Return Processed", description: `${txId} — $${total.toFixed(2)} issued to gift card ${giftCardNumber}` });
      setReturnItems([]); setCustomerId(""); setCustomerVerified(false); setBlocked(false); setCustomerRec(null); setPosWarn("");
      if (isManager) setManagerAuth(null);
      onPreviewChange(null);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to process return", variant: "destructive" });
    }
    setProcessing(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {isManager ? <ShieldCheck className={`w-4 h-4 ${THEME.icon}`} /> : <FileX className={`w-4 h-4 ${THEME.icon}`} />}
          <p className={`${THEME.text} text-xs uppercase tracking-widest font-bold`}>{isManager ? "Manager Override Return" : "No Receipt Return"}</p>
        </div>
        <button onClick={onBack} className="text-blue-300/50 hover:text-blue-300 text-[10px] uppercase tracking-wider flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Receipt Return</button>
      </div>

      {isManager && !managerAuth && (
        <div className={`bg-[#111638] rounded-xl border ${THEME.border} p-4 space-y-3 flex-shrink-0`}>
          <p className="text-orange-300/80 text-xs">A Manager PIN is required to process a Manager Override Return.</p>
          <Input type="password" placeholder="Manager PIN" value={managerPin} onChange={e => setManagerPin(e.target.value)} onKeyDown={e => e.key === "Enter" && authorizeManager()} className="bg-[#0a0e27] border-orange-500/20 text-white text-center text-lg tracking-widest" autoFocus />
          {managerError && <p className="text-red-400 text-xs text-center">{managerError}</p>}
          <Button onClick={authorizeManager} disabled={authorizing || !managerPin} className="w-full bg-orange-600 hover:bg-orange-500 text-white">{authorizing ? "Authorizing..." : "Authorize Manager"}</Button>
        </div>
      )}

      {(!isManager || managerAuth) && !customerVerified && !blocked && (
        <div className={`bg-[#111638] rounded-xl border ${THEME.border} p-4 space-y-3 flex-shrink-0`}>
          <label className={`${THEME.label} text-[10px] uppercase tracking-wider block`}>Customer ID *</label>
          <Input value={customerId} onChange={e => setCustomerId(e.target.value)} onKeyDown={e => e.key === "Enter" && lookupCustomer()} placeholder="Enter customer ID number" className="bg-[#0a0e27] border-white/10 text-white font-mono" autoFocus />
          <Button onClick={lookupCustomer} disabled={!customerId.trim()} className={`w-full ${THEME.btn}`}>Continue</Button>
          {isManager && managerAuth && <p className="text-orange-300/60 text-[10px] text-center">Authorized by {managerAuth.full_name}</p>}
        </div>
      )}

      {blocked && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center"><Ban className="w-7 h-7 text-red-400" /></div>
          <h2 className="text-white font-bold text-lg">Customer Blocked</h2>
          <p className="text-red-300/70 text-sm max-w-xs">Customer ID <span className="font-mono font-bold text-red-300">{customerId}</span> {blockReason || "is disabled from making no-receipt returns."} A denial receipt has been printed. See a manager.</p>
          <div className="flex gap-2">
            <Button onClick={() => { setBlocked(false); setCustomerId(""); setBlockReason(""); }} variant="outline" className="border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">New Customer</Button>
            <Button onClick={onBack} variant="outline" className="border-blue-500/20 text-blue-300 hover:bg-blue-500/10 text-xs">Back to Returns</Button>
          </div>
        </div>
      )}

      {customerVerified && !blocked && (
        <>
          <div className={`bg-[#111638] rounded-xl border ${THEME.border} p-3 flex-shrink-0`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${THEME.label} text-[10px] uppercase tracking-wider`}>Customer ID</p>
                <p className="text-white font-mono font-bold">{customerId}</p>
              </div>
              <button onClick={() => { setCustomerVerified(false); setCustomerId(""); setReturnItems([]); onPreviewChange(null); setPosWarn(""); }} className="text-blue-300/50 hover:text-blue-300 text-[10px] uppercase tracking-wider">Change</button>
            </div>
          </div>

          {posWarn && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs font-medium">{posWarn}</p>
            </div>
          )}

          <div className="bg-[#111638] rounded-xl border border-blue-500/10 p-3 space-y-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300/30" />
              <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} placeholder="Search items to return..." className="bg-[#0a0e27] border-blue-500/10 text-white pl-8" />
            </div>
            {matchedProducts.length > 0 && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {matchedProducts.map(p => (
                  <button key={p.sku} onClick={() => addItem(p)} className="w-full flex items-center justify-between bg-[#0a0e27] hover:bg-[#161d50] border border-blue-500/10 rounded-lg px-2 py-1.5 text-left">
                    <span className="text-white text-xs truncate">{p.name}</span>
                    <span className="text-blue-300/50 text-[10px] font-mono">${p.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto bg-[#111638] rounded-xl border border-blue-500/10 p-3 space-y-2">
            {returnItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-blue-300/20 gap-2">
                <FileX className="w-8 h-8" />
                <p className="text-xs">Search and add items to return</p>
              </div>
            ) : returnItems.map(i => (
              <div key={i.sku} className="flex items-center gap-2 bg-[#0a0e27] rounded-lg p-2 border border-blue-500/10">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs truncate">{i.name}</p>
                  <p className="text-blue-300/40 text-[10px]">${i.price.toFixed(2)} ea</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(i.sku, i.qty - 1)} className="w-5 h-5 rounded bg-fuchsia-600/30 text-fuchsia-300 text-xs">−</button>
                  <span className="text-white text-xs w-5 text-center">{i.qty}</span>
                  <button onClick={() => setQty(i.sku, i.qty + 1)} className="w-5 h-5 rounded bg-fuchsia-600/30 text-fuchsia-300 text-xs">+</button>
                </div>
                <p className="text-fuchsia-300 text-xs font-semibold w-14 text-right">${i.total.toFixed(2)}</p>
                <button onClick={() => removeItem(i.sku)} className="text-red-400/60 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <div className="bg-[#111638] rounded-xl border border-purple-500/20 p-3 flex-shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-blue-300/50 text-[10px] uppercase tracking-wider">Refund Method</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">Gift Card (new)</span>
            </div>
            <div className="flex justify-between text-blue-300/50 text-xs"><span>Subtotal</span><span>−${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-blue-300/50 text-xs"><span>Tax</span><span>−${tax.toFixed(2)}</span></div>
            <div className={`flex justify-between ${THEME.totalText} text-lg font-bold pt-1.5 border-t border-purple-500/10`}><span>REFUND</span><span>${total.toFixed(2)}</span></div>
            <Button onClick={processRefund} disabled={returnItems.length === 0 || processing} className={`w-full ${THEME.btn} font-bold disabled:opacity-40`}>
              {processing ? "Processing..." : `Process ${isManager ? "Manager Override" : "No-Receipt"} Return — $${total.toFixed(2)}`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}