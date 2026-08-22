// Action Code 154 — Get Till Count.
// Prints what SHOULD be in this lane's drawer right now (opening float plus cash
// taken, less cash paid out) so the operator can count against it mid-shift
// without taking a full register reading.
import { printNoticeSlip } from "@/lib/noticeSlip";
import { buildRegisterReading } from "@/lib/tenderReading";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const row = (label, value) => `${String(label).padEnd(26)}${String(value).padStart(16)}`;

export async function printTillCountSlip(registerId, operator) {
  const r = await buildRegisterReading(registerId);
  const lines = [
    "TILL COUNT",
    "",
    row("REGISTER", r.registerId),
    row("COUNTED BY", (operator?.full_name || "—").toUpperCase().slice(0, 15)),
    "",
    row("OPENING FLOAT", money(r.sod.startingCash)),
    row("CASH TAKEN", money(r.current.byTender.cash || 0)),
    "",
    row("EXPECTED IN DRAWER", money(r.current.expectedDrawer)),
    "",
    row("COUNTED", "______________"),
    row("OVER / SHORT", "______________"),
    "",
    "COUNTED BY  ____________________",
    "WITNESS     ____________________",
    "",
    `PRINTED ${new Date().toLocaleString()}`,
  ];
  await printNoticeSlip({ heading: "TILL COUNT", lines, footer: "***NOT A RECEIPT***" }, operator);
  return r;
}