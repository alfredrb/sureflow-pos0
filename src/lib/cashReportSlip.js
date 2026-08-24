// Prints the Quick Report on the store's receipt printer.
//
// Rides the existing admin print pipeline (adminPrint -> relay -> printer_ip) as a
// 4690-style notice slip, which is the same paper and printer the midnight
// auto-print uses, so what a manager prints by hand matches the nightly copy.
import { adminPrintReceipt, getAdminPrintContext } from "@/lib/adminPrint";

const WIDTH = 42;
const money = (n) => Number(n || 0).toFixed(2);
const signed = (n) => (Number(n) >= 0 ? "+" : "-") + "$" + money(Math.abs(Number(n) || 0));

// Label left, value right, padded to the full receipt width so the printer's
// centred notice block still lines the columns up.
const row = (label, value) => {
  const v = String(value);
  const l = String(label).slice(0, WIDTH - v.length - 1);
  return l + " ".repeat(Math.max(1, WIDTH - l.length - v.length)) + v;
};

export function buildQuickReportLines(t) {
  return [
    "FOR " + (t.day || ""),
    "=".repeat(WIDTH),
    row("DEPOSITS", String(t.totalDeposits)),
    row("EXPECTED TOTAL", "$" + money(t.totalExpected)),
    row("DEPOSITED TOTAL", "$" + money(t.totalDeposited)),
    row("VARIANCE", signed(t.totalVariance)),
    row("SHORTAGES / OVERAGES", `${t.shortages} / ${t.overages}`),
    "",
    row("CASH ADVANCES", "$" + money(t.totalAdvances)),
    row("CASH PICKUPS", "$" + money(t.totalPickups)),
    row("GIFT CARD CASHOUTS", "$" + money(t.totalGiftCardCashout)),
    "",
    row("AUDITS", String(t.totalAudits)),
    row("PENDING AUDITS", String(t.pendingAudits)),
    row("AUDITED AMOUNT", "$" + money(t.totalAuditedAmount)),
    "",
    row("TILLS CHECKED OUT", String(t.checkedOutCount)),
    row("CHECKED OUT EXPECTED", "$" + money(t.checkedOutExpected)),
    row("TILLS CHECKED IN", `${t.checkedInCount} / ${t.checkedOutCount}`),
    row("TILL DISCREPANCIES", signed(t.totalDiscrepancies)),
    "",
    row("ROBBERIES", String(t.robberyCount)),
    row("AMOUNT STOLEN", "$" + money(t.totalStolen)),
    "=".repeat(WIDTH),
  ];
}

export async function printQuickReport(totals, operatorName = "ADMIN") {
  const ctx = await getAdminPrintContext();
  return adminPrintReceipt({
    docType: "notice",
    transactionId: "",
    openDrawer: false,
    operatorName,
    registerId: "ADMIN",
    registerName: "ADMIN",
    notice: {
      heading: "CASH REPORT",
      lines: buildQuickReportLines(totals),
      footer: "***DAILY CASH REPORT***",
    },
    storeNumber: ctx.storeInfo?.store_number,
  });
}