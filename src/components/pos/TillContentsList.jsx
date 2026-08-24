import React from "react";

// The standard store float. Used when no TillCheckout record exists for the register.
export const STANDARD_TILL = {
  bills: { twenty: 5, ten: 5, five: 10, one: 40 },
  coins: { quarters_rolls: 2, dimes_rolls: 1, nickels_rolls: 1, pennies_rolls: 2 },
  total: 250,
};

const BILLS = [
  { key: "hundred", label: "$100 Bills", value: 100 },
  { key: "twenty", label: "$20 Bills", value: 20 },
  { key: "ten", label: "$10 Bills", value: 10 },
  { key: "five", label: "$5 Bills", value: 5 },
  { key: "one", label: "$1 Bills", value: 1 },
];

const COINS = [
  { key: "quarters_rolls", label: "Rolls of Quarters", value: 10 },
  { key: "dimes_rolls", label: "Rolls of Dimes", value: 5 },
  { key: "nickels_rolls", label: "Rolls of Nickels", value: 2 },
  { key: "pennies_rolls", label: "Rolls of Pennies", value: 0.5 },
];

// Read-only breakdown of the cash to load into the drawer.
export default function TillContentsList({ bills, coins, total }) {
  const b = bills || STANDARD_TILL.bills;
  const c = coins || STANDARD_TILL.coins;
  const rows = [
    ...BILLS.map(x => ({ ...x, qty: b[x.key] || 0 })),
    ...COINS.map(x => ({ ...x, qty: c[x.key] || 0 })),
  ].filter(r => r.qty > 0);

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-sm font-semibold text-gray-800">Till Contents</p>
      <div className="space-y-1 text-sm text-gray-700">
        {rows.map(r => (
          <div key={r.key} className="flex justify-between tabular-nums">
            <span>{r.qty} × {r.label}</span>
            <span>${(r.qty * r.value).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-sm font-bold text-gray-900 tabular-nums">
        <span>Starting Balance</span>
        <span>${Number(total || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}