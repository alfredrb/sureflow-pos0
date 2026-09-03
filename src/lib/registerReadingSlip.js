// Action Code 3 — Register Reading slip.
// Prints one register's SOD opening balances, its live CURRENT tender totals, and
// the consolidated EOD figures, so a CSM can take a reading at any point in the day.
import { printNoticeSlip } from "@/lib/noticeSlip";
import { buildRegisterReading, READING_TENDERS } from "@/lib/tenderReading";
import { laneNumber } from "@/lib/registerLabel";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
// 42-column receipt: label left, amount right.
const row = (label, value) => `${String(label).padEnd(26)}${String(value).padStart(16)}`;

export async function printRegisterReadingSlip(registerId, operator) {
  const r = await buildRegisterReading(registerId);
  const lines = [
    "REGISTER READING",
    "",
    row("REGISTER", laneNumber(r.registerId)),
    row("NAME", (r.register?.name || "—").toUpperCase().slice(0, 15)),
    row("TAKEN BY", (operator?.full_name || "—").toUpperCase().slice(0, 15)),
    "",
    "-- START OF DAY --",
  ];

  if (r.sod.completed) {
    lines.push(row("CASH (TILL START)", money(r.sod.startingCash)));
    if (r.sod.operatorName) lines.push(row("OPENED BY", r.sod.operatorName.toUpperCase().slice(0, 15)));
    // Every other tender starts the day at zero by definition — no float is carried.
    for (const t of READING_TENDERS.filter((t) => t.key !== "cash")) {
      lines.push(row(t.label, money(0)));
    }
  } else {
    lines.push("SOD NOT COMPLETED TODAY");
  }

  lines.push("", "-- CURRENT READING --", row("TRANSACTIONS", r.current.transactions));
  for (const t of READING_TENDERS) {
    lines.push(row(t.label, money(r.current.byTender[t.key] || 0)));
  }
  lines.push(
    row("SALES", money(r.current.sales)),
    row("REFUNDS", money(r.current.refunds)),
    row("NET", money(r.current.net)),
    row("DRAWER EXPECTED", money(r.current.expectedDrawer))
  );

  lines.push("", "-- END OF DAY --");
  if (r.eod.consolidated) {
    lines.push(
      row("TRANSACTIONS", r.eod.transactions),
      row("SALES", money(r.eod.sales)),
      row("REFUNDS", money(r.eod.refunds)),
      row("NET", money(r.eod.net)),
      "",
      "STORE TENDERS (ALL REGISTERS)"
    );
    for (const t of READING_TENDERS) {
      lines.push(row(t.label, money(r.eod.storeByTender[t.key] || 0)));
    }
  } else {
    lines.push("NOT CONSOLIDATED YET", "EOD RUNS AT MIDNIGHT");
  }

  lines.push("", `PRINTED ${new Date().toLocaleString()}`);

  await printNoticeSlip({ heading: "REGISTER READING", lines, footer: "***NOT A RECEIPT***" }, operator);
  return r;
}