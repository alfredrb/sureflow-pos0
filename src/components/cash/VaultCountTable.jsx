import { BILL_DENOMS, COIN_DENOMS } from "@/lib/denominations";

const Row = ({ denom, qty, editable, onQty }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
    <span className="w-24 text-gray-600">{denom.label}</span>
    {editable ? (
      <input
        type="number"
        min="0"
        value={qty}
        onChange={(e) => onQty(parseInt(e.target.value) || 0)}
        className="w-24 border border-gray-300 rounded-md p-1 text-right text-sm"
      />
    ) : (
      <span className="w-24 text-right tabular-nums">{qty}</span>
    )}
    <span className="w-28 text-right font-medium tabular-nums">${(qty * denom.value).toFixed(2)}</span>
  </div>
);

// Bills + coin rolls table for the vault, read-only or in count-adjust mode.
export default function VaultCountTable({ bills = {}, coins = {}, editable, onBills, onCoins }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h3 className="font-semibold text-gray-800 mb-2">Bills</h3>
        <div className="flex justify-between text-xs text-gray-400 pb-1"><span className="w-24">Denom</span><span className="w-24 text-right">Count</span><span className="w-28 text-right">Value</span></div>
        {[...BILL_DENOMS].reverse().map((d) => (
          <Row key={d.key} denom={d} qty={Number(bills[d.key] || 0)} editable={editable} onQty={(v) => onBills({ ...bills, [d.key]: v })} />
        ))}
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 mb-2">Coin Rolls</h3>
        <div className="flex justify-between text-xs text-gray-400 pb-1"><span className="w-24">Roll</span><span className="w-24 text-right">Count</span><span className="w-28 text-right">Value</span></div>
        {COIN_DENOMS.map((d) => (
          <Row key={d.key} denom={{ ...d, label: d.label.replace("QTR", "Quarter").replace("NKL", "Nickel").replace("PNY", "Penny").replace("DIME", "Dime").replace(" ROLL", " Roll") }} qty={Number(coins[d.key] || 0)} editable={editable} onQty={(v) => onCoins({ ...coins, [d.key]: v })} />
        ))}
      </div>
    </div>
  );
}