import { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/data";
import { groupByRegister, buildReportText, buildReportCsv, downloadFile } from "@/lib/cashReport";
import { computeCashTotals } from "@/lib/cashStats";
import { scopeToDay, todayStr } from "@/lib/cashDay";
import { printQuickReport } from "@/lib/cashReportSlip";
import QuickReportTiles from "@/components/cash/QuickReportTiles";
import QuickReportActions from "@/components/cash/QuickReportActions";

export default function CashQuickReportTab({ records, onToast }) {
  const today = todayStr();
  const [day, setDay] = useState(today);
  const [snapshot, setSnapshot] = useState(null);

  // A past day is read from its midnight archive when one exists, so an edited or
  // purged record can never rewrite history.
  useEffect(() => {
    let alive = true;
    if (day === today) { setSnapshot(null); return; }
    base44.entities.CashReportSnapshot.filter({ report_date: day }).then((rows) => {
      if (alive) setSnapshot(rows[0]?.totals ? rows[0] : null);
    });
    return () => { alive = false; };
  }, [day, today]);

  const dayRecords = useMemo(() => scopeToDay(records, day), [records, day]);
  const liveTotals = useMemo(() => computeCashTotals({ ...dayRecords, day }), [dayRecords, day]);
  const totals = snapshot ? { ...snapshot.totals, day } : liveTotals;

  const groups = () => groupByRegister(dayRecords);

  const exportText = () => {
    downloadFile(buildReportText(groups(), totals), `cash_report_${day}.txt`, "text/plain");
    onToast({ title: "Report exported as TXT" });
  };

  const exportCsv = () => {
    downloadFile(buildReportCsv(groups(), totals), `cash_report_${day}.csv`, "text/csv");
    onToast({ title: "Report exported as CSV" });
  };

  const printWindow = () => {
    const report = buildReportText(groups(), totals);
    const w = window.open("", "", "width=600,height=700");
    w.document.write(`<pre style="font-family: monospace; margin: 20px; font-size: 11px; line-height: 1.5;">${report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`);
    w.document.close();
    w.print();
  };

  const printReceipt = async () => {
    try {
      await printQuickReport(totals);
      onToast({ title: "Report sent to the receipt printer" });
    } catch (e) {
      onToast({ title: "Receipt printer unavailable", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <QuickReportTiles totals={totals} />
      <QuickReportActions
        day={day}
        today={today}
        archived={!!snapshot}
        onChangeDay={setDay}
        onText={exportText}
        onCsv={exportCsv}
        onPrintWindow={printWindow}
        onPrintReceipt={printReceipt}
      />
    </div>
  );
}