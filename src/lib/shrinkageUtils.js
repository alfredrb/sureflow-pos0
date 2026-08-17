import { base44 } from "@/api/base44Client";

export const SHRINKAGE_CATEGORIES = ["stolen", "damaged", "missing", "short_shipped"];

export const CATEGORY_META = {
  stolen: { label: "Stolen", color: "#ef4444", bg: "bg-red-50", text: "text-red-700", border: "border-red-100" },
  damaged: { label: "Damaged", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
  missing: { label: "Missing", color: "#6366f1", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
  short_shipped: { label: "Short-Shipped", color: "#8b5cf6", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100" },
};

const DAMAGED_CONDITIONS = ["damaged", "defective", "expired", "unsanitary", "open_package"];

// Fetches and normalizes shrinkage incidents from every loss-prevention source.
export async function loadShrinkageIncidents() {
  const [claims, invs, recs, prods] = await Promise.all([
    base44.entities.Claim.list("-created_date", 1000),
    base44.entities.Investigation.list("-created_date", 500),
    base44.entities.InventoryReconciliation.list("-date", 200),
    base44.entities.Product.list(),
  ]);

  const costBySku = {};
  const nameBySku = {};
  (prods || []).forEach(p => {
    if (p.sku) {
      costBySku[p.sku] = Number(p.cost || 0);
      nameBySku[p.sku] = p.name;
    }
  });

  const incidents = [];

  // Claims → damaged OR short-shipped (one category each, no double counting)
  (claims || []).forEach(c => {
    const date = c.date_created || c.created_date;
    const base = {
      sku: c.sku || "",
      name: c.name || c.sku || nameBySku[c.sku] || "Unknown",
      qty: Number(c.qty || 0),
      loss: Number(c.total_cost || 0) || Number(c.unit_cost || 0) * Number(c.qty || 0),
      date,
    };
    if (c.disposition === "ship_back") {
      incidents.push({ ...base, category: "short_shipped", source: "claim", sourceId: c.id });
    } else if (DAMAGED_CONDITIONS.includes(c.condition)) {
      incidents.push({ ...base, category: "damaged", source: "claim", sourceId: c.id });
    }
  });

  // Stock-theft investigations → stolen
  (invs || []).filter(i => i.type === "stock_theft").forEach(inv => {
    (inv.stolen_items || []).forEach(it => {
      incidents.push({
        sku: it.sku || "",
        name: it.name || it.sku || nameBySku[it.sku] || "Unknown",
        qty: Number(it.qty || 0),
        loss: Number(it.total_loss || 0) || Number(it.qty || 0) * Number(it.unit_cost || 0),
        date: inv.created_date || inv.date_range_start,
        category: "stolen",
        source: "investigation",
        sourceId: inv.id,
      });
    });
  });

  // Inventory reconciliation → missing (unexplained negative discrepancies)
  (recs || []).forEach(r => {
    (r.lines || []).forEach(l => {
      const disc = Number(l.discrepancy || 0);
      if (disc < 0) {
        const sku = l.sku || "";
        incidents.push({
          sku,
          name: l.name || sku || nameBySku[sku] || "Unknown",
          qty: Math.abs(disc),
          loss: Math.abs(disc) * (costBySku[sku] || 0),
          date: r.date,
          category: "missing",
          source: "reconciliation",
          sourceId: r.id,
        });
      }
    });
  });

  return incidents.filter(i => i.date);
}

export function dayKey(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return dt.toISOString().slice(0, 10);
}

export function filterByRange(incidents, fromDate, toDate) {
  if (!fromDate && !toDate) return incidents;
  return incidents.filter(i => {
    const k = dayKey(i.date);
    if (!k) return false;
    if (fromDate && k < fromDate) return false;
    if (toDate && k > toDate) return false;
    return true;
  });
}

// Builds a continuous daily series (zero-filled) across the date range, split by category.
export function buildDailySeries(incidents, fromDate, toDate) {
  if (!fromDate || !toDate) return [];
  const start = new Date(fromDate + "T00:00:00");
  const end = new Date(toDate + "T00:00:00");
  if (isNaN(start) || isNaN(end)) return [];
  const map = {};
  incidents.forEach(it => {
    const k = dayKey(it.date);
    if (!k) return;
    if (!map[k]) map[k] = { date: k, stolen: 0, damaged: 0, missing: 0, short_shipped: 0 };
    map[k][it.category] = (map[k][it.category] || 0) + (it.loss || 0);
  });
  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10);
    days.push({ date: key, ...(map[key] || { stolen: 0, damaged: 0, missing: 0, short_shipped: 0 }) });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Aggregates incidents per item with per-category loss breakdown.
export function aggregateItems(incidents) {
  const map = {};
  incidents.forEach(it => {
    const key = it.sku || it.name || "Unknown";
    if (!map[key]) map[key] = { sku: it.sku, name: it.name, count: 0, qty: 0, loss: 0, stolen: 0, damaged: 0, missing: 0, short_shipped: 0 };
    map[key].count += 1;
    map[key].qty += it.qty || 0;
    map[key].loss += it.loss || 0;
    map[key][it.category] = (map[key][it.category] || 0) + (it.loss || 0);
  });
  return Object.values(map).sort((a, b) => b.loss - a.loss);
}

export function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}