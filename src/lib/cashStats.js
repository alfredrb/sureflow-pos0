// Shared totals for the Cash Reconciliation summary tiles and every export format,
// so the printed slip, the CSV and the on-screen figures can never disagree.

const sum = (arr, pick) => arr.reduce((s, x) => s + (pick(x) || 0), 0);

export function computeCashTotals({ deposits = [], advances = [], pickups = [], audits = [], robberies = [], giftCardCashouts = [], tillCheckouts = [], registers = [] }) {
  const checkedOutCount = tillCheckouts.filter((t) => t.status === "checked_out").length;
  const checkedInCount = tillCheckouts.filter((t) => t.status === "checked_in").length;

  return {
    totalDeposits: deposits.length,
    totalExpected: sum(deposits, (d) => d.expected_cash),
    totalDeposited: sum(deposits, (d) => d.actual_cash_deposited),
    totalVariance: sum(deposits, (d) => d.difference),
    shortages: deposits.filter((d) => (d.difference || 0) < 0).length,
    overages: deposits.filter((d) => (d.difference || 0) > 0).length,
    totalAdvances: sum(advances, (a) => a.amount),
    totalPickups: sum(pickups, (p) => p.amount),
    totalAudits: audits.length,
    pendingAudits: audits.filter((a) => a.status === "pending").length,
    totalAuditedAmount: sum(audits, (a) => a.total_counted),
    robberyCount: robberies.length,
    totalStolen: sum(robberies, (r) => r.amount_stolen),
    totalGiftCardCashout: giftCardCashouts.reduce((s, log) => {
      const match = log.detail?.match(/\$(\d+\.\d+)/);
      return s + (match ? parseFloat(match[1]) : 0);
    }, 0),
    checkedOutCount,
    checkedInCount,
    checkedOutExpected: checkedOutCount * 250,
    totalDiscrepancies: tillCheckouts
      .filter((t) => t.status === "checked_in" && t.discrepancy !== undefined)
      .reduce((s, t) => s + t.discrepancy, 0),
    totalRegisters: registers.length,
  };
}