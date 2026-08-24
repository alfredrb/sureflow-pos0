import { Button } from "@/components/ui/button";
import { Download, FileText, Printer } from "lucide-react";
import { groupByRegister, buildReportText, buildReportCsv, downloadFile } from "@/lib/cashReport";

const Tile = ({ label, value, border = "border-gray-100", color = "text-gray-900" }) => (
  <div className={`bg-white rounded-lg p-4 border ${border}`}>
    <p className="text-gray-500 text-xs font-medium">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const money = (n) => `$${n.toFixed(2)}`;
const signed = (n) => `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;

export default function CashQuickReportTab({ records, totals, onToast }) {
  const t = totals;
  const groups = () => groupByRegister(records);
  const stamp = new Date().toISOString().split("T")[0];

  const exportText = () => {
    downloadFile(buildReportText(groups(), t), `cash_report_${stamp}.txt`, "text/plain");
    onToast({ title: "Report exported as TXT" });
  };

  const exportCsv = () => {
    downloadFile(buildReportCsv(groups(), t), `cash_report_${stamp}.csv`, "text/csv");
    onToast({ title: "Report exported as CSV" });
  };

  const printSlip = () => {
    const report = buildReportText(groups(), t);
    const w = window.open("", "", "width=600,height=700");
    w.document.write(`<pre style="font-family: monospace; margin: 20px; font-size: 11px; line-height: 1.5;">${report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Total Deposits" value={t.totalDeposits} />
        <Tile label="Expected Total" value={money(t.totalExpected)} />
        <Tile label="Deposited Total" value={money(t.totalDeposited)} />
        <Tile
          label="Total Variance"
          value={`${t.totalVariance < 0 ? "−" : "+"}$${Math.abs(t.totalVariance).toFixed(2)}`}
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
        <Tile label="Tills Checked Out" value={`${t.checkedOutCount} / ${t.totalRegisters}`} border="border-blue-100" color="text-blue-600" />
        <Tile label="Checked Out Expected Total" value={money(t.checkedOutExpected)} border="border-cyan-100" color="text-cyan-600" />
        <Tile label="Tills Checked In" value={`${t.checkedInCount} / ${t.totalRegisters}`} border="border-green-100" color="text-green-600" />
        <Tile
          label="Till Discrepancies Total"
          value={signed(t.totalDiscrepancies)}
          border={t.totalDiscrepancies < 0 ? "border-red-100" : "border-orange-100"}
          color={t.totalDiscrepancies < 0 ? "text-red-600" : "text-orange-600"}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg text-gray-900">Generate &amp; Export Report</h3>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={exportText} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <FileText className="w-4 h-4" /> Text
            </Button>
            <Button onClick={exportCsv} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
            <Button onClick={printSlip} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
              <Printer className="w-4 h-4" /> Print Slip
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}