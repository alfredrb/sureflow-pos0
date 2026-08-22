// Store-wide end-of-day summary, mirrored onto the lane's customer pinpad and
// printed for the record. A closing CSM can verify the day standing at the lane
// instead of walking to the back office.
//
// The pad call is deliberately best-effort: a lane with no pad, an unsupported
// profile, or an unreachable pad simply prints and says nothing.
import { base44 } from "@/api/data";
import { promptOnPinpad } from "@/lib/pinpadFlow";
import { printNoticeSlip } from "@/lib/noticeSlip";
import { READING_TENDERS } from "@/lib/tenderReading";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const row = (label, value) => `${String(label).padEnd(26)}${String(value).padStart(16)}`;
// The pad's display is narrower than the receipt.
const padRow = (label, value) => `${String(label).padEnd(14)}${String(value).padStart(12)}`;

/**
 * Reads today's consolidated EOD report, shows it on the pad and prints it.
 * Returns the report, or null when the day has not been consolidated yet.
 */
export async function showEodSummary(pinpadContext, operator) {
  const date = new Date().toISOString().split("T")[0];
  const reports = await base44.entities.EODReport.filter({ report_date: date });
  const report = reports[0];
  if (!report) return null;

  const tenders = READING_TENDERS.filter((t) => (report.payment_breakdown || {})[t.key]);

  // Customer pad — condensed to what fits the iSC250 display. Never awaited: the
  // print is the record, the pad is the convenience.
  promptOnPinpad(pinpadContext, `END OF DAY ${date}`, eodPadLines(report));

  await printNoticeSlip({
    heading: "END OF DAY SUMMARY",
    lines: [
      row("DATE", date),
      row("TRANSACTIONS", report.total_transactions || 0),
      row("ITEMS SOLD", report.total_items_sold || 0),
      "",
      row("SALES", money(report.total_revenue)),
      row("REFUNDS", money(report.total_refunds)),
      row("NET REVENUE", money(report.net_revenue)),
      "",
      "-- BY REGISTER --",
      ...(report.register_details || []).map((r) =>
        row(`${r.register_id}`.slice(0, 12), `${r.transactions} TX ${money(r.revenue)}`)
      ),
      "",
      "-- BY TENDER --",
      ...tenders.map((t) => row(t.label, money(report.payment_breakdown[t.key]))),
      "",
      `PRINTED ${new Date().toLocaleString()}`,
    ],
    footer: "***NOT A RECEIPT***",
  }, operator);

  return report;
}

// The pad lines for a report — kept separate so the caller supplies the pinpad context.
export function eodPadLines(report) {
  const tenders = READING_TENDERS.filter((t) => (report.payment_breakdown || {})[t.key]);
  return [
    padRow("TRANSACTIONS", report.total_transactions || 0),
    padRow("SALES", money(report.total_revenue)),
    padRow("REFUNDS", money(report.total_refunds)),
    padRow("NET", money(report.net_revenue)),
    padRow("ITEMS", report.total_items_sold || 0),
    "",
    ...(report.register_details || []).slice(0, 4).map((r) =>
      padRow(`${r.register_id}`.slice(0, 10), money(r.revenue))
    ),
    "",
    ...tenders.map((t) => padRow(t.label, money(report.payment_breakdown[t.key]))),
  ];
}