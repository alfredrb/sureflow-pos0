// Groups already-scoped records into per-store buckets plus a chain total, so an HQ
// admin on "All Stores" gets a real answer to "how did each store do" instead of a
// flat list they have to add up by eye.
//
// It deliberately takes the records the page has ALREADY scoped and filtered. Rolling
// up raw data would quietly show a store manager the whole chain, and would disagree
// with the table printed underneath it.

// Records that carry store_id are grouped on it. Cash records only reference a
// register, so those pages pass their own resolver.
const defaultStoreOf = (r) => r.store_id || "";

export function rollupByStore(records, { metrics, storeOf = defaultStoreOf, storeNames = {} }) {
  const rows = records || [];
  const buckets = new Map();
  for (const r of rows) {
    const key = storeOf(r) || "";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(r);
  }

  const valuesFor = (list) =>
    Object.fromEntries(Object.entries(metrics).map(([k, fn]) => [k, fn(list)]));

  const groups = [...buckets.entries()].map(([store_id, list]) => ({
    store_id,
    // A record pointing at a store number with no Store record left (a store deleted
    // after its history was written) is called out rather than silently labelled.
    name: store_id ? storeNames[store_id] || "No store record" : "Unassigned",
    unknown: !!store_id && !storeNames[store_id],
    count: list.length,
    values: valuesFor(list),
  }));

  // Store number order, with the unassigned bucket last — it is context, not a store.
  groups.sort((a, b) => {
    if (!a.store_id) return 1;
    if (!b.store_id) return -1;
    return a.store_id.localeCompare(b.store_id, undefined, { numeric: true });
  });

  return { groups, total: { count: rows.length, values: valuesFor(rows) } };
}

export const sumOf = (field) => (rows) => rows.reduce((t, r) => t + (Number(r[field]) || 0), 0);
export const countOf = (predicate) => (rows) => (predicate ? rows.filter(predicate).length : rows.length);

export const fmtMoney = (v) => `$${(Number(v) || 0).toFixed(2)}`;
export const fmtInt = (v) => String(Math.round(Number(v) || 0));