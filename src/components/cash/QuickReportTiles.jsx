const Tile = ({ label, value, border = "border-gray-100", color = "text-gray-900" }) => (
  <div className={`bg-white rounded-lg p-4 border ${border}`}>
    <p className="text-gray-500 text-xs font-medium">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const signed = (n) => `${Number(n) >= 0 ? "+" : "−"}$${Math.abs(Number(n) || 0).toFixed(2)}`;

export default function QuickReportTiles({ totals: t }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Tile label="Total Deposits" value={t.totalDeposits} />
      <Tile label="Expected Total" value={money(t.totalExpected)} />
      <Tile label="Deposited Total" value={money(t.totalDeposited)} />
      <Tile
        label="Total Variance"
        value={signed(t.totalVariance)}
        border={t.totalVariance < 0 ? "border-red-200" : "border-green-200"}
        color={t.totalVariance < 0 ? "text-red-600" : "text-green-600"}
      />
      <Tile label="Shortages" value={t.shortages} border="border-red-100" color="text-red-600" />
      <Tile label="Overages" value={t.overages} border="border-green-100" color="text-green-600" />
      <Tile label="Total Advances" value={money(t.totalAdvances)} border="border-blue-100" color="text-blue-600" />
      <Tile label="Total Pickups" value={money(t.totalPickups)} border="border-amber-100" color="text-amber-600" />
      <Tile label="Total Audits" value={t.totalAudits} border="border-green-100" color="text-green-600" />
      <Tile label="Pending Audits" value={t.pendingAudits} border="border-yellow-100" color="text-yellow-600" />
      <Tile label="Audited Amount" value={money(t.totalAuditedAmount)} border="border-purple-100" color="text-purple-600" />
      <Tile label="Gift Card Cashouts" value={money(t.totalGiftCardCashout)} border="border-rose-100" color="text-rose-600" />
      <Tile label="Tills Checked Out" value={t.checkedOutCount} border="border-blue-100" color="text-blue-600" />
      <Tile label="Checked Out Expected Total" value={money(t.checkedOutExpected)} border="border-cyan-100" color="text-cyan-600" />
      <Tile
        label="Tills Checked In"
        value={`${t.checkedInCount} / ${t.checkedOutCount}`}
        border="border-green-100"
        color="text-green-600"
      />
      <Tile
        label="Till Discrepancies Total"
        value={signed(t.totalDiscrepancies)}
        border={t.totalDiscrepancies < 0 ? "border-red-100" : "border-orange-100"}
        color={t.totalDiscrepancies < 0 ? "text-red-600" : "text-orange-600"}
      />
    </div>
  );
}