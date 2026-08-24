import { TrendingDown, TrendingUp } from "lucide-react";

const stats = (list) => ({
  totalExpected: list.reduce((s, d) => s + (d.expected_cash || 0), 0),
  totalDeposited: list.reduce((s, d) => s + (d.actual_cash_deposited || 0), 0),
  totalDiff: list.reduce((s, d) => s + (d.difference || 0), 0),
  longs: list.filter((d) => (d.difference || 0) > 0).length,
  shorts: list.filter((d) => (d.difference || 0) < 0).length,
});

export default function CashDepositsTab({ deposits, selectedDate, onSelectDate, renderPushBtn }) {
  const grouped = {};
  deposits.forEach((d) => {
    if (!grouped[d.report_date]) grouped[d.report_date] = [];
    grouped[d.report_date].push(d);
  });
  const dates = Object.keys(grouped).sort().reverse();

  if (dates.length === 0) {
    return <div className="text-center py-12 text-gray-500">No cash deposits found</div>;
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const list = grouped[date];
        const s = stats(list);
        const isOver = s.totalDiff > 0;
        return (
          <div key={date}>
            <div
              className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:bg-blue-100 transition"
              onClick={() => onSelectDate(selectedDate === date ? null : date)}
            >
              <div className="grid grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase">Date</p>
                  <p className="text-lg font-bold text-gray-900">{new Date(date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Expected</p>
                  <p className="text-lg font-bold text-gray-900">${s.totalExpected.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Deposited</p>
                  <p className="text-lg font-bold text-gray-900">${s.totalDeposited.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Variance</p>
                  <p className={`text-lg font-bold ${isOver ? "text-green-600" : "text-red-600"}`}>
                    {isOver ? "+" : ""}{s.totalDiff.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase">Registers</p>
                  <p className="text-lg font-bold text-gray-900">
                    {s.longs > 0 ? `+${s.longs}` : ""} {s.shorts > 0 ? `-${s.shorts}` : ""}
                  </p>
                </div>
              </div>
            </div>

            {selectedDate === date && (
              <div className="bg-white border border-gray-200 rounded-lg mt-2 p-4 space-y-3">
                {list.map((deposit) => {
                  const diff = deposit.difference || 0;
                  const isLong = diff > 0;
                  return (
                    <div key={deposit.id} className={`p-3 rounded border-l-4 ${isLong ? "bg-green-50 border-green-500" : "bg-red-50 border-red-500"}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{deposit.register_name} - {deposit.operator_name}</p>
                          <p className="text-xs text-gray-600">{deposit.operator_id}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${isLong ? "text-green-600" : "text-red-600"}`}>
                            {isLong ? <TrendingUp className="w-5 h-5 inline mr-1" /> : <TrendingDown className="w-5 h-5 inline mr-1" />}
                            {isLong ? "+" : ""}{diff.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-600">
                            Expected: ${deposit.expected_cash?.toFixed(2) || "0.00"} → Deposited: ${deposit.actual_cash_deposited?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                      </div>
                      {deposit.notes && <p className="text-xs text-gray-600 mt-2 italic">Note: {deposit.notes}</p>}
                      {diff !== 0 && <div className="flex justify-end mt-2">{renderPushBtn(deposit, "deposit")}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}