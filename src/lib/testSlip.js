// Action Code 901 — Print Test Slip.
// A technician-facing print pattern that proves the receipt station, the column
// width and the barcode encoder are all working before a lane is signed off.
import { printNoticeSlip } from "@/lib/noticeSlip";

export async function printTestSlip(registerId, operator) {
  const lines = [
    "PRINTER TEST PATTERN",
    "",
    "1234567890123456789012345678901234567890",
    "....|....1....|....2....|....3....|....4",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "!\"#$%&'()*+,-./:;<=>?@[]^_{|}~",
    "",
    `REGISTER   ${registerId || "—"}`,
    `OPERATOR   ${(operator?.full_name || "—").toUpperCase()}`,
    `PRINTED    ${new Date().toLocaleString()}`,
    "",
    "IF ALL 40 COLUMNS ABOVE ARE",
    "STRAIGHT AND THE BARCODE SCANS,",
    "THE RECEIPT STATION IS GOOD.",
  ];
  await printNoticeSlip({ heading: "TEST SLIP", lines, footer: "***NOT A RECEIPT***", barcode: "TEST-PATTERN" }, operator);
}