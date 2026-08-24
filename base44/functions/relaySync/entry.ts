import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { authenticateRelay } from '../../shared/relayAuth.ts';

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
    const ACTIONS = ['pull', 'push', 'update_result', 'operator_manage', 'lanes', 'hardware_profiles'];
    if (!ACTIONS.includes(action)) {
      return Response.json({ error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400 });
    }

    // ---- Authenticate the relay (shared with laneMaintenanceQueue) ----
    const cred = await authenticateRelay(db, storeId, apiKey);
    if (!cred) return Response.json({ error: 'Invalid relay credentials for this store' }, { status: 401 });

    const now = new Date().toISOString();

    // ---------------- UPDATE_RESULT: the controller reports a cloud-pushed update ----------------
    // The controller has already staged the checkout, restarted and run its own health
    // gate locally. This only records the outcome — the cloud never drives the update.
    if (action === 'update_result') {
      const assignmentId = String(body.assignment_id || '').trim();
      const result = String(body.result || '').trim();
      const allowed = ['in_progress', 'applied', 'failed', 'rolled_back'];
      if (!assignmentId || !allowed.includes(result)) {
        return Response.json({ error: `assignment_id and result (${allowed.join(', ')}) are required` }, { status: 400 });
      }

      const assignment = await db.RelayUpdateAssignment.get(assignmentId).catch(() => null);
      if (!assignment || assignment.store_id !== storeId) {
        return Response.json({ error: 'Assignment not found for this store' }, { status: 404 });
      }

      const patch: any = { status: result, error: String(body.error || '').slice(0, 900) };
      if (result === 'applied') {
        patch.current_ref = String(body.current_ref || assignment.git_ref || '');
        patch.previous_ref = String(body.previous_ref || assignment.current_ref || '');
        patch.applied_at = now;
      }
      if (result === 'rolled_back' || result === 'failed') {
        patch.current_ref = String(body.current_ref || assignment.current_ref || '');
      }
      await db.RelayUpdateAssignment.update(assignmentId, patch);

      if (result === 'applied' || result === 'rolled_back' || result === 'failed') {
        await db.AuditTrail.create({
          action: result === 'applied' ? 'Controller Update Applied' : result === 'rolled_back' ? 'Controller Update Rolled Back' : 'Controller Update Failed',
          category: 'system',
          description:
            result === 'applied'
              ? `Store #${storeId} is now running ref ${patch.current_ref} for release "${assignment.update_label || assignment.update_id}" (previous ref ${patch.previous_ref || 'unknown'}).${assignment.include_lane_image ? ' The diskless NFS root was rebuilt from the same ref; lanes pick it up on their staggered reboots.' : ''}`
              : `Store #${storeId} did not take release "${assignment.update_label || assignment.update_id}" (target ref ${assignment.git_ref}). ${result === 'rolled_back' ? 'The health gate failed after restart and the controller restored the previous ref.' : 'The controller could not complete the checkout or image rebuild.'} Reported: ${patch.error || 'no detail'}`,
          actor_name: 'System',
          actor_role: 'system',
          page: '/admin/controller-updates',
        });
      }

      // A rollback or hard failure must reach ops without anyone watching the screen.
      if (result === 'rolled_back' || result === 'failed') {
        await db.SystemAlert.create({
          alert_type: 'sync',
          severity: 'critical',
          title: `Store ${storeId} ${result === 'rolled_back' ? 'rolled back' : 'failed'} a pushed controller update`,
          description: `Release "${assignment.update_label || assignment.update_id}" targeting ref ${assignment.git_ref} did not stick. ${patch.error || 'No detail reported.'} The store is running ref ${patch.current_ref || 'unknown'}.`,
          source: `Store ${storeId}`,
          status: 'active',
        });
        await db.RelayUpdate.update(assignment.update_id, { status: 'rolled_back' }).catch(() => null);
      }

      // Release completes once every store in scope has taken it.
      if (result === 'applied') {
        const siblings = await db.RelayUpdateAssignment.filter({ update_id: assignment.update_id });
        if (siblings.length > 0 && siblings.every((a: any) => a.status === 'applied')) {
          await db.RelayUpdate.update(assignment.update_id, { status: 'complete' }).catch(() => null);
        }
      }

      return Response.json({ ok: true, assignment_id: assignmentId, status: result });
    }

    // ---------------- OPERATOR_MANAGE: the controller CLI menu manages this store's operators ----------------
    // The relay API key is the only credential, and it belongs to exactly one store, so
    // every read and write below is pinned to that store — a controller can never reach
    // another store's operators. Runs as service role, which is what satisfies the
    // admin-only RLS on Operator writes.
    if (action === 'operator_manage') {
      const op = String(body.op || '').trim();
      const input = body.operator && typeof body.operator === 'object' ? body.operator : {};
      const operatorId = String(input.operator_id || '').trim();

      const storeOperators = async () => {
        const all = await db.Operator.list();
        return all.filter((o: any) => o.store_id === storeId);
      };

      if (op === 'list') {
        const rows = await storeOperators();
        return Response.json({
          ok: true,
          operators: rows.map((o: any) => ({
            operator_id: o.operator_id,
            full_name: o.full_name,
            role: o.role,
            status: o.status || 'active',
            pos_access: o.pos_access !== false,
          })),
        });
      }

      if (!operatorId) return Response.json({ error: 'operator.operator_id is required' }, { status: 400 });
      const existing = (await storeOperators()).find((o: any) => o.operator_id === operatorId) || null;

      const audit = (label: string, description: string, changes?: any[]) =>
        db.AuditTrail.create({
          action: label,
          category: 'operator',
          description,
          actor_name: `Controller CLI (store ${storeId})`,
          actor_role: 'system',
          page: '/controller-cli',
          changes: changes || [],
        });

      if (op === 'add') {
        if (existing) return Response.json({ error: `Operator ${operatorId} already exists at this store` }, { status: 409 });
        const fullName = String(input.full_name || '').trim();
        const pin = String(input.pin || '').trim();
        const role = String(input.role || 'cashier').trim();
        if (!fullName || !pin) return Response.json({ error: 'full_name and pin are required' }, { status: 400 });

        await db.Operator.create({
          operator_id: operatorId,
          full_name: fullName,
          pin,
          role,
          status: 'active',
          pos_access: true,
          store_id: storeId,
        });
        await audit(
          'Operator Added (Controller CLI)',
          `Operator ${operatorId} (${fullName}) was created as ${role} at store #${storeId} from the controller console menu.`,
          [{ field: 'operator_id', from: '', to: operatorId }, { field: 'role', from: '', to: role }]
        );
        return Response.json({ ok: true, message: `Added operator ${operatorId} (${fullName}) as ${role}.` });
      }

      if (op === 'edit') {
        if (!existing) return Response.json({ error: `Operator ${operatorId} not found at store ${storeId}` }, { status: 404 });
        const EDITABLE = ['full_name', 'pin', 'role', 'status', 'pos_access'];
        const patch: any = {};
        const changes: any[] = [];
        for (const field of EDITABLE) {
          if (input[field] === undefined) continue;
          const value = field === 'pos_access' ? !!input[field] : String(input[field]);
          patch[field] = value;
          changes.push({
            field,
            from: field === 'pin' ? '****' : String(existing[field] ?? ''),
            to: field === 'pin' ? '****' : String(value),
          });
        }
        if (Object.keys(patch).length === 0) {
          return Response.json({ error: `Nothing to change. Editable: ${EDITABLE.join(', ')}` }, { status: 400 });
        }
        await db.Operator.update(existing.id, patch);
        await audit(
          'Operator Updated (Controller CLI)',
          `Operator ${operatorId} (${existing.full_name}) was updated at store #${storeId} from the controller console menu: ${changes.map((c) => `${c.field} ${c.from || 'blank'} to ${c.to}`).join(', ')}.`,
          changes
        );
        return Response.json({ ok: true, message: `Updated ${operatorId}: ${changes.map((c) => c.field).join(', ')}.` });
      }

      if (op === 'remove') {
        if (!existing) return Response.json({ error: `Operator ${operatorId} not found at store ${storeId}` }, { status: 404 });
        await db.Operator.delete(existing.id);
        await audit(
          'Operator Removed (Controller CLI)',
          `Operator ${operatorId} (${existing.full_name}, ${existing.role}) was removed from store #${storeId} from the controller console menu. Past transactions and time clock records are retained.`,
          [{ field: 'operator_id', from: operatorId, to: '' }]
        );
        return Response.json({ ok: true, message: `Removed operator ${operatorId} (${existing.full_name}).` });
      }

      return Response.json({ error: "op must be 'list', 'add', 'edit' or 'remove'" }, { status: 400 });
    }

    // ---------------- LANES: the controller CLI menu's lane table and action log ----------------
    // op=list  -> this store's registers, so the menu can show a lane's name and expected
    //             hardware alongside whether its agent has checked in locally. The cloud
    //             deliberately does NOT claim a lane is "up": only the relay knows that,
    //             from the agent polls, so the menu merges the two.
    // op=audit -> records a lane action taken on the box (reboot, batch reboot, image
    //             rebuild) so it is as traceable as the same action from the admin panel.
    if (action === 'lanes') {
      const op = String(body.op || 'list').trim();

      if (op === 'list') {
        const registers = await db.Register.filter({ store_id: storeId });
        return Response.json({
          ok: true,
          lanes: registers.map((r: any) => ({
            register_id: r.register_id,
            name: r.name,
            status: r.status || 'offline',
            paused: !!r.paused,
            boot_profile: r.boot_profile || 'local_disk',
            assigned_operator: r.assigned_operator || '',
            ip_address: r.ip_address || '',
            mac_address: r.mac_address || '',
          })),
        });
      }

      if (op === 'audit') {
        const laneAction = String(body.lane_action || '').trim();
        const detail = String(body.detail || '').slice(0, 900);
        if (!laneAction) return Response.json({ error: 'lane_action is required' }, { status: 400 });

        await db.AuditTrail.create({
          action: 'Lane Maintenance (Controller CLI)',
          category: 'register',
          description: `Store #${storeId}: ${laneAction}${detail ? ` — ${detail}` : ''} (run from the controller console menu).`,
          actor_name: `Controller CLI (store ${storeId})`,
          actor_role: 'system',
          page: '/controller-cli',
          changes: [{ field: 'lane_action', from: '', to: laneAction }],
        });
        return Response.json({ ok: true, message: 'Recorded in the audit trail.' });
      }

      return Response.json({ error: "op must be 'list' or 'audit'" }, { status: 400 });
    }

    // ---------------- HARDWARE_PROFILES: driver profiles for a lane image build ----------------
    // Called by sureflow-build-lane-image on the controller while it builds a diskless root.
    // The profiles returned are decided by THIS STORE's own registers: a variant maps to a
    // boot_profile, the registers on that profile name their hardware models, and those
    // models are matched against the HardwareLibrary. That is what makes a built image
    // specific to the terminals the store actually has rather than a generic superset.
    if (action === 'hardware_profiles') {
      const variant = String(body.variant || 'all').trim();
      const BOOT_PROFILE: Record<string, string> = {
        legacy: 'pxe_debian_legacy',
        modern: 'pxe_debian_modern',
      };
      if (variant !== 'all' && !BOOT_PROFILE[variant]) {
        return Response.json({ error: "variant must be 'legacy', 'modern' or 'all'" }, { status: 400 });
      }

      const registers = await db.Register.filter({ store_id: storeId });
      const inScope =
        variant === 'all'
          ? registers
          : registers.filter((r: any) => (r.boot_profile || '') === BOOT_PROFILE[variant]);

      const MODEL_FIELDS = [
        'terminal_model',
        'keyboard_model',
        'printer_model',
        'scanner_model',
        'cash_drawer_model',
        'drawer_model',
        'pinpad_model',
        'pole_display_model',
      ];
      const models = new Set<string>();
      for (const r of inScope) {
        for (const f of MODEL_FIELDS) {
          const v = String(r[f] || '').trim();
          if (v) models.add(v);
        }
      }

      const norm = (s: any) => String(s || '').trim().toLowerCase();
      const wanted = new Set([...models].map(norm));
      const library = await db.HardwareLibrary.list();
      const matched = library.filter((p: any) => p.active !== false && wanted.has(norm(p.model)));

      return Response.json({
        ok: true,
        variant,
        registers_in_scope: inScope.length,
        models: [...models],
        profiles: matched.map((p: any) => ({
          model: p.model,
          device_type: p.device_type,
          vendor: p.vendor || '',
          packages: Array.isArray(p.packages) ? p.packages : [],
          kernel_modules: Array.isArray(p.kernel_modules) ? p.kernel_modules : [],
          boot_args: p.boot_args || '',
          udev_rules: p.udev_rules || '',
          xorg_config: p.xorg_config || '',
        })),
      });
    }

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

      // A pushed update rides the store's own maintenance window: it is only handed
      // down once the nightly sweep has folded it into tonight's plan (planned_for_date).
      // Until then the controller sees nothing, so nothing updates mid-day.
      const assignments = await db.RelayUpdateAssignment.filter({ store_id: storeId });
      const today = now.slice(0, 10);
      const due = assignments.find(
        (a: any) => (a.status === 'pending' || a.status === 'in_progress') && a.planned_for_date === today
      );
      const pending_update = due
        ? {
            assignment_id: due.id,
            update_label: due.update_label || '',
            git_ref: due.git_ref || '',
            include_lane_image: !!due.include_lane_image,
            current_ref: due.current_ref || '',
            status: due.status,
          }
        : null;

      const payload = {
        cached_at: now,
        store_id: storeId,
        pending_update,
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