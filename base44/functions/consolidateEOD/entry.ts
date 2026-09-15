import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// End of Day consolidation.
//
// Produces ONE report PER STORE per day, not one report for the whole chain. A single
// combined report is unusable in a multi-store chain: a store manager cannot be shown
// another store's takings, and HQ cannot ask "what did store 002 do yesterday" from a
// merged number. The store is read off the transaction, falling back to the register it
// was rung on for older sales written before transactions carried a store.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only function
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const today = new Date().toISOString().split("T")[0];

    const [transactions, registers, existing] = await Promise.all([
      base44.asServiceRole.entities.Transaction.list(),
      base44.asServiceRole.entities.Register.list(),
      base44.asServiceRole.entities.EODReport.list(),
    ]);

    // register_id on a transaction is the register's OWN id string (REG-01), not the
    // record id — matching on the record id silently made every register "Unknown".
    const registerByRegId = {};
    for (const r of registers) {
      if (r.register_id) registerByRegId[r.register_id] = r;
    }

    const storeOf = (tx) =>
      tx.store_id || registerByRegId[tx.register_id]?.store_id || "";

    // Training sales are practice and must never reach a financial report.
    const todays = transactions.filter((tx) => {
      if (tx.training_mode) return false;
      const txDate = (tx.sale_date || tx.created_date || "").split("T")[0];
      return txDate === today;
    });

    // Group the day's sales by store, then build one report per group.
    const byStore = {};
    for (const tx of todays) {
      const store = storeOf(tx);
      (byStore[store] ||= []).push(tx);
    }

    const results = [];

    for (const [storeId, storeTx] of Object.entries(byStore)) {
      let totalRevenue = 0;
      let totalRefunds = 0;
      let totalTransactions = 0;
      let totalItemsSold = 0;
      const paymentBreakdown = {};
      const registerDetails = {};

      for (const tx of storeTx) {
        if (tx.status === "voided") continue;

        totalTransactions++;
        const isRefund = tx.status === "refunded";

        if (isRefund) {
          totalRefunds += Math.abs(tx.total || 0);
        } else {
          totalRevenue += tx.total || 0;
        }

        const method = tx.payment_method || "cash";
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (tx.total || 0);

        if (!registerDetails[tx.register_id]) {
          registerDetails[tx.register_id] = {
            register_id: tx.register_id,
            register_name: registerByRegId[tx.register_id]?.name || "Unknown",
            transactions: 0,
            revenue: 0,
            refunds: 0,
          };
        }
        registerDetails[tx.register_id].transactions++;
        if (isRefund) {
          registerDetails[tx.register_id].refunds += Math.abs(tx.total || 0);
        } else {
          registerDetails[tx.register_id].revenue += tx.total || 0;
        }

        if (Array.isArray(tx.items)) {
          for (const item of tx.items) {
            totalItemsSold += item.qty || 0;
          }
        }
      }

      const reportData = {
        report_date: today,
        store_id: storeId,
        total_transactions: totalTransactions,
        total_revenue: totalRevenue,
        total_refunds: totalRefunds,
        net_revenue: totalRevenue - totalRefunds,
        total_items_sold: totalItemsSold,
        register_details: Object.values(registerDetails),
        payment_breakdown: paymentBreakdown,
      };

      // Upsert on date + store, so re-running the close updates that store's own report
      // instead of adding a second one for the same day.
      const existingReport = existing.find(
        (r) => r.report_date === today && (r.store_id || "") === storeId
      );

      if (existingReport) {
        await base44.asServiceRole.entities.EODReport.update(existingReport.id, reportData);
      } else {
        await base44.asServiceRole.entities.EODReport.create(reportData);
      }

      results.push({ store_id: storeId, transactions: totalTransactions, revenue: totalRevenue });
    }

    return Response.json({ success: true, report_date: today, stores: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});