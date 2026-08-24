import { LOOSE_COIN_DENOMS, coinsTotal } from "@/lib/denominations";

const LABELS = { quarters: "Quarters", dimes: "Dimes", nickels: "Nickels", pennies: "Pennies" };

// Loose (unrolled) coin counts — the cup change that comes off a drawer or lane.
export default function LooseCoinInputs({ coins = {}, onChange, title = "Loose Coin" }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{title}</label>
        <span className="text-sm text-gray-500">${coinsTotal(coins).toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LOOSE_COIN_DENOMS.map((d) => (
          <div key={d.key}>
            <span className="text-xs text-gray-500">{LABELS[d.key]}</span>
            <input
              type="number"
              min="0"
              value={coins[d.key] ?? ""}
              onChange={(e) => onChange({ ...coins, [d.key]: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}