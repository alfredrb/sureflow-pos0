import { BILL_DENOMS, billsTotal } from "@/lib/denominations";

// Compact bill-count grid for cash advance / pickup reconciliation.
export default function DenominationInputs({ bills = {}, onChange }) {
  const total = billsTotal(bills);
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Bills (for reconciliation)</label>
      <div className="grid grid-cols-4 gap-2">
        {BILL_DENOMS.map((d) => (
          <div key={d.key}>
            <label className="text-xs text-gray-500">{d.label}</label>
            <input
              type="number"
              min="0"
              value={bills[d.key] ?? ""}
              placeholder="0"
              onChange={(e) => onChange({ ...bills, [d.key]: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-md p-1.5 text-sm"
            />
          </div>
        ))}
        <div className="flex flex-col justify-end">
          <span className="text-xs text-gray-500">Bill Total</span>
          <span className="font-semibold text-sm tabular-nums py-1.5">${total.toFixed(2)}</span>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">Entering bill counts fills the amount automatically and updates the vault.</p>
    </div>
  );
}