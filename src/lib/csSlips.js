// Customer Service desk slips. Every slip goes through the shared notice-slip
// pipeline (relay ESC/POS, browser fallback), so they print on the same station
// as the lane's other operator slips.

import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";
import { GC_TX_LABELS } from "@/lib/csGiftCards";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const stamp = (d) => new Date(d || Date.now()).toLocaleString();

export function printGiftCardReloadSlip({ card_number, added, balance }, operator) {
  return printNoticeSlip({
    heading: "GIFT CARD RELOAD",
    lines: [`CARD ${card_number}`, "", `VALUE ADDED  ${money(added)}`, `NEW BALANCE  ${money(balance)}`, "", "Keep this slip as your receipt."],
    footer: "***GIFT CARD RELOAD***",
  }, operator);
}

export function printGiftCardReissueSlip({ old_number, new_number, balance, reason }, operator) {
  return printNoticeSlip({
    heading: "GIFT CARD REISSUE",
    lines: [
      `OLD CARD ${old_number}`,
      "DEACTIVATED — CANNOT BE USED",
      "",
      `NEW CARD ${new_number}`,
      `BALANCE  ${money(balance)}`,
      "",
      ...wrapNotice(reason || "Reported lost or stolen"),
    ],
    footer: "***REPLACEMENT CARD ISSUED***",
    barcode: new_number,
  }, operator);
}

export function printGiftCardHistorySlip(card, operator) {
  const rows = (card.transactions || []).slice(-12).map((t) =>
    `${new Date(t.transaction_date).toLocaleDateString()} ${(GC_TX_LABELS[t.type] || t.type).toUpperCase()} ${money(t.amount)}`);
  return printNoticeSlip({
    heading: "GIFT CARD HISTORY",
    lines: [`CARD ${card.card_number}`, `BALANCE ${money(card.balance)}`, `STATUS ${String(card.status || "").toUpperCase()}`, "", ...(rows.length ? rows : ["NO ACTIVITY RECORDED"])],
    footer: "***CARD HISTORY***",
  }, operator);
}

export function printCheckCashingSlip({ check_number, account_last4, amount, customer_name, fee = 0 }, operator) {
  return printNoticeSlip({
    heading: "CHECK CASHED",
    lines: [
      `CHECK # ${check_number}`,
      `ACCOUNT ***${account_last4 || ""}`,
      customer_name ? `WRITER ${String(customer_name).toUpperCase()}` : "",
      "",
      `CHECK AMOUNT ${money(amount)}`,
      fee > 0 ? `SERVICE FEE  ${money(fee)}` : "",
      `CASH PAID    ${money(Number(amount || 0) - Number(fee || 0))}`,
      "",
      "CUSTOMER X______________________",
      "OPERATOR X______________________",
    ].filter(Boolean),
    footer: "***CHECK CASHING RECORD***",
  }, operator);
}

export function printPriceMatchSlip({ item_name, sku, was, now, competitor }, operator) {
  return printNoticeSlip({
    heading: "PRICE MATCH",
    lines: [
      String(item_name || "").toUpperCase(),
      `SKU ${sku || ""}`,
      "",
      `OUR PRICE     ${money(was)}`,
      `MATCHED PRICE ${money(now)}`,
      `YOU SAVE      ${money(Number(was || 0) - Number(now || 0))}`,
      "",
      ...wrapNotice(competitor ? `Competitor: ${competitor}` : ""),
    ],
    footer: "***PRICE MATCH APPLIED***",
  }, operator);
}

export function printGiftReceiptSlip(receipt, operator) {
  const items = (receipt?.items || []).map((i) => `${i.qty} X ${String(i.name || "").toUpperCase()}`);
  return printNoticeSlip({
    heading: "GIFT RECEIPT",
    lines: [
      ...(items.length ? items : ["NO ITEMS ON RECORD"]),
      "",
      "PRICES INTENTIONALLY OMITTED",
      "Returnable with this gift receipt.",
      "",
      stamp(receipt?.date),
    ],
    footer: "***GIFT RECEIPT***",
    barcode: receipt?.transactionId || "",
  }, operator);
}

export function printRainCheckSlip(rc, operator) {
  return printNoticeSlip({
    heading: "RAIN CHECK",
    lines: [
      String(rc.item_name || "").toUpperCase(),
      rc.sku ? `SKU ${rc.sku}` : "",
      "",
      `GUARANTEED PRICE ${money(rc.advertised_price)}`,
      `QUANTITY         ${rc.quantity}`,
      rc.expires_on ? `REDEEM BY        ${rc.expires_on}` : "",
      rc.customer_name ? `FOR ${String(rc.customer_name).toUpperCase()}` : "",
      "",
      "Present this slip when the item is back in stock.",
    ].filter(Boolean),
    footer: "***RAIN CHECK***",
    barcode: rc.rain_check_id,
  }, operator);
}