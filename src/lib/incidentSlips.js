// Non-sale incident slips printed at the lane: recalled-item notices and
// robbery / emergency incident records.
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

// Prints when a recalled item is scanned — the slip goes to the manager with the item.
export async function printRecallSlip(product, operator) {
  await printNoticeSlip({
    heading: "ITEM RECALLED",
    lines: [
      ...wrapNotice(String(product.name || "").toUpperCase()),
      `SKU ${product.sku || ""}`,
      "",
      ...wrapNotice("This item has been recalled and cannot be sold. Give the item to a manager with this slip attached."),
      ...(product.recall_reason ? ["", "REASON", ...wrapNotice(product.recall_reason)] : []),
      "",
      "MANAGER X" + "_".repeat(25),
    ],
    footer: "***DO NOT SELL — REMOVE FROM FLOOR***",
  }, operator);
}

// Prints after a robbery report is confirmed — timestamped record for the incident file.
export async function printRobberySlip({ amount, registerId, operator }) {
  await printNoticeSlip({
    heading: "INCIDENT REPORT",
    lines: [
      "ROBBERY REPORTED",
      "",
      `REGISTER   ${registerId || ""}`,
      `OPERATOR   ${String(operator?.full_name || "").toUpperCase()}`,
      `REPORTED   ${new Date().toLocaleString()}`,
      `AMOUNT     $${Number(amount || 0).toFixed(2)}`,
      "",
      ...wrapNotice("Register has been paused for security. Amount shown is the calculated expected cash at time of report."),
      "",
      "OPERATOR X" + "_".repeat(24),
      "MANAGER  X" + "_".repeat(24),
    ],
    footer: "***RETAIN FOR INCIDENT FILE***",
  }, operator);
}