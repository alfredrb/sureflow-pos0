import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { computeDayTotals, filterDay, buildReportLines, buildReportText } from '../../shared/cashReport.ts';

// Midnight cash consolidation: for every active store, archive the day's Quick
// Report figures and print the report on that store's own receipt printer.
// The on-screen report is day-scoped, so archiving is what "resets" it — nothing
// is ever deleted.

const localDay = (date) => date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

async function printToStore(store, settings, lines, storeName, relayToken) {
  const relay = String(store.relay_url || '').replace(/\/$/, '');
  if (!relay) throw new Error('No relay URL configured for this store');
  const payload = {
    printer_ip: settings?.admin_printer_ip || '',
    station: 'receipt',
    doc_type: 'notice',
    open_drawer: false,
    transaction_id: '',
    date: new Date().toLocaleString(),
    register_id: 'AUTO',
    register_name: 'AUTO',
    operator_name: 'SYSTEM',
    store_number: store.store_number || '',
    store_name: storeName,
    store_address: [store.address_street, store.address_city, store.address_state, store.address_zip].filter(Boolean).join(', '),
    store_phone: store.phone || '',
    notice: { heading: 'CASH REPORT', lines, footer: '***DAILY CASH REPORT***' },
    items: [],
  };
  const res = await fetch(`${relay}/api/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(relayToken ? { 'X-Relay-Token': relayToken } : {}),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Relay returned HTTP ${res.status}`);
  return true;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // Scheduled runs carry no user; a manual re-run must be an admin.
    let user = null;
    try { user = await base44.auth.me(); } catch { user = null; }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }

    // Default to the day that just ended (the job runs just after local midnight).
    const day = body.report_date || localDay(new Date(Date.now() - 15 * 60 * 1000));

    const svc = base44.asServiceRole.entities;
    const [stores, allSettings, registers, deposits, advances, pickups, audits, robberies, logs, tills, existing] = await Promise.all([
      svc.Store.list(),
      svc.StoreSettings.list(),
      svc.Register.list(),
      svc.EODCashDeposit.list('-report_date', 1000),
      svc.CashAdvance.list('-created_date', 1000),
      svc.CashPickup.list('-created_date', 1000),
      svc.CashAudit.list('-audit_date', 1000),
      svc.Robbery.list('-created_date', 500),
      svc.RegisterLog.list('-created_date', 1000),
      svc.TillCheckout.list('-checkout_date', 1000),
      svc.CashReportSnapshot.filter({ report_date: day }),
    ]);
    // The relay's privileged routes want its shared secret; without it the print
    // POST is refused and the failure is recorded on the snapshot.
    const credentials = await svc.RelayCredential.filter({ status: 'active' });

    const activeStores = stores.filter((s) => s.status !== 'inactive');
    const targets = activeStores.length ? activeStores : [{ store_number: '', name: '' }];
    const cashouts = logs.filter((l) => l.detail && l.detail.includes('Gift card cash out'));
    const results = [];

    for (const store of targets) {
      const storeId = store.store_number || '';
      // Cash records carry only a register reference, so the store scope is
      // resolved through that store's registers.
      const regIds = new Set(
        registers.filter((r) => (r.store_id || '') === storeId).map((r) => r.register_id)
      );
      const mine = (rows) => (targets.length === 1 ? rows : rows.filter((r) => regIds.has(r.register_id)));

      // The day's own records, kept so the printed copy can show the per-register
      // detail (bag numbers, who took what) rather than only store totals.
      const dayRecords = {
        deposits: filterDay(mine(deposits), 'report_date', day),
        advances: filterDay(mine(advances), 'created_date', day),
        pickups: filterDay(mine(pickups), 'created_date', day),
        audits: filterDay(mine(audits), 'audit_date', day),
        robberies: filterDay(mine(robberies), 'created_date', day),
        giftCardCashouts: filterDay(mine(cashouts), 'created_date', day),
        tillCheckouts: mine(tills).filter(
          (t) => String(t.checkout_date || '').slice(0, 10) === day || String(t.checkin_date || '').slice(0, 10) === day
        ),
      };

      const totals = computeDayTotals({ day, ...dayRecords, tillCheckouts: mine(tills) });

      const settings =
        allSettings.find((s) => (s.store_id || '') === storeId) ||
        allSettings.find((s) => !s.store_id) ||
        null;
      const storeName = store.name || settings?.store_name || 'Store';
      const lines = buildReportLines(totals, storeName, dayRecords);

      let printed = false;
      let printError = '';
      try {
        const cred = credentials.find((c) => (c.store_id || '') === storeId);
        await printToStore(store, settings, lines, storeName, cred?.api_key || '');
        printed = true;
      } catch (e) {
        printError = e.message;
      }

      const record = {
        store_id: storeId,
        report_date: day,
        totals,
        report_text: buildReportText(totals, storeName, dayRecords),
        printed,
        print_error: printError,
        generated_at: new Date().toISOString(),
      };
      const prior = existing.find((r) => (r.store_id || '') === storeId);
      if (prior) await svc.CashReportSnapshot.update(prior.id, record);
      else await svc.CashReportSnapshot.create(record);

      results.push({ store_id: storeId, printed, print_error: printError });
    }

    await svc.AuditTrail.create({
      action: 'Daily Cash Report Consolidated',
      category: 'system',
      description: `Archived and printed the ${day} cash report for ${results.length} store(s) using the detailed per-register format (till bags with check-out/check-in operators, advances, pickups and deposit variance per register, then store totals). Printed: ${results.filter((r) => r.printed).length}.`,
      actor_name: user ? user.full_name || 'Admin' : 'System (scheduled)',
      actor_role: user ? 'admin' : 'system',
      page: '/admin/cash-reconciliation',
    });

    return Response.json({ success: true, report_date: day, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}