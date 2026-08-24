// Prints the Quick Report on the store's receipt printer.
//
// Rides the existing admin print pipeline (adminPrint -> relay -> printer_ip) as a
// 4690-style notice slip, and uses the same per-register detail layout the midnight
// auto-print uses, so what a manager prints by hand matches the nightly copy.
import { adminPrintReceipt, getAdminPrintContext } from "@/lib/adminPrint";
import { buildDetailLines, row, signed, WIDTH } from "@/lib/cashReportDetail";

const money = (n) => Number(n || 0).toFixed(2);

export function buildQuickReportLines(t, records = null) {
  return [
    "FOR " + (t.day || ""),
    "=".repeat(WIDTH),
    ...(records ? buildDetailLines(records) : []),
    ...(records ? ["STORE TOTALS", "=".repeat(WIDTH)] : []),
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

export async function printQuickReport(totals, records = null, operatorName = "ADMIN") {
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
      lines: buildQuickReportLines(totals, records),
      footer: "***DAILY CASH REPORT***",
    },
    storeNumber: ctx.storeInfo?.store_number,
  });
}