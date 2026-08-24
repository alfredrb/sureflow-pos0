const NumField = ({ label, value, onChange }) => (
  <div>
    <label className="text-sm text-gray-600">{label}</label>
    <input
      type="number"
      min="0"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      className="w-full border border-gray-300 rounded-md p-2"
    />
  </div>
);

// Bills and coin rolls returned at check-in.
export default function TillCountInputs({ bills, coins, onBills, onCoins }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <h3 className="font-semibold mb-3 text-gray-800">Bills Returned</h3>
        <div className="space-y-2">
          <NumField label="$20 Bills" value={bills.twenty} onChange={(v) => onBills({ ...bills, twenty: v })} />
          <NumField label="$10 Bills" value={bills.ten} onChange={(v) => onBills({ ...bills, ten: v })} />
          <NumField label="$5 Bills" value={bills.five} onChange={(v) => onBills({ ...bills, five: v })} />
          <NumField label="$1 Bills" value={bills.one} onChange={(v) => onBills({ ...bills, one: v })} />
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3 text-gray-800">Coin Rolls Returned</h3>
        <div className="space-y-2">
          <NumField label="Quarter Rolls" value={coins.quarters_rolls} onChange={(v) => onCoins({ ...coins, quarters_rolls: v })} />
          <NumField label="Dime Rolls" value={coins.dimes_rolls} onChange={(v) => onCoins({ ...coins, dimes_rolls: v })} />
          <NumField label="Nickel Rolls" value={coins.nickels_rolls} onChange={(v) => onCoins({ ...coins, nickels_rolls: v })} />
          <NumField label="Penny Rolls" value={coins.pennies_rolls} onChange={(v) => onCoins({ ...coins, pennies_rolls: v })} />
        </div>
      </div>
    </div>
  );
}