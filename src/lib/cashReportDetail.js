// Per-register detail block for the printed cash report.
//
// Mirrors buildDetailLines in base44/shared/cashReport.ts (different bundle, so it
// cannot be imported): every till bag, advance, pickup and deposit for the day with
// the people attached to it, at 42 thermal columns. A change here must be made there.

export const WIDTH = 42;

const money = (n) => Number(n || 0).toFixed(2);
export const signed = (n) => (Number(n) >= 0 ? "+" : "-") + "$" + money(Math.abs(Number(n) || 0));

export const row = (label, value) => {
  const v = String(value);
  const l = String(label).slice(0, WIDTH - v.length - 1);
  return l + " ".repeat(Math.max(1, WIDTH - l.length - v.length)) + v;
};

const nameOf = (v) => String(v || "-").toUpperCase().slice(0, 20);

export function buildDetailLines({ deposits = [], advances = [], pickups = [], tillCheckouts = [] } = {}) {
  const groups = {};
  const bucket = (r) => {
    const id = r.register_id || "UNKNOWN";
    if (!groups[id]) groups[id] = { name: "", tills: [], advances: [], pickups: [], deposits: [] };
    if (!groups[id].name && r.register_name) groups[id].name = r.register_name;
    return groups[id];
  };
  tillCheckouts.forEach((t) => bucket(t).tills.push(t));
  advances.forEach((a) => bucket(a).advances.push(a));
  pickups.forEach((p) => bucket(p).pickups.push(p));
  deposits.forEach((d) => bucket(d).deposits.push(d));

  const ids = Object.keys(groups).sort();
  if (!ids.length) return ["", "NO REGISTER ACTIVITY", ""];

  const lines = [""];
  ids.forEach((id) => {
    const g = groups[id];
    lines.push("-".repeat(WIDTH));
    lines.push((g.name ? `${g.name} (${id})` : id).toUpperCase());

    g.tills.forEach((t) => {
      lines.push(`  TILL BAG ${t.bag_number || "-"}`);
      lines.push(row(`   OUT ${nameOf(t.operator_name)}`, "$" + money(t.checkout_total == null ? 250 : t.checkout_total)));
      if (t.status === "checked_in") {
        lines.push(row(`   IN  ${nameOf(t.checkin_operator_name)}`, "$" + money(t.checkin_total)));
        lines.push(row(t.forced ? "   VARIANCE (FORCED)" : "   VARIANCE", signed(t.discrepancy)));
      } else {
        lines.push(row("   STATUS", "STILL OUT"));
      }
    });

    g.advances.forEach((a) => {
      lines.push(row(`  ADVANCE BY ${nameOf(a.approved_by_name)}`, "$" + money(a.amount)));
      if (a.reason) lines.push(`    ${String(a.reason).slice(0, WIDTH - 4)}`);
    });

    g.pickups.forEach((p) => {
      lines.push(row(`  PICKUP BY ${nameOf(p.approved_by_name)}`, "$" + money(p.amount)));
      if (p.reason) lines.push(`    ${String(p.reason).slice(0, WIDTH - 4)}`);
    });

    g.deposits.forEach((d) => {
      lines.push(row("  DEPOSIT EXPECTED", "$" + money(d.expected_cash)));
      lines.push(row("  DEPOSIT COUNTED", "$" + money(d.actual_cash_deposited)));
      lines.push(row("  DEPOSIT VARIANCE", signed(d.difference)));
    });

    lines.push("");
  });
  return lines;
}