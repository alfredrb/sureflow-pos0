// One builder for the Quick Report in all three output formats. Previously the same
// grouping and formatting was written out three times, so a change to one export
// silently disagreed with the others.

const blank = () => ({ deposits: 0, expectedCash: 0, depositedCash: 0, variance: 0, advances: 0, pickups: 0, audits: 0, auditAmount: 0, robberies: 0, stolenAmount: 0 });

export function groupByRegister({ deposits = [], advances = [], pickups = [], audits = [], robberies = [] }) {
  const groups = {};
  [
    ...deposits,
    ...advances.map((a) => ({ ...a, type: "advance" })),
    ...pickups.map((p) => ({ ...p, type: "pickup" })),
    ...audits.map((a) => ({ ...a, type: "audit" })),
    ...robberies.map((r) => ({ ...r, type: "robbery" })),
  ].forEach((item) => {
    const regId = item.register_id || "Unknown";
    if (!groups[regId]) groups[regId] = blank();
    const g = groups[regId];
    if (item.report_date) g.deposits += 1;
    if (item.expected_cash) g.expectedCash += item.expected_cash;
    if (item.actual_cash_deposited) g.depositedCash += item.actual_cash_deposited;
    if (item.difference) g.variance += item.difference;
    if (item.type === "advance") g.advances += item.amount || 0;
    if (item.type === "pickup") g.pickups += item.amount || 0;
    if (item.type === "audit") g.audits += 1;
    if (item.type === "audit" && item.total_counted) g.auditAmount += item.total_counted;
    if (item.type === "robbery") g.robberies += 1;
    if (item.type === "robbery" && item.amount_stolen) g.stolenAmount += item.amount_stolen;
  });
  return groups;
}

const tillBlock = (t) =>
  `\n=== TILL CHECKOUT/CHECKIN ===\nTills Checked Out: ${t.checkedOutCount}\nChecked Out Expected Total: $${t.checkedOutExpected.toFixed(2)}\nTills Checked In: ${t.checkedInCount} / ${t.checkedOutCount}\nTill Discrepancies Total: ${t.totalDiscrepancies >= 0 ? "+" : ""}$${t.totalDiscrepancies.toFixed(2)}\n`;

export function buildReportText(groups, t) {
  let out = `CASH RECONCILIATION QUICK REPORT\nGenerated: ${new Date().toLocaleString()}\n\n`;
  out += `SUMMARY BY REGISTER\n`;
  out += `\nRegister | Deposits | Expected | Deposited | Variance | Advances | Pickups | Audits | Audit Amount | Robberies | Stolen\n`;
  out += `${"─".repeat(130)}\n`;
  Object.entries(groups).forEach(([regId, d]) => {
    out += `${regId.padEnd(15)} | ${String(d.deposits).padEnd(8)} | $${d.expectedCash.toFixed(2).padEnd(9)} | $${d.depositedCash.toFixed(2).padEnd(10)} | $${d.variance.toFixed(2).padEnd(8)} | $${d.advances.toFixed(2).padEnd(8)} | $${d.pickups.toFixed(2).padEnd(8)} | ${String(d.audits).padEnd(6)} | $${d.auditAmount.toFixed(2).padEnd(13)} | ${String(d.robberies).padEnd(10)} | $${d.stolenAmount.toFixed(2)}\n`;
  });
  out += `${"─".repeat(130)}\n`;
  out += `TOTALS${" ".repeat(9)} | ${String(t.totalDeposits).padEnd(8)} | $${t.totalExpected.toFixed(2).padEnd(9)} | $${t.totalDeposited.toFixed(2).padEnd(10)} | $${t.totalVariance.toFixed(2).padEnd(8)} | $${t.totalAdvances.toFixed(2).padEnd(8)} | $${t.totalPickups.toFixed(2).padEnd(8)} | ${String(t.totalAudits).padEnd(6)} | $${t.totalAuditedAmount.toFixed(2).padEnd(13)} | ${String(t.robberyCount).padEnd(10)} | $${t.totalStolen.toFixed(2)}\n`;
  out += tillBlock(t);
  return out;
}

export function buildReportCsv(groups, t) {
  return (
    "Register,Deposits,Expected Cash,Deposited Cash,Variance,Advances,Pickups,Gift Card Cashouts,Audits,Audit Amount,Robberies,Stolen Amount\n" +
    Object.entries(groups)
      .map(([regId, d]) =>
        `"${regId}",${d.deposits},$${d.expectedCash.toFixed(2)},$${d.depositedCash.toFixed(2)},$${d.variance.toFixed(2)},$${d.advances.toFixed(2)},$${d.pickups.toFixed(2)},$0.00,${d.audits},$${d.auditAmount.toFixed(2)},${d.robberies},$${d.stolenAmount.toFixed(2)}`
      )
      .join("\n") +
    `\nTOTAL,${t.totalDeposits},$${t.totalExpected.toFixed(2)},$${t.totalDeposited.toFixed(2)},$${t.totalVariance.toFixed(2)},$${t.totalAdvances.toFixed(2)},$${t.totalPickups.toFixed(2)},$${t.totalGiftCardCashout.toFixed(2)},${t.totalAudits},$${t.totalAuditedAmount.toFixed(2)},${t.robberyCount},$${t.totalStolen.toFixed(2)}` +
    `\n\nTILL CHECKOUT/CHECKIN\nTills Checked Out,${t.checkedOutCount}\nChecked Out Expected Total,$${t.checkedOutExpected.toFixed(2)}\nTills Checked In,${t.checkedInCount}\nTill Discrepancies Total,$${t.totalDiscrepancies.toFixed(2)}`
  );
}

export function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}