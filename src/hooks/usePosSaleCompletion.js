import { useState } from "react";
import { buildReceipt, commitSaleTransaction, lookupGiftCardTender, commitGiftCardSale } from "@/lib/posSaleCommit";
import { appliedTotal, balanceDue, changeFrom, isSettled, primaryTender, tendersAllowed } from "@/lib/tenderSplit";
import { submitOfflineSale } from "@/lib/offlineSale";
import { collectSaleRating } from "@/lib/pinpadFlow";
import { showChangeOnPole } from "@/lib/poleDisplayFlow";
import { showSaleCompleteOnPole } from "@/lib/poleStates";

// What the customer actually saved on this sale: every marked-down line plus any
// rewards credit applied. Shown on the pole after the change screen.
function saleSavings(cart, loyaltyAppliedAmount) {
  const markdowns = cart.reduce(
    (s, i) => s + Math.max(0, (i.original_price ?? i.price) - i.price) * (i.qty || 1), 0
  );
  return +(markdowns + (loyaltyAppliedAmount || 0)).toFixed(2);
}

// Sale completion for the POS register page: split-tender settlement, gift-card
// tender validation, and the training / offline / live commit paths with receipts.
// Owns the tender + gift-card entry state so the page stays orchestration-only.
export default function usePosSaleCompletion({
  cart, setCart, products, operator, subtotal, tax, total, amountDue,
  storeConfig, trainingMode, isOffline, offlineTenders, refreshConnectivity,
  taxExemptAppliedId, setTaxExemptAppliedId, taxExemptProfile,
  loyaltyMember, setLoyaltyMember, loyaltyAppliedAmount, setLoyaltyAppliedAmount,
  rewardsConfirmedOnPinpad = false, setRewardsConfirmedOnPinpad,
  setPaymentOpen, setReceiptData, setLastReceipt,
  poleContext, pinpadContext, writeLog, toast, loadData,
}) {
  const [amountTendered, setAmountTendered] = useState("");
  // Tenders applied to the sale in progress. One entry = a normal sale, more = split.
  const [tenders, setTenders] = useState([]);
  const [giftCardMode, setGiftCardMode] = useState(false);
  const [giftCardNumber, setGiftCardNumber] = useState("");
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardError, setGiftCardError] = useState("");
  const [giftCardResult, setGiftCardResult] = useState(null); // { approved: bool, card: {...}, message: string }

  const clearSaleState = () => {
    setCart([]); setPaymentOpen(false); setAmountTendered("");
    setTenders([]); setGiftCardMode(false);
    setTaxExemptAppliedId(""); setLoyaltyMember(null); setLoyaltyAppliedAmount(0);
    setRewardsConfirmedOnPinpad?.(false);
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    const missingSerials = cart.find(i => i.serialized && !(i.serial_numbers && i.serial_numbers.length === i.qty));
    if (missingSerials) {
      toast({ title: "Missing Serial Number", description: `${missingSerials.name} requires a serial number for each unit.`, variant: "destructive" });
      return;
    }
    if (!isSettled(amountDue, tenders)) {
      toast({ title: "Balance Still Due", description: `$${balanceDue(amountDue, tenders).toFixed(2)} remains — apply another tender.`, variant: "destructive" });
      return;
    }
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    // The primary tender is what every existing report reads; the tenders array
    // carries the full split breakdown alongside it.
    const method = primaryTender(tenders);
    const tendered = appliedTotal(tenders);
    const changeDue = changeFrom(amountDue, tenders);
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;
    const receiptBase = {
      txId, operator, registerId, cart, subtotal, tax, total,
      paymentMethod: method, amountTendered: tendered, changeDue, tenders,
      loyaltyAppliedAmount, rewardsEarned, taxExempt: taxExemptProfile,
    };

    // Training mode: simulate the sale without recording anything — no transaction log
    // entry, no stock changes, no register log. Only show a receipt for practice.
    if (trainingMode) {
      const practiceBalance = loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
      const practice = buildReceipt({ ...receiptBase, loyaltyMember, newBalance: practiceBalance });
      toast({ title: "Training Sale Complete", description: `${txId} — Change: $${changeDue.toFixed(2)} (not recorded)` });
      showChangeOnPole(poleContext, { total, change: changeDue });
      setReceiptData(practice);
      setLastReceipt(practice);
      clearSaleState();
      return;
    }

    // Offline: queue the sale on the relay instead of writing to the cloud.
    if (isOffline) {
      if (!tendersAllowed(tenders, offlineTenders)) {
        toast({ title: "Tender Not Available", description: "Only cash and check are permitted while offline.", variant: "destructive" });
        return;
      }
      try {
        await submitOfflineSale({ txId, operator, registerId, cart, subtotal, tax, total, paymentMethod: method, amountTendered: tendered, changeDue, tenders, taxExemptId: taxExemptAppliedId });
      } catch (e) {
        toast({ title: "Sale Not Saved", description: "The local relay rejected the sale. Get a manager.", variant: "destructive" });
        return;
      }
      const offlineReceipt = buildReceipt({ ...receiptBase, loyaltyAppliedAmount: 0, rewardsEarned: 0, loyaltyMember: null });
      toast({ title: "Sale Saved Offline", description: `${txId} — will upload when the connection returns.` });
      showChangeOnPole(poleContext, { total, change: changeDue });
      setReceiptData(offlineReceipt);
      setLastReceipt(offlineReceipt);
      clearSaleState();
      refreshConnectivity();
      return;
    }

    try {
      const newBalance = await commitSaleTransaction({
        txId, operator, registerId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        cart, products, subtotal, tax, total,
        paymentMethod: method, amountTendered: tendered, changeDue, tenders,
        trainingMode, taxExemptId: taxExemptAppliedId,
        loyaltyMember, loyaltyAppliedAmount, rewardsEarned, rewardsConfirmedOnPinpad,
      });
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Change: $${changeDue.toFixed(2)}` });
      writeLog("transaction", `Sale completed — ${cart.length} item(s)`, {
        transaction_id: txId,
        transaction_total: total,
        items: cart.map(item => ({
          sku: item.sku, name: item.name, qty: item.qty, price: item.price, total: item.total,
          tax_rate: item.tax_rate,
          discount_type: item.discount_type || null,
          discount_percentage: item.discount_percentage || 0,
          original_price: item.original_price || item.price,
        })),
      });
      const receipt = buildReceipt({ ...receiptBase, loyaltyMember, newBalance });
      setReceiptData(receipt);
      setLastReceipt(receipt);
      clearSaleState();
      showSaleCompleteOnPole(poleContext, {
        total, change: changeDue,
        savings: saleSavings(cart, loyaltyAppliedAmount), points: rewardsEarned,
      });
      // Rating screen runs on the customer pad while the operator hands over the
      // receipt — it stores itself against the sale and never blocks the lane.
      collectSaleRating(pinpadContext, txId);
      loadData();
    } catch (e) {
      toast({ title: "Unable to Process Sale", description: e?.message || "Failed to process sale", variant: "destructive" });
    }
  };

  // Validate a gift-card tender before completing the sale.
  const validateGiftCardTender = async () => {
    if (!giftCardNumber.trim() || !giftCardAmount.trim()) {
      setGiftCardError("Please enter gift card number and amount");
      return;
    }
    setGiftCardValidating(true);
    setGiftCardError("");
    try {
      const { error, result } = await lookupGiftCardTender(giftCardNumber, giftCardAmount);
      if (error) setGiftCardError(error);
      else setGiftCardResult(result);
    } catch (e) {
      setGiftCardError("Error validating gift card");
    }
    setGiftCardValidating(false);
  };

  const closeGiftCardResult = () => {
    setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount(""); setGiftCardError("");
    setGiftCardMode(false);
    if (giftCardResult?.approved) setPaymentOpen(false);
  };

  // Complete the sale using an approved gift-card tender.
  const completeGiftCardSale = async () => {
    const txId = "TX-" + Date.now().toString(36).toUpperCase();
    const chargeAmount = giftCardResult.chargeAmount;
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const loyaltyPct = storeConfig?.loyalty_points_percentage ?? 5;
    const rewardsEarned = loyaltyMember ? +(subtotal * (loyaltyPct / 100)).toFixed(2) : 0;
    const receiptBase = {
      txId, operator, registerId, cart, subtotal, tax, total,
      paymentMethod: "giftcard", amountTendered: chargeAmount, changeDue: 0,
      tenders: [{ method: "giftcard", amount: chargeAmount, reference: giftCardResult.card.card_number }],
      loyaltyAppliedAmount, rewardsEarned, taxExempt: taxExemptProfile,
    };
    const clearSale = () => {
      clearSaleState();
      setGiftCardResult(null); setGiftCardNumber(""); setGiftCardAmount("");
    };

    // Training mode: no balance deduction, no transaction, no stock change.
    if (trainingMode) {
      const practiceBalance = loyaltyMember ? +(loyaltyMember.rewards_balance - loyaltyAppliedAmount + rewardsEarned).toFixed(2) : null;
      const practice = buildReceipt({ ...receiptBase, loyaltyMember, newBalance: practiceBalance });
      toast({ title: "Training Sale Complete", description: `${txId} — Paid with gift card (not recorded)` });
      setReceiptData(practice);
      setLastReceipt(practice);
      clearSale();
      return;
    }

    try {
      const newBalance = await commitGiftCardSale({
        card: giftCardResult.card, chargeAmount,
        txId, operator, registerId,
        storeId: sessionStorage.getItem("pos_store_id") || "",
        cart, products, subtotal, tax, total,
        trainingMode, taxExemptId: taxExemptAppliedId,
        loyaltyMember, loyaltyAppliedAmount, rewardsEarned, rewardsConfirmedOnPinpad,
      });
      toast({ title: "Sale Complete", description: `Transaction ${txId} — Paid with gift card` });
      writeLog("transaction", `Sale completed — ${cart.length} item(s)`, { transaction_id: txId, transaction_total: total, items: cart });
      const receipt = buildReceipt({ ...receiptBase, loyaltyMember, newBalance });
      setReceiptData(receipt);
      setLastReceipt(receipt);
      clearSale();
      showSaleCompleteOnPole(poleContext, {
        total, change: 0,
        savings: saleSavings(cart, loyaltyAppliedAmount), points: rewardsEarned,
      });
      collectSaleRating(pinpadContext, txId);
      loadData();
    } catch (e) {
      toast({ title: "Unable to Process Sale", description: e?.message || "Failed to process gift card sale", variant: "destructive" });
    }
  };

  return {
    tenders, setTenders, amountTendered, setAmountTendered,
    giftCardMode, setGiftCardMode, giftCardNumber, setGiftCardNumber,
    giftCardAmount, setGiftCardAmount, giftCardError, giftCardValidating, giftCardResult,
    completeSale, validateGiftCardTender, closeGiftCardResult, completeGiftCardSale,
  };
}