import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/data";
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
  });

  // ── Scanning ───────────────────────────────────────────────────────────────
  const raiseAssist = useCallback(async (reason, product, detail = "") => {
    const req = await createAssistanceRequest({
      registerId, storeId, reason, detail,
      sku: product?.sku || "", productName: product?.name || "",
    });
    setUnlockError("");
    setAssist({ request: req, product: product || null });
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
      const rows = await base44.entities.SCOAssistanceRequest.filter({ id: reqId });
      const r = rows[0];
      if (!r || r.status === "pending") return;
      const product = assist?.product;
      setAssist(null);
      setUnlockError("");
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
    check();
    return unsub;
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

  const cancelOrder = () => {
    clear();
    setLoyaltyMember(null); setLoyaltyApplied(0); setRewardsConfirmed(false);
    setMessage(""); setPayMessage("");
    setPhase("welcome");
  };

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
        <span className="text-blue-300/40 font-mono text-sm">{register.register_id}</span>
      </div>

      {phase === "welcome" && (
        <SCOWelcome storeName={storeConfig?.store_name} onStart={() => setPhase("scanning")} />
      )}
      {phase === "scanning" && (
        <SCOCartPanel
          cart={cart} subtotal={subtotal} tax={tax} amountDue={amountDue}
          loyaltyApplied={loyaltyApplied} message={message}
          onRemove={removeItem}
          onPay={() => cart.length > 0 && setPhase("paying")}
          onHelp={() => raiseAssist("attendant_help")}
          onCancel={cancelOrder}
          onManualCode={handleCode}
        />
      )}
      {phase === "paying" && (
        <SCOPayPanel
          amountDue={amountDue}
          loyaltyMember={loyaltyMember} loyaltyApplied={loyaltyApplied}
          payBusy={payBusy} payMessage={payMessage} loyaltyMessage={loyaltyMessage}
          onPayCard={payCard} onPayGift={payGiftCard} onAddLoyalty={addLoyalty}
          onBack={() => { setPayMessage(""); setPhase("scanning"); }}
        />
      )}
      {phase === "thanks" && <SCOThanks receipt={receipt} onDone={resetLane} />}

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