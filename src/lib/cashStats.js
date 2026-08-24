// Shared totals for the Cash Reconciliation summary tiles and every export format,
// so the printed slip, the CSV and the on-screen figures can never disagree.
//
// `day` (YYYY-MM-DD) scopes the till figures. Without it the till counts read the
// whole history, which is how "Tills Checked In" ended up showing 326 against the
// 5 registers that happen to exist today.
import { checkedOutOnDay, checkedInOnDay } from "@/lib/cashDay";

const sum = (arr, pick) => arr.reduce((s, x) => s + (pick(x) || 0), 0);

export function computeCashTotals({ deposits = [], advances = [], pickups = [], audits = [], robberies = [], giftCardCashouts = [], tillCheckouts = [], registers = [], day = null }) {
  const outTills = day ? checkedOutOnDay(tillCheckouts, day) : tillCheckouts.filter((t) => t.status === "checked_out");
  const inTills = day ? checkedInOnDay(tillCheckouts, day) : tillCheckouts.filter((t) => t.status === "checked_in");

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
    checkedOutCount: outTills.length,
    // Checked in is measured against the tills that actually went out that day —
    // a store can only bring back what it pulled, never "one per register".
    checkedInCount: inTills.length,
    checkedOutExpected: sum(outTills, (t) => t.checkout_total ?? 250),
    totalDiscrepancies: sum(inTills, (t) => t.discrepancy),
    totalRegisters: registers.length,
    day,
  };
}