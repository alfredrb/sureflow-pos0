import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44, invalidateEntity } from "@/api/data";
import { Monitor } from "lucide-react";
import { getLaneRegisterId } from "@/lib/laneIdentity";
import { scopeCatalogToStore } from "@/lib/storeCatalog";
import useScoCart from "@/hooks/useScoCart";
import useScannerWedge from "@/hooks/useScannerWedge";
import useCustomerDisplayMirror from "@/hooks/useCustomerDisplayMirror";
import usePinpadCartMirror from "@/hooks/usePinpadCartMirror";
import { confirmAmountOnPinpad, idlePinpad, collectSaleRating } from "@/lib/pinpadFlow";
import { keyPhoneOnPinpad, confirmRedemptionOnPinpad, formatPhone } from "@/lib/loyaltyPinpad";
import { commitSaleTransaction, lookupGiftCardTender, commitGiftCardSale } from "@/lib/posSaleCommit";
import { printReceipt } from "@/lib/printReceipt";
import { createAssistanceRequest, resolveAssistanceRequest, SUPERVISOR_REQUIRED } from "@/lib/scoAssist";
import { verifyOperatorCredentials, SUPERVISOR_ROLES } from "@/lib/operatorAuth";
import SCOWelcome from "@/components/sco/SCOWelcome";
import SCOCartPanel from "@/components/sco/SCOCartPanel";
import SCOPayPanel from "@/components/sco/SCOPayPanel";
import SCOHelpScreen from "@/components/sco/SCOHelpScreen";
import SCOThanks from "@/components/sco/SCOThanks";
import SCOAttendantBar from "@/components/sco/SCOAttendantBar";
import SCOLaneClosedScreen from "@/components/sco/SCOLaneClosedScreen";
import { setLanePaused, setLaneClosed } from "@/lib/scoLaneControl";
import { makeSuspendId, createSuspendRecord } from "@/lib/posSuspend";
import { makeTransferId, createTransferRecord } from "@/lib/posTransfer";

// The sale is committed under this synthetic operator so every report can see
// exactly which sales were customer-operated.
const SCO_OPERATOR = { operator_id: "SCO", full_name: "Self Checkout" };
const THANKS_RESET_MS = 12000;

export default function SCOLane() {
  const [register, setRegister] = useState(null);
  const [products, setProducts] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [storeConfig, setStoreConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState("welcome"); // welcome | scanning | paying | thanks
  const [message, setMessage] = useState("");
  const [assist, setAssist] = useState(null); // { request, product }
  const [unlockError, setUnlockError] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [payMessage, setPayMessage] = useState("");
  const [loyaltyMessage, setLoyaltyMessage] = useState("");
  const [loyaltyMember, setLoyaltyMember] = useState(null);
  const [loyaltyApplied, setLoyaltyApplied] = useState(0);
  const [rewardsConfirmed, setRewardsConfirmed] = useState(false);
  const [receipt, setReceipt] = useState(null);
  // Attendant signed on at this lane (top-bar menu). Never the sale's operator —
  // the sale still commits as Self Checkout.
  const [attendant, setAttendant] = useState(null);
  const thanksTimer = useRef(null);

  const registerId = useMemo(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("register_id");
    return fromUrl || getLaneRegisterId() || sessionStorage.getItem("pos_register_num") || "";
  }, []);
  const storeId = register?.store_id || "";

  const { cart, scanCode, commitApproved, removeItem, clear, subtotal, tax, total } = useScoCart({ products, discounts });
  const amountDue = Math.max(0, +(total - loyaltyApplied).toFixed(2));

  // Load the lane's register, catalog, discounts and receipt config.
  useEffect(() => {
    if (!registerId) { setLoading(false); return; }
    (async () => {
      try {
        const [regs, prods, discs, config] = await Promise.all([
          base44.entities.Register.filter({ register_id: registerId }),
          base44.entities.Product.filter({ status: "active" }),
          base44.entities.DiscountType.list(),
          base44.entities.ReceiptConfig.list(),
        ]);
        const reg = regs[0] || null;
        setRegister(reg);
        if (reg) {
          sessionStorage.setItem("pos_register_num", reg.register_id);
          if (reg.store_id) sessionStorage.setItem("pos_store_id", reg.store_id);
        }
        setProducts(scopeCatalogToStore(prods, reg?.store_id || ""));
        setDiscounts(discs);
        setStoreConfig(config[0] || null);
      } catch (e) {
        console.error("SCO load error:", e);
      }
      setLoading(false);
    })();
  }, [registerId]);

  // The lane follows its own register record, so a pause / close done from the
  // attendant panel on another lane takes effect here immediately.
  // The cached copy has to be dropped first — without it the re-read returns the
  // pre-change record and the lane looks like it ignored the attendant.
  const refreshRegister = useCallback(async () => {
    if (!registerId) return;
    invalidateEntity("Register");
    const rows = await base44.entities.Register.filter({ register_id: registerId });
    if (rows[0]) setRegister(rows[0]);
  }, [registerId]);

  // Subscription for the instant case, plus a slow poll so an unlock still lands
  // if the lane's socket dropped — a customer must never be left on a stale
  // Lane Closed screen waiting for someone to refresh the browser.
  useEffect(() => {
    if (!register) return;
    const unsub = base44.entities.Register.subscribe(() => refreshRegister());
    const poll = setInterval(refreshRegister, 5000);
    return () => { unsub(); clearInterval(poll); };
  }, [!!register, refreshRegister]);

  // Customer pinpad on this lane — mirrors the cart, takes confirms/signature.
  const pinpadContext = usePinpadCartMirror({
    pinpadConfig: { pinpad_model: register?.pinpad_model || "", pinpad_ip: register?.pinpad_ip || "" },
    registerId,
    cart, subtotal, tax, total,
  });

  // The lane publishes its state (sale / idle / thanks) so the attendant panel —
  // and a second customer monitor, if fitted — can follow it in realtime.
  useCustomerDisplayMirror({
    enabled: !!register,
    registerId, storeId,
    cart, subtotal, tax, total,
    trainingMode: false,
    lastReceipt: receipt,
    // Lets the attendant panel show PAYING while the customer is on the pay screen.
    lanePhase: phase,
  });

  // ── Scanning ───────────────────────────────────────────────────────────────
  // action/payload let a request stand for something other than an item add —
  // a high-value void or a whole-order cancellation the attendant must approve.
  const raiseAssist = useCallback(async (reason, product, detail = "", action = null, payload = null) => {
    const req = await createAssistanceRequest({
      registerId, storeId, reason, detail,
      sku: product?.sku || "", productName: product?.name || "",
    });
    setUnlockError("");
    setAssist({ request: req, product: product || null, action, payload });
  }, [registerId, storeId]);

  const handleCode = useCallback((code) => {
    if (assist || payBusy || phase === "thanks") return;
    if (phase !== "scanning") setPhase("scanning");
    const res = scanCode(code);
    if (res.notFound) raiseAssist("unscannable", null, `Code "${res.code}" matched no item`);
    else if (res.blocked) raiseAssist(res.blocked, res.product, res.detail || "");
    else setMessage(`${res.product.name} added`);
  }, [assist, payBusy, phase, scanCode, raiseAssist]);

  useScannerWedge({ onScan: handleCode, enabled: !loading && !!register });

  // ── Assistance resolution (remote OR walk-over flows back through here) ────
  useEffect(() => {
    const reqId = assist?.request?.id;
    if (!reqId) return;
    const check = async () => {
      invalidateEntity("SCOAssistanceRequest");
      const rows = await base44.entities.SCOAssistanceRequest.filter({ id: reqId });
      const r = rows[0];
      if (!r || r.status === "pending") return;
      const product = assist?.product;
      const action = assist?.action;
      const payload = assist?.payload;
      setAssist(null);
      setUnlockError("");
      // Exception requests the customer raised on their own order: the attendant's
      // approval is what carries out the void / cancellation, a release leaves the
      // order exactly as it was.
      if (action === "void") {
        if (r.status === "approved") { removeItem(payload.sku); setMessage(`${payload.name} removed by ${r.attendant_name || "attendant"}`); }
        else setMessage("The item stays on your order — continue shopping");
        return;
      }
      if (action === "cancel") {
        if (r.status === "approved") { clearOrder(); setMessage(""); }
        else setMessage("Your order was kept — continue shopping");
        return;
      }
      if (r.status === "approved" && product) {
        if (r.reason === "serialized") {
          if (r.serial_number) commitApproved(product, r.serial_number);
        } else {
          commitApproved(product);
        }
        setMessage(`${product.name} approved by ${r.attendant_name || "attendant"}`);
      } else if (r.status === "approved") {
        setMessage(`Approved by ${r.attendant_name || "attendant"}`);
      } else if (r.status === "released") {
        setMessage("An attendant released the lane — continue shopping");
      } else {
        setMessage("");
      }
    };
    const unsub = base44.entities.SCOAssistanceRequest.subscribe(() => check());
    const poll = setInterval(check, 3000);
    check();
    return () => { unsub(); clearInterval(poll); };
  }, [assist?.request?.id]);

  // Walk-over: the attendant keys credentials on this lane's locked screen.
  const handleLaneUnlock = async ({ operatorId, pin, serial, release }) => {
    if (!assist) return;
    setUnlockError(""); setUnlockLoading(true);
    const needsSup = SUPERVISOR_REQUIRED.includes(assist.request.reason);
    const res = await verifyOperatorCredentials(operatorId, pin, needsSup ? { roles: SUPERVISOR_ROLES } : { requireActive: true });
    if (!res.ok) { setUnlockError(res.error); setUnlockLoading(false); return; }
    const status = (release || needsSup) ? "released" : "approved";
    if (status === "approved" && assist.request.reason === "serialized" && !serial) {
      setUnlockError("Scan or key the item's serial number first");
      setUnlockLoading(false);
      return;
    }
    await resolveAssistanceRequest(assist.request, { status, attendant: res.operator, serial: serial || "", via: "lane" });
    setUnlockLoading(false);
  };

  // Customer withdraws a Help call they raised themselves.
  const cancelHelp = async () => {
    if (assist?.request?.reason !== "attendant_help") return;
    await resolveAssistanceRequest(assist.request, { status: "cancelled", via: "lane" });
  };

  // ── Loyalty ────────────────────────────────────────────────────────────────
  const addLoyalty = async (phoneFromScreen) => {
    setLoyaltyMessage("");
    let phone = (phoneFromScreen || "").replace(/\D/g, "");
    if (!phone) phone = await keyPhoneOnPinpad(pinpadContext);
    if (!phone) { setLoyaltyMessage("Enter your phone number to look up your rewards."); return; }
    let members = await base44.entities.LoyaltyMember.filter({ phone });
    if (members.length === 0) members = await base44.entities.LoyaltyMember.filter({ phone: formatPhone(phone) });
    const m = members[0];
    if (!m || m.status !== "active") { setLoyaltyMessage("No rewards member found for that number — see a cashier to sign up."); return; }
    let amt = Math.min(m.rewards_balance || 0, total);
    let confirmed = false;
    if (amt > 0) {
      const out = await confirmRedemptionOnPinpad(pinpadContext, amt);
      if (out.asked && !out.approved) amt = 0;
      else confirmed = out.asked;
    }
    setLoyaltyMember(m);
    setLoyaltyApplied(+amt.toFixed(2));
    setRewardsConfirmed(confirmed);
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const rewardsEarnedFor = () =>
    loyaltyMember ? +(subtotal * ((storeConfig?.loyalty_points_percentage ?? 5) / 100)).toFixed(2) : 0;

  const completeSale = ({ txId, method, rewardsEarned, newBalance }) => {
    base44.entities.RegisterLog.create({
      event_type: "transaction",
      operator_id: SCO_OPERATOR.operator_id,
      operator_name: SCO_OPERATOR.full_name,
      operator_role: "sco",
      register_id: registerId,
      detail: `Self-checkout sale completed — ${cart.length} item(s), ${method}`,
      transaction_id: txId,
      transaction_total: total,
      items: cart.map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price, total: i.total })),
    }).catch(() => {});
    printReceipt({
      transactionId: txId,
      registerName: register?.name || registerId,
      registerId,
      operatorName: SCO_OPERATOR.full_name,
      printerIp: register?.printer_ip || "",
      items: cart, subtotal, tax, total,
      paymentMethod: method,
      tenders: [{ method, amount: amountDue }],
      rewardsApplied: loyaltyApplied,
      rewardsEarned,
      loyaltyMember: loyaltyMember ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id } : null,
      newBalance,
      storeConfig,
      storeInfo: { store_number: storeId },
    }).catch(() => {});
    setReceipt({ transactionId: txId, total: amountDue, rewardsEarned, loyaltyName: loyaltyMember?.name || "", method });
    clear();
    setLoyaltyMember(null); setLoyaltyApplied(0); setRewardsConfirmed(false);
    setPayMessage(""); setMessage("");
    setPhase("thanks");
    collectSaleRating(pinpadContext, txId);
    if (thanksTimer.current) clearTimeout(thanksTimer.current);
    thanksTimer.current = setTimeout(() => resetLane(), THANKS_RESET_MS);
  };

  const resetLane = () => {
    if (thanksTimer.current) { clearTimeout(thanksTimer.current); thanksTimer.current = null; }
    setReceipt(null);
    setPhase("welcome");
    idlePinpad(pinpadContext);
  };

  const payCard = async () => {
    if (cart.length === 0 || payBusy) return;
    setPayBusy(true);
    setPayMessage("Follow the prompts on the card reader…");
    const { approved } = await confirmAmountOnPinpad(pinpadContext, amountDue);
    if (!approved) { setPayMessage("Payment was cancelled on the card reader."); setPayBusy(false); return; }
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    try {
      const newBalance = await commitSaleTransaction({
        txId, operator: SCO_OPERATOR, registerId, storeId,
        cart, products, subtotal, tax, total,
        paymentMethod: "credit", amountTendered: amountDue, changeDue: 0,
        tenders: [{ method: "credit", amount: amountDue }],
        loyaltyMember, loyaltyAppliedAmount: loyaltyApplied,
        rewardsEarned: rewardsEarnedFor(),
        rewardsConfirmedOnPinpad: rewardsConfirmed,
        selfCheckout: true,
      });
      completeSale({ txId, method: "credit", rewardsEarned: rewardsEarnedFor(), newBalance });
    } catch (e) {
      setPayMessage("Payment could not be completed — please call for help.");
    }
    setPayBusy(false);
  };

  const payGiftCard = async (cardNumber) => {
    if (payBusy) return;
    setPayBusy(true);
    setPayMessage("Checking gift card…");
    try {
      const { error, result } = await lookupGiftCardTender(cardNumber, amountDue.toFixed(2));
      if (error || !result?.approved) {
        setPayMessage(error || result?.message || "Gift card declined");
        setPayBusy(false);
        return;
      }
      const txId = "TX-" + Date.now().toString(36).toUpperCase();
      const newBalance = await commitGiftCardSale({
        card: result.card, chargeAmount: result.chargeAmount,
        txId, operator: SCO_OPERATOR, registerId, storeId,
        cart, products, subtotal, tax, total,
        loyaltyMember, loyaltyAppliedAmount: loyaltyApplied,
        rewardsEarned: rewardsEarnedFor(),
        rewardsConfirmedOnPinpad: rewardsConfirmed,
        selfCheckout: true,
      });
      completeSale({ txId, method: "giftcard", rewardsEarned: rewardsEarnedFor(), newBalance });
    } catch (e) {
      setPayMessage("Gift card payment failed — please call for help.");
    }
    setPayBusy(false);
  };

  const clearOrder = () => {
    clear();
    setLoyaltyMember(null); setLoyaltyApplied(0); setRewardsConfirmed(false);
    setMessage(""); setPayMessage("");
    setPhase("welcome");
  };

  // ── Customer exceptions an attendant has to sign off ───────────────────────
  // Voiding a high-value line is the classic self-checkout shrink route, so at or
  // above the lane's threshold the item stays put until an attendant approves.
  const voidThreshold = register?.sco_void_threshold ?? 25;
  const requestVoid = (sku) => {
    const item = cart.find((i) => i.sku === sku);
    if (!item) return;
    if (item.total < voidThreshold) { removeItem(sku); setMessage(`${item.name} removed`); return; }
    raiseAssist(
      "void_review", null,
      `${item.name} — $${item.total.toFixed(2)} removal requested`,
      "void", { sku, name: item.name },
    );
  };

  // Walking away from a started order needs an attendant too, so a full basket is
  // never abandoned unseen.
  const requestCancel = () => {
    if (cart.length === 0) { clearOrder(); return; }
    raiseAssist(
      "cancel_review", null,
      `${cart.length} item(s), $${total.toFixed(2)} on the order`,
      "cancel", null,
    );
  };

  // ── Attendant menu actions (signed on at the lane) ─────────────────────────
  const parkOrder = async (kind) => {
    const id = kind === "transfer" ? makeTransferId() : makeSuspendId();
    const args = {
      storeId, registerId, operator: attendant || SCO_OPERATOR, cart,
      subtotal, tax, total, itemCount: cart.reduce((s, i) => s + i.qty, 0),
      taxExemptId: null, loyaltyMember, trainingMode: false,
    };
    if (kind === "transfer") await createTransferRecord({ transferId: id, ...args });
    else await createSuspendRecord({ suspendId: id, ...args });
    clearOrder();
    setMessage(kind === "transfer"
      ? `Order ${id} sent to ${register?.attendant_register_id} — retrieve it there with AC 851`
      : `Order suspended as ${id} — resume it at any register`);
  };

  const laneAction = async (fn) => { await fn(); await refreshRegister(); };

  useEffect(() => () => { if (thanksTimer.current) clearTimeout(thanksTimer.current); }, []);

  if (loading) return (
    <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  if (!register || !register.feature_self_checkout) return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Monitor className="w-14 h-14 text-blue-500/40" />
      <h1 className="text-white text-2xl font-bold">Lane not configured for self-checkout</h1>
      <p className="text-blue-300/50 max-w-md">
        {registerId
          ? `Register "${registerId}" is not flagged as a self-checkout lane. Enable Self-Checkout on it in Admin → Registers.`
          : "No register identity on this lane — boot it with ?register_id=… or set one from the POS config screen."}
      </p>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-blue-500/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold">{storeConfig?.store_name || "SureFlow"} Self Checkout</span>
        </div>
        <div className="flex items-center gap-3">
          <SCOAttendantBar
            register={register}
            attendant={attendant}
            setAttendant={setAttendant}
            hasItems={cart.length > 0}
            itemCount={products.length}
            onSuspend={() => parkOrder("suspend")}
            onSendToRegister={() => parkOrder("transfer")}
            onPause={() => laneAction(() => setLanePaused(register, true, attendant))}
            onResume={() => laneAction(() => setLanePaused(register, false, attendant))}
            onCloseLane={(reason) => laneAction(() => setLaneClosed(register, true, { reason, attendant }))}
            onOpenLane={() => laneAction(() => setLaneClosed(register, false, { attendant }))}
          />
          <span className="text-blue-300/40 font-mono text-sm">{register.register_id}</span>
        </div>
      </div>

      {(register.sco_closed || register.paused) && (
        <SCOLaneClosedScreen closed={!!register.sco_closed} reason={register.sco_closed_reason} />
      )}

      {!register.sco_closed && !register.paused && phase === "welcome" && (
        <SCOWelcome storeName={storeConfig?.store_name} onStart={() => setPhase("scanning")} />
      )}
      {!register.sco_closed && !register.paused && phase === "scanning" && (
        <SCOCartPanel
          cart={cart} subtotal={subtotal} tax={tax} amountDue={amountDue}
          loyaltyApplied={loyaltyApplied} message={message}
          onRemove={requestVoid}
          onPay={() => cart.length > 0 && setPhase("paying")}
          onHelp={() => raiseAssist("attendant_help")}
          onCancel={requestCancel}
          onManualCode={handleCode}
        />
      )}
      {!register.sco_closed && !register.paused && phase === "paying" && (
        <SCOPayPanel
          amountDue={amountDue}
          loyaltyMember={loyaltyMember} loyaltyApplied={loyaltyApplied}
          payBusy={payBusy} payMessage={payMessage} loyaltyMessage={loyaltyMessage}
          onPayCard={payCard} onPayGift={payGiftCard} onAddLoyalty={addLoyalty}
          onBack={() => { setPayMessage(""); setPhase("scanning"); }}
        />
      )}
      {!register.sco_closed && !register.paused && phase === "thanks" && <SCOThanks receipt={receipt} onDone={resetLane} />}

      {assist && (
        <SCOHelpScreen
          request={assist.request}
          product={assist.product}
          onUnlock={handleLaneUnlock}
          unlockError={unlockError}
          unlockLoading={unlockLoading}
          onCancel={assist.request.reason === "attendant_help" ? cancelHelp : null}
        />
      )}
    </div>
  );
}