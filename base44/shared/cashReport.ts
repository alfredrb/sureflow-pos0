// Canonical day-scoped cash report used by the midnight consolidation job.
//
// Mirrors src/lib/cashStats.js + src/lib/cashReport.js so the printed midnight copy
// reads exactly like the on-screen Quick Report. The frontend cannot import this
// module (different bundle), so any change to a figure here must be made there too.

const RECEIPT_WIDTH = 42;

const num = (v) => Number(v || 0);
const sum = (arr, pick) => arr.reduce((s, x) => s + num(pick(x)), 0);
const money = (n) => num(n).toFixed(2);
const onDay = (value, day) => !!value && String(value).slice(0, 10) === day;

export function filterDay(rows, field, day) {
  return (rows || []).filter((r) => onDay(r[field], day));
}

export function computeDayTotals({ deposits = [], advances = [], pickups = [], audits = [], robberies = [], giftCardCashouts = [], tillCheckouts = [], day = "" }) {
  const outTills = (tillCheckouts || []).filter((t) => onDay(t.checkout_date, day));
  const inTills = (tillCheckouts || []).filter((t) => t.status === "checked_in" && onDay(t.checkin_date, day));

  return {
    totalDeposits: deposits.length,
    totalExpected: sum(deposits, (d) => d.expected_cash),
    totalDeposited: sum(deposits, (d) => d.actual_cash_deposited),
    totalVariance: sum(deposits, (d) => d.difference),
    shortages: deposits.filter((d) => num(d.difference) < 0).length,
    overages: deposits.filter((d) => num(d.difference) > 0).length,
    totalAdvances: sum(advances, (a) => a.amount),
    totalPickups: sum(pickups, (p) => p.amount),
    totalAudits: audits.length,
    pendingAudits: audits.filter((a) => a.status === "pending").length,
    totalAuditedAmount: sum(audits, (a) => a.total_counted),
    robberyCount: robberies.length,
    totalStolen: sum(robberies, (r) => r.amount_stolen),
    totalGiftCardCashout: (giftCardCashouts || []).reduce((s, log) => {
      const m = String(log.detail || "").match(/\$(\d+\.\d+)/);
      return s + (m ? parseFloat(m[1]) : 0);
    }, 0),
    checkedOutCount: outTills.length,
    checkedInCount: inTills.length,
    checkedOutExpected: sum(outTills, (t) => (t.checkout_total == null ? 250 : t.checkout_total)),
    totalDiscrepancies: sum(inTills, (t) => t.discrepancy),
    day,
  };
}

const row = (label, value) => {
  const v = String(value);
  const l = String(label).slice(0, RECEIPT_WIDTH - v.length - 1);
  return l + " ".repeat(Math.max(1, RECEIPT_WIDTH - l.length - v.length)) + v;
};

const signed = (n) => (num(n) >= 0 ? "+" : "-") + "$" + money(Math.abs(num(n)));

// 42-column body shared by the printed slip and the archived snapshot text.
export function buildReportLines(t, storeName = "") {
  return [
    storeName ? storeName.toUpperCase() : "",
    "FOR " + t.day,
    "=".repeat(RECEIPT_WIDTH),
    row("DEPOSITS", String(t.totalDeposits)),
    row("EXPECTED TOTAL", "$" + money(t.totalExpected)),
    row("DEPOSITED TOTAL", "$" + money(t.totalDeposited)),
    row("VARIANCE", signed(t.totalVariance)),
    row("SHORTAGES / OVERAGES", t.shortages + " / " + t.overages),
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
    row("TILLS CHECKED IN", t.checkedInCount + " / " + t.checkedOutCount),
    row("TILL DISCREPANCIES", signed(t.totalDiscrepancies)),
    "",
    row("ROBBERIES", String(t.robberyCount)),
    row("AMOUNT STOLEN", "$" + money(t.totalStolen)),
    "=".repeat(RECEIPT_WIDTH),
  ].filter((l) => l !== null);
}

export function buildReportText(t, storeName = "") {
  return ["CASH RECONCILIATION DAILY REPORT", ...buildReportLines(t, storeName)].join("\n");
}