import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// SureFlow Local Relay <-> Cloud sync endpoint (Phase 1).
// Called by each store's Local Relay VM, authenticated with a per-store API key
// (RelayCredential). Not a user-authenticated endpoint — the key IS the identity.
//
// Payload:
//   { store_id, api_key, action: "pull" }
//   { store_id, api_key, action: "push", sales: [ { transaction_id, ... } ] }

export default async function (req: Request): Promise<Response> {
  const started = Date.now();
  let body: any = {};
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    try {
      body = await req.json();
    } catch (_e) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const storeId = String(body.store_id || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const action = String(body.action || '').trim();

    if (!storeId || !apiKey) return Response.json({ error: 'store_id and api_key are required' }, { status: 400 });
    if (action !== 'pull' && action !== 'push') return Response.json({ error: "action must be 'pull' or 'push'" }, { status: 400 });

    // ---- Authenticate the relay ----
    const creds = await db.RelayCredential.filter({ store_id: storeId, status: 'active' });
    const cred = creds.find((c: any) => c.api_key === apiKey);
    if (!cred) return Response.json({ error: 'Invalid relay credentials for this store' }, { status: 401 });

    const now = new Date().toISOString();
    await db.RelayCredential.update(cred.id, { last_used_at: now });

    // ---------------- PULL: send the store's catalog cache down ----------------
    if (action === 'pull') {
      const [products, operators, registers, settings, discounts, functionKeys] = await Promise.all([
        db.Product.list(),
        db.Operator.list(),
        db.Register.filter({ store_id: storeId }),
        db.StoreSettings.list(),
        db.DiscountType.list(),
        db.FunctionKey.list(),
      ]);

      // Products/operators/settings may be store-scoped or shared (blank store_id).
      const forStore = (rows: any[]) => rows.filter((r: any) => !r.store_id || r.store_id === storeId);
      const storeProducts = forStore(products).filter((p: any) => p.status !== 'discontinued');
      const storeOperators = forStore(operators);
      const storeSettings = forStore(settings)[0] || null;

      const payload = {
        cached_at: now,
        store_id: storeId,
        products: storeProducts,
        operators: storeOperators,
        registers,
        settings: storeSettings,
        discounts,
        function_keys: functionKeys,
      };

      const pulled =
        storeProducts.length + storeOperators.length + registers.length + discounts.length + functionKeys.length;

      await db.RelaySyncLog.create({
        store_id: storeId,
        direction: 'pull',
        status: 'success',
        records_pulled: pulled,
        duration_ms: Date.now() - started,
        synced_at: new Date().toISOString(),
      });

      return Response.json({ ok: true, ...payload, records_pulled: pulled });
    }

    // ---------------- PUSH: accept queued offline sales ----------------
    const sales = Array.isArray(body.sales) ? body.sales : [];
    if (sales.length === 0) {
      return Response.json({ ok: true, accepted: [], duplicates: [], records_pushed: 0, duplicates_skipped: 0 });
    }

    const accepted: string[] = [];
    const duplicates: string[] = [];
    const failures: any[] = [];
    // Stock deltas are applied as movements so concurrent stores never clobber each other.
    const stockDeltas: Record<string, number> = {};

    for (const sale of sales) {
      const txId = String(sale?.transaction_id || '').trim();
      if (!txId) {
        failures.push({ transaction_id: null, error: 'missing transaction_id' });
        continue;
      }
      try {
        // Idempotency: a retried batch must never double-write.
        const existing = await db.Transaction.filter({ transaction_id: txId });
        if (existing.length > 0) {
          duplicates.push(txId);
          continue;
        }

        const items = Array.isArray(sale.items) ? sale.items : [];
        await db.Transaction.create({
          transaction_id: txId,
          sale_date: sale.sale_date || now,
          operator_id: String(sale.operator_id || ''),
          operator_name: sale.operator_name || '',
          register_id: String(sale.register_id || ''),
          items,
          subtotal: Number(sale.subtotal || 0),
          tax: Number(sale.tax || 0),
          total: Number(sale.total || 0),
          payment_method: sale.payment_method === 'check' ? 'check' : 'cash',
          amount_tendered: Number(sale.amount_tendered || 0),
          change_due: Number(sale.change_due || 0),
          status: 'completed',
          shift_id: sale.shift_id || '',
          store_id: storeId,
          offline_capture: true,
          training_mode: !!sale.training_mode,
        });

        if (!sale.training_mode) {
          for (const it of items) {
            const sku = String(it?.sku || '');
            if (sku) stockDeltas[sku] = (stockDeltas[sku] || 0) + Number(it.qty || 0);
          }
        }
        accepted.push(txId);
      } catch (e: any) {
        failures.push({ transaction_id: txId, error: e.message });
      }
    }

    // Apply stock movements as deltas against current cloud quantities.
    const skus = Object.keys(stockDeltas);
    if (skus.length > 0) {
      const allProducts = await db.Product.list();
      const updates = [];
      for (const sku of skus) {
        const prod = allProducts.find((p: any) => p.sku === sku && (!p.store_id || p.store_id === storeId));
        if (prod) updates.push({ id: prod.id, stock_qty: Number(prod.stock_qty || 0) - stockDeltas[sku] });
      }
      if (updates.length > 0) await db.Product.bulkUpdate(updates);
    }

    const status = failures.length === 0 ? 'success' : accepted.length > 0 ? 'partial' : 'error';
    await db.RelaySyncLog.create({
      store_id: storeId,
      direction: 'push',
      status,
      records_pushed: accepted.length,
      duplicates_skipped: duplicates.length,
      error: failures.length ? JSON.stringify(failures).slice(0, 900) : '',
      duration_ms: Date.now() - started,
      synced_at: new Date().toISOString(),
    });

    return Response.json({
      ok: failures.length === 0,
      accepted,
      duplicates,
      failures,
      records_pushed: accepted.length,
      duplicates_skipped: duplicates.length,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}