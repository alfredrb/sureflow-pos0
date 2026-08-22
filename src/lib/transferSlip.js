// Barcoded slip printed when a sale is transferred off a lane (Action Code 850).
// The receiving lane scans the barcode on Action Code 851 to pull the sale over.
import { printNoticeSlip } from "@/lib/noticeSlip";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const row = (label, value) => `${String(label).padEnd(26)}${String(value).padStart(16)}`;

export async function printTransferSlip({ transferId, items, total, itemCount, registerId, operator }) {
  const lines = [
    "SALE TRANSFERRED OUT",
    "",
    row("TRANSFER", transferId),
    row("FROM REGISTER", registerId),
    row("OPERATOR", (operator?.full_name || "—").toUpperCase().slice(0, 15)),
    row("ITEMS", itemCount),
    row("TOTAL", money(total)),
    "",
    "-- ITEMS --",
    ...items.map((i) => row(`${i.qty} x ${String(i.name).slice(0, 18)}`, money(i.total))),
    "",
    "SCAN THIS SLIP AT THE",
    "RECEIVING LANE, OR KEY THE",
    "TRANSFER NUMBER ON AC 851.",
    "",
    `PRINTED ${new Date().toLocaleString()}`,
  ];
  await printNoticeSlip({ heading: "TRANSACTION TRANSFER", lines, footer: "***NOT A RECEIPT***", barcode: transferId }, operator);
}