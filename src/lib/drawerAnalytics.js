// Aggregates drawer_open RegisterLog records for the Loss Prevention workbench.
//
// Two questions only: how long are drawers standing open, and which opens had nothing
// behind them. Everything here is derived from the structured fields the lane writes —
// no parsing of the human-readable detail line.

import { isUnexplainedOpen } from "@/lib/drawerActivity";

export const LONG_OPEN_SECONDS = 60;

function isNoSale(l) {
  return l.drawer_no_sale ?? isUnexplainedOpen(l.drawer_reason);
}

export function drawerOpens(logs = []) {
  return logs
    .filter(l => l.event_type === "drawer_open")
    .map(l => ({
      id: l.id,
      date: l.created_date,
      operator: l.operator_name || "—",
      operator_id: l.operator_id || "",
      register: l.register_id || "—",
      seconds: l.drawer_open_seconds || 0,
      reason: l.drawer_reason || "manual",
      noSale: isNoSale(l),
      transactionId: l.transaction_id || "",
      amount: l.transaction_total || 0,
      detail: l.detail || "",
    }));
}

export function drawerTotals(opens = []) {
  const withDuration = opens.filter(o => o.seconds > 0);
  const totalSeconds = withDuration.reduce((s, o) => s + o.seconds, 0);
  return {
    count: opens.length,
    noSale: opens.filter(o => o.noSale).length,
    longOpens: opens.filter(o => o.seconds >= LONG_OPEN_SECONDS).length,
    avgSeconds: withDuration.length ? Math.round(totalSeconds / withDuration.length) : 0,
    maxSeconds: withDuration.reduce((m, o) => Math.max(m, o.seconds), 0),
  };
}

// Operators ranked by unexplained opens first, then by time spent with the drawer open —
// the order an LP analyst would actually read the list in.
export function drawerByOperator(opens = []) {
  const map = {};
  opens.forEach(o => {
    const row = map[o.operator] || (map[o.operator] = { operator: o.operator, count: 0, noSale: 0, longOpens: 0, seconds: 0 });
    row.count += 1;
    row.seconds += o.seconds;
    if (o.noSale) row.noSale += 1;
    if (o.seconds >= LONG_OPEN_SECONDS) row.longOpens += 1;
  });
  return Object.values(map)
    .map(r => ({ ...r, avgSeconds: r.count ? Math.round(r.seconds / r.count) : 0 }))
    .sort((a, b) => b.noSale - a.noSale || b.seconds - a.seconds);
}

export function formatDuration(seconds) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}