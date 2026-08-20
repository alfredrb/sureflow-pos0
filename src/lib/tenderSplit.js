// Split-tender math and tender metadata.
//
// 4690 model: the operator keys an amount (or nothing) and presses a tender key.
// The key COMMITS that tender. A blank amount means "the whole balance due", so a
// single-tender sale stays one keystroke. Applying less than the balance simply
// leaves the sale open with a new balance — that is split tender, with no extra
// prompt anywhere.

export const TENDER_OPTIONS = [
  { m: "cash", label: "Cash" },
  { m: "credit", label: "Credit" },
  { m: "debit", label: "Debit" },
  { m: "check", label: "Check" },
  { m: "store_credit", label: "Store Credit" },
];

export const tenderLabel = (m) =>
  TENDER_OPTIONS.find((t) => t.m === m)?.label || String(m || "").replace("_", " ");

const round = (n) => +Number(n || 0).toFixed(2);

export const appliedTotal = (tenders = []) =>
  round(tenders.reduce((s, t) => s + Number(t.amount || 0), 0));

// The amount due is always compared at cent precision — the raw total carries
// sub-cent float dust, which otherwise turns exact change into a 1¢ discrepancy.
// What is still owed. Never negative — an overpayment is change, not a balance.
export const balanceDue = (amountDue, tenders = []) =>
  Math.max(0, round(round(amountDue) - appliedTotal(tenders)));

// Cash is the only tender the customer can overpay, so it is the only source of change.
export const changeFrom = (amountDue, tenders = []) =>
  Math.max(0, round(appliedTotal(tenders) - round(amountDue)));

export const canOverTender = (m) => m === "cash";

export const isSettled = (amountDue, tenders = []) =>
  tenders.length > 0 && appliedTotal(tenders) >= round(Number(amountDue || 0));

// Resolve the amount a tender key should commit. Blank buffer = full balance.
// Only cash may exceed the balance; everything else is capped at what is owed.
export function resolveTenderAmount(method, keyed, amountDue, tenders = []) {
  const balance = balanceDue(amountDue, tenders);
  const entered = parseFloat(keyed);
  if (!keyed || isNaN(entered)) return balance;
  if (entered <= 0) return 0;
  return canOverTender(method) ? round(entered) : round(Math.min(entered, balance));
}

// The single tender recorded on Transaction.payment_method, so every existing
// report, EOD roll-up and the cash-void path keep working unchanged. The largest
// tender wins; ties fall to the one applied first.
export function primaryTender(tenders = []) {
  if (!tenders.length) return "cash";
  return tenders.reduce((best, t) => (Number(t.amount || 0) > Number(best.amount || 0) ? t : best)).method;
}

// A sale is only allowed offline if every tender on it is offline-safe.
export const tendersAllowed = (tenders = [], allowed = null) =>
  !allowed || tenders.every((t) => allowed.includes(t.method));