// Suspend slip printed when a transaction is parked at the register.
// The suspend number prints as a CODE128 barcode so any lane in the store can
// scan it to pull the items back into a cart (4690 "store transaction" style).
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

export async function printSuspendSlip({ suspendId, items, total, itemCount, registerId, operator }) {
  await printNoticeSlip({
    heading: "SUSPENDED SALE",
    barcode: suspendId,
    lines: [
      `SUSPEND #  ${suspendId}`,
      `REGISTER   ${registerId}`,
      `ITEMS      ${itemCount}`,
      `TOTAL      $${Number(total || 0).toFixed(2)}`,
      "",
      ...wrapNotice("Scan this slip at any register in this store to return these items to the sale."),
      "",
      ...wrapNotice("This slip is not a receipt and is not proof of purchase. Unresumed suspends are cancelled at end of day."),
      "",
      ...(items || []).slice(0, 10).map(i => `${i.qty} x ${String(i.name || "").toUpperCase().slice(0, 30)}`),
      ...((items || []).length > 10 ? [`+ ${items.length - 10} MORE ITEM(S)`] : []),
    ],
    footer: "***SUSPENDED — NOT A RECEIPT***",
  }, operator);
}