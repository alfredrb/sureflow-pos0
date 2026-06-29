import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only function
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const today = new Date().toISOString().split("T")[0];
    
    // Fetch all transactions for today
    const transactions = await base44.asServiceRole.entities.Transaction.list();
    const filteredTx = transactions.filter((tx) => {
      const txDate = tx.created_date?.split("T")[0];
      return txDate === today;
    });

    // Fetch all registers
    const registers = await base44.asServiceRole.entities.Register.list();
    
    // Calculate totals
    let totalRevenue = 0;
    let totalRefunds = 0;
    let totalTransactions = 0;
    let totalItemsSold = 0;
    const categorySales = {};
    const categoryRevenue = {};
    const paymentBreakdown = {};
    const registerDetails = {};

    // Process transactions
    for (const tx of filteredTx) {
      if (tx.status === "voided") continue;
      
      totalTransactions++;
      const isRefund = tx.status === "refunded";
      
      if (isRefund) {
        totalRefunds += Math.abs(tx.total || 0);
      } else {
        totalRevenue += tx.total || 0;
      }

      // Payment breakdown
      const method = tx.payment_method || "cash";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + (tx.total || 0);

      // Register details
      if (!registerDetails[tx.register_id]) {
        const reg = registers.find((r) => r.id === tx.register_id);
        registerDetails[tx.register_id] = {
          register_id: tx.register_id,
          register_name: reg?.name || "Unknown",
          transactions: 0,
          revenue: 0,
          refunds: 0
        };
      }
      registerDetails[tx.register_id].transactions++;
      if (isRefund) {
        registerDetails[tx.register_id].refunds += Math.abs(tx.total || 0);
      } else {
        registerDetails[tx.register_id].revenue += tx.total || 0;
      }

      // Process items
      if (tx.items && Array.isArray(tx.items)) {
        for (const item of tx.items) {
          const qty = item.qty || 0;
          totalItemsSold += qty;
          
          // Skip category tracking for now (would require fetching each product)
        }
      }
    }

    // Check if report already exists
    const existing = await base44.asServiceRole.entities.EODReport.list();
    const existingReport = existing.find((r) => r.report_date === today);

    const reportData = {
      report_date: today,
      total_transactions: totalTransactions,
      total_revenue: totalRevenue,
      total_refunds: totalRefunds,
      net_revenue: totalRevenue - totalRefunds,
      total_items_sold: totalItemsSold,
      category_sales: categorySales,
      category_revenue: categoryRevenue,
      register_details: Object.values(registerDetails),
      payment_breakdown: paymentBreakdown
    };

    if (existingReport) {
      await base44.asServiceRole.entities.EODReport.update(existingReport.id, reportData);
    } else {
      await base44.asServiceRole.entities.EODReport.create(reportData);
    }

    return Response.json({ success: true, report_date: today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});