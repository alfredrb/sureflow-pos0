import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Lanes change on-hand stock only through here (sales, voids, returns) — they can no
// longer edit product records directly, so prices and recall flags stay admin-only.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { adjustments } = await req.json().catch(() => ({}));
    if (!Array.isArray(adjustments) || adjustments.length === 0 || adjustments.length > 200) {
      return Response.json({ error: 'adjustments must be a list of 1-200 items' }, { status: 400 });
    }
    for (const a of adjustments) {
      if (!a?.sku || !Number.isFinite(Number(a.delta)) || Math.abs(Number(a.delta)) > 1000) {
        return Response.json({ error: 'Each adjustment needs a sku and a delta within ±1000' }, { status: 400 });
      }
    }
    const skus = [...new Set(adjustments.map((a) => String(a.sku)))];
    const prods = await base44.asServiceRole.entities.Product.filter({ sku: { $in: skus } });
    const delta = {};
    for (const a of adjustments) delta[a.sku] = (delta[a.sku] || 0) + Number(a.delta);
    const updates = prods.map((p) => ({ id: p.id, stock_qty: Math.max(0, (p.stock_qty || 0) + (delta[p.sku] || 0)) }));
    if (updates.length) await base44.asServiceRole.entities.Product.bulkUpdate(updates);
    return Response.json({ updated: updates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}