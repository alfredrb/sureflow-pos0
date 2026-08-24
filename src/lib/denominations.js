// Shared US cash denomination definitions for slips, vault tracking, and
// reconciliation inputs. Bill keys match the objects stored on TillCheckout,
// CashAdvance, CashPickup and StoreVault records.

export const BILL_DENOMS = [
  { key: "one", label: "$1", value: 1 },
  { key: "two", label: "$2", value: 2 },
  { key: "five", label: "$5", value: 5 },
  { key: "ten", label: "$10", value: 10 },
  { key: "twenty", label: "$20", value: 20 },
  { key: "fifty", label: "$50", value: 50 },
  { key: "hundred", label: "$100", value: 100 },
];

export const COIN_DENOMS = [
  { key: "quarters_rolls", label: "QTR ROLL", value: 10 },
  { key: "dimes_rolls", label: "DIME ROLL", value: 5 },
  { key: "nickels_rolls", label: "NKL ROLL", value: 2 },
  { key: "pennies_rolls", label: "PNY ROLL", value: 0.5 },
];

export const billsTotal = (bills = {}) =>
  BILL_DENOMS.reduce((s, d) => s + Number(bills[d.key] || 0) * d.value, 0);

export const coinsTotal = (coins = {}) =>
  COIN_DENOMS.reduce((s, d) => s + Number(coins[d.key] || 0) * d.value, 0);

// Slip "Notes:" block lines (ascending, zeros included like the 4690 slip),
// plus coin-roll lines only when rolls were actually counted.
export function slipDenominations(bills = {}, coins = {}) {
  const lines = BILL_DENOMS.map((d) => ({ qty: Number(bills[d.key] || 0), value: d.value }));
  for (const d of COIN_DENOMS) {
    const qty = Number(coins[d.key] || 0);
    if (qty > 0) lines.push({ qty, value: d.value, label: d.label });
  }
  return lines;
}