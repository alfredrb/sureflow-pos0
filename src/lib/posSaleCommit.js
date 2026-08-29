import { base44 } from "@/api/data";
import { recordSerializedSales } from "@/lib/serialUtils";

// Shared shape of every receipt the POS shows/prints after a sale.
export function buildReceipt({
  txId, operator, registerId, cart, subtotal, tax, total,
  paymentMethod, amountTendered, changeDue, tenders = [],
  loyaltyAppliedAmount = 0, rewardsEarned = 0, loyaltyMember = null,
  newBalance = null, taxExempt = null,
}) {
  return {
    transactionId: txId,
    operatorName: operator?.full_name || "",
    registerName: registerId,
    items: cart, subtotal, tax, total,
    paymentMethod,
    amountTendered,
    changeDue,
    tenders,
    rewardsApplied: loyaltyAppliedAmount,
    rewardsEarned,
    loyaltyMember: loyaltyMember
      ? { name: loyaltyMember.name, loyalty_id: loyaltyMember.loyalty_id, rewards_balance: newBalance ?? loyaltyMember.rewards_balance }
      : null,
    newBalance,
    taxExempt,
  };
}

// Decrements on-hand stock for each sold line.
async function decrementStock(cart, products) {
  for (const item of cart) {
    const prod = products.find(p => p.sku === item.sku);
    if (prod) await base44.entities.Product.update(prod.id, { stock_qty: Math.max(0, (prod.stock_qty || 0) - item.qty) });
  }
}

// Applies redeemed + earned rewards to the member record. Returns the new balance.
async function applyLoyalty(loyaltyMember, loyaltyAppliedAmount, rewardsEarned) {
  if (!loyaltyMember) return null;
  try {
    const fresh = await base44.entities.LoyaltyMember.filter({ loyalty_id: loyaltyMember.loyalty_id });
    if (fresh.length === 0) return null;
    const m = fresh[0];
    const nb = +((m.rewards_balance || 0) - loyaltyAppliedAmount + rewardsEarned).toFixed(2);
    await base44.entities.LoyaltyMember.update(m.id, {
      rewards_balance: nb,
      lifetime_points: +((m.lifetime_points || 0) + rewardsEarned).toFixed(2),
    });
    return nb;
  } catch {
    return null;
  }
}

// Writes the sale, stock, serial and loyalty records for a standard tender.
// Returns the member's new rewards balance (or null).
export async function commitSaleTransaction({
  txId, operator, registerId, storeId, cart, products,
  subtotal, tax, total, paymentMethod, amountTendered, changeDue, tenders = [],
  trainingMode = false, taxExemptId = "", loyaltyMember = null,
  loyaltyAppliedAmount = 0, rewardsEarned = 0, giftCardNumber = null,
  rewardsConfirmedOnPinpad = false, selfCheckout = false,
}) {
  await base44.entities.Transaction.create({
    transaction_id: txId,
    operator_id: operator.operator_id,
    operator_name: operator.full_name,
    register_id: registerId,
    items: cart.map(item => ({
      sku: item.sku, name: item.name, qty: item.qty, price: item.price, total: item.total,
      // tax_rate must persist on the sale so refunds can return the tax charged.
      tax_rate: item.tax_rate || 0,
      discount_type: item.discount_type || null,
      discount_percentage: item.discount_percentage || 0,
      original_price: item.original_price || item.price,
      ...(item.serialized ? { serialized: true, serial_numbers: item.serial_numbers } : {}),
    })),
    subtotal, tax, total,
    payment_method: paymentMethod,
    // Full breakdown of a split sale. payment_method above stays the primary
    // tender so existing reports and roll-ups read one value as before.
    // Only the schema's tender fields are stored — a cheque tender also carries
    // account_last4 in memory for the receipt, which must not be persisted.
    tenders: tenders.length
      ? tenders.map((t) => ({ method: t.method, amount: t.amount, ...(t.reference ? { reference: t.reference } : {}) }))
      : [{ method: paymentMethod, amount: amountTendered }],
    split_tender: tenders.length > 1,
    status: "completed",
    amount_tendered: amountTendered,
    change_due: changeDue,
    training_mode: trainingMode,
    ...(giftCardNumber ? { giftcard_number: giftCardNumber } : {}),
    tax_exempt_id: taxExemptId || null,
    loyalty_id: loyaltyMember?.loyalty_id || null,
    loyalty_member_name: loyaltyMember?.name || null,
    rewards_earned: rewardsEarned,
    rewards_applied: loyaltyAppliedAmount,
    // Only true when the customer themselves approved the redemption on the pad.
    rewards_confirmed_on_pinpad: loyaltyAppliedAmount > 0 && rewardsConfirmedOnPinpad,
    // Customer-operated sale at a self-checkout lane — lets reports and LP split
    // SCO volume from cashiered volume on one field.
    ...(selfCheckout ? { self_checkout: true, self_checkout_register_id: registerId } : {}),
  });
  await decrementStock(cart, products);
  try { await recordSerializedSales({ items: cart, transactionId: txId, operator, storeId }); } catch {}
  return applyLoyalty(loyaltyMember, loyaltyAppliedAmount, rewardsEarned);
}

// Validates a gift card tender. Returns { error } or { result } for the confirm dialog.
export async function lookupGiftCardTender(cardNumber, amount) {
  const cards = await base44.entities.GiftCard.filter({ card_number: cardNumber.trim() });
  if (cards.length === 0) return { error: "Gift card not found" };
  const card = cards[0];
  if (card.status !== "active") return { error: "Gift card is not active" };
  const chargeAmount = parseFloat(amount);
  if (!(chargeAmount > 0)) return { error: "Amount must be greater than zero" };
  if (chargeAmount > card.balance) {
    return { result: { approved: false, card, message: `Insufficient balance. Card has $${card.balance.toFixed(2)}, but $${chargeAmount.toFixed(2)} was requested.` } };
  }
  return { result: { approved: true, card, chargeAmount, message: `Payment approved. New balance: $${(card.balance - chargeAmount).toFixed(2)}` } };
}

// Deducts the gift card balance, then writes the sale exactly like any other tender.
export async function commitGiftCardSale({ card, chargeAmount, ...saleArgs }) {
  await base44.entities.GiftCard.update(card.id, { balance: card.balance - chargeAmount });
  return commitSaleTransaction({
    ...saleArgs,
    paymentMethod: "giftcard",
    amountTendered: chargeAmount,
    changeDue: 0,
    giftCardNumber: card.card_number,
  });
}