// Build a trailing-N-days daily series from a list of records.
// Each bucket holds the sum of `valueFn(item)` for records falling on that day.
export function dailySeriesTrailing(items, dateField, valueFn = () => 1, days = 14) {
  const out = new Array(days).fill(0);
  if (!Array.isArray(items)) return out;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  items.forEach((it) => {
    const d = new Date(it?.[dateField]);
    if (isNaN(d.getTime())) return;
    const t = d.getTime();
    if (t < start) return;
    const idx = Math.floor((t - start) / 86400000);
    if (idx >= 0 && idx < days) out[idx] += Number(valueFn(it)) || 0;
  });
  return out;
}

// Bucket records into the selected date range, capped at maxBuckets points so
// very wide ranges stay readable in a sparkline.
export function rangeSeries(items, dateField, startDate, endDate, valueFn = () => 1, maxBuckets = 30) {
  const s = new Date(startDate); s.setHours(0, 0, 0, 0);
  const e = new Date(endDate); e.setHours(23, 59, 59, 999);
  const totalDays = Math.max(1, Math.round((e - s) / 86400000) + 1);
  const buckets = Math.min(maxBuckets, totalDays);
  const out = new Array(buckets).fill(0);
  if (!Array.isArray(items)) return out;
  items.forEach((it) => {
    const d = new Date(it?.[dateField]);
    if (isNaN(d.getTime()) || d < s || d > e) return;
    let idx = Math.floor((d - s) / 86400000);
    if (buckets < totalDays) idx = Math.floor((idx * buckets) / totalDays);
    if (idx >= 0 && idx < buckets) out[idx] += Number(valueFn(it)) || 0;
  });
  return out;
}