// Tender-by-tender reading for one register: what the drawer started with (SOD),
// what has been rung since (CURRENT, live right now), and the consolidated
// end-of-day figures once the midnight roll-up has run (EOD).
//
// Shared by the Action Code 3 slip so the maths lives in one place.

import { base44 } from "@/api/data";

// Order the tenders print in on the slip.
export const READING_TENDERS = [
  { key: "cash", label: "CASH" },
  { key: "credit", label: "CREDIT" },
  { key: "debit", label: "DEBIT" },
  { key: "check", label: "CHECK" },
  { key: "store_credit", label: "STORE CREDIT" },
  { key: "giftcard", label: "GIFT CARD" },
  { key: "rewards", label: "REWARDS" },
];

const today = () => new Date().toISOString().split("T")[0];
const dayOf = (tx) => String(tx.sale_date || tx.created_date || "").split("T")[0];

// Every tender on a sale. Older sales carry only payment_method, so fall back to
// treating the whole total as that one tender.
function tendersOf(tx) {
  if (Array.isArray(tx.tenders) && tx.tenders.length > 0) return tx.tenders;
  return [{ method: tx.payment_method || "cash", amount: tx.total || 0 }];
}

// Matches what the operator keyed against the store's registers: an exact
// register_id wins, otherwise the digits are matched against the tail of each id.
async function resolveRegisterId(entered) {
  const raw = String(entered || "").trim();
  const exact = await base44.entities.Register.filter({ register_id: raw });
  if (exact.length > 0) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;
  const all = await base44.entities.Register.list();
  const hit = all.find((r) => String(r.register_id || "").replace(/\D/g, "") === String(Number(digits)))
    || all.find((r) => String(r.register_id || "").replace(/\D/g, "").endsWith(digits));
  return hit?.register_id || raw;
}

/**
 * Builds the full reading for one register.
 * Returns { registerId, register, sod, current, eod }.
 */
export async function buildRegisterReading(entered) {
  const date = today();
  // The operator keys digits on the numeric pad, so "1" has to find "REG-001".
  const registerId = await resolveRegisterId(entered);
  const [regs, sods, txs, reports] = await Promise.all([
    base44.entities.Register.filter({ register_id: registerId }),
    base44.entities.SODProtocol.filter({ register_id: registerId, protocol_date: date }),
    base44.entities.Transaction.filter({ register_id: registerId }),
    base44.entities.EODReport.filter({ report_date: date }),
  ]);

  const sod = sods.find((s) => s.status === "completed") || sods[0] || null;

  // CURRENT — live running totals for today, voided and training sales excluded.
  const live = txs.filter(
    (t) => dayOf(t) === date && t.status !== "voided" && !t.training_mode
  );
  const byTender = {};
  let sales = 0;
  let refunds = 0;
  for (const tx of live) {
    const isRefund = tx.status === "refunded";
    if (isRefund) refunds += Math.abs(tx.total || 0);
    else sales += tx.total || 0;
    for (const t of tendersOf(tx)) {
      const amt = Number(t.amount || 0) * (isRefund ? -1 : 1);
      byTender[t.method] = (byTender[t.method] || 0) + amt;
    }
  }

  const startingCash = Number(sod?.till_starting_balance || 0);
  const current = {
    started: !!sod,
    transactions: live.length,
    sales,
    refunds,
    net: sales - refunds,
    byTender,
    // What should physically be in the drawer right now.
    expectedDrawer: startingCash + (byTender.cash || 0),
  };

  // EOD — only meaningful once consolidateEOD has written today's report.
  const report = reports[0] || null;
  const line = (report?.register_details || []).find((r) => r.register_id === registerId) || null;
  const eod = report
    ? {
        consolidated: true,
        transactions: line?.transactions || 0,
        sales: line?.revenue || 0,
        refunds: line?.refunds || 0,
        net: (line?.revenue || 0) - (line?.refunds || 0),
        // payment_breakdown is consolidated store-wide, not per register.
        storeByTender: report.payment_breakdown || {},
      }
    : { consolidated: false };

  return {
    registerId,
    register: regs[0] || null,
    sod: { completed: !!sod, startingCash, operatorName: sod?.operator_name || "" },
    current,
    eod,
  };
}