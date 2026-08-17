import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Users, Package, Monitor, DollarSign, ShoppingCart, AlertTriangle, Bell, Siren, Wrench, HardDrive, ShieldAlert, Percent, RotateCcw, FolderSearch, Award, Gift, Scale, SlidersHorizontal, TrendingUp, Tag, Clock, Barcode, Boxes, ClipboardList, TrendingDown, Ban, Fingerprint, PackageMinus } from "lucide-react";
import ShiftCalendarView from "@/components/ShiftCalendarView";
import InventoryReorderSuggestions from "@/components/InventoryReorderSuggestions";
import StaffingVsRevenueChart from "@/components/StaffingVsRevenueChart";
import AuditFrequencyChart from "@/components/AuditFrequencyChart";
import StolenItemsTrendChart from "@/components/lossprevention/StolenItemsTrendChart";
import DashboardCustomizer from "@/components/DashboardCustomizer";
import SystemHealthPanel from "@/components/SystemHealthPanel";
import { loadConfig, saveConfig, mergeCustom, loadRoleDefaultOverrides, STORAGE_PREFIX } from "@/lib/dashboardConfig";
import Sparkline from "@/components/Sparkline";
import { dailySeriesTrailing } from "@/lib/dailySeries";

export default function AdminDashboard() {
  const operator = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator") || "null"); } catch { return null; } })();
  const [config, setConfig] = useState(() => loadConfig(operator?.operator_id, operator?.role));
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [stats, setStats] = useState({ operators: 0, products: 0, transactions: 0, registers: 0, revenue: 0, avgSale: 0, refunds: 0, refundAmount: 0, lowStock: 0, outOfStock: 0, recalled: 0, promotional: 0, upcomingReleases: 0, emergencies: 0, systemAlerts: 0, maintenanceOpen: 0, hardwareIssues: 0, lossEvents: 0, voids: 0, openCases: 0, totalStolen: 0, loyaltyMembers: 0, activeGiftCards: 0, giftBalance: 0, cashDiscrepancies: 0, serializedProducts: 0, serializedInStock: 0, openClaims: 0, claimsValue: 0, profitLossTotal: 0, noReceiptBlocked: 0, timeTheftFlags: 0, shrinkageLoss: 0, appVersion: "—" });
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleOverrides, setRoleOverrides] = useState({});

  useEffect(() => { saveConfig(operator?.operator_id, config); }, [config]);

  useEffect(() => {
    (async () => {
      const map = await loadRoleDefaultOverrides();
      setRoleOverrides(map);
      const hasPersonal = !!(operator?.operator_id && localStorage.getItem(STORAGE_PREFIX + operator.operator_id));
      if (!hasPersonal) setConfig(mergeCustom(operator?.role, map[operator?.role]));
    })();
  }, []);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    // Fetch sequentially to avoid bursting concurrent requests past the API rate limit.
    const operators = await base44.entities.Operator.list();
    const products = await base44.entities.Product.list();
    const transactions = await base44.entities.Transaction.list("-created_date", 50);
    const registers = await base44.entities.Register.list();
    const alerts = await base44.entities.EmergencyAlert.filter({ status: "active" });
    const sysAlerts = await base44.entities.SystemAlert.filter({ status: "active" });
    const maintLogs = await base44.entities.MaintenanceLog.list("-service_date", 200);
    const regLogs = await base44.entities.RegisterLog.list("-created_date", 200);
    const investigations = await base44.entities.Investigation.list("-created_date", 200);
    const loyalty = await base44.entities.LoyaltyMember.list();
    const giftcards = await base44.entities.GiftCard.list();
    const audits = await base44.entities.CashAudit.list("-audit_date", 200);
    const serializedStock = await base44.entities.SerializedStock.list();
    const claims = await base44.entities.Claim.list("-date_created", 200);
    const profitLoss = await base44.entities.ProfitLoss.list();
    const noReceipt = await base44.entities.NoReceiptCustomer.list();
    const timeDiscrepancies = await base44.entities.TimeClockDiscrepancy.list();
    const appVersions = await base44.entities.AppVersion.list("-release_date", 1);
    const completed = transactions.filter(t => t.status === "completed");
    const revenue = completed.reduce((s, t) => s + (t.total || 0), 0);
    const avgSale = completed.length ? revenue / completed.length : 0;
    const refunds = transactions.filter(t => t.status === "refunded");
    const refundAmount = refunds.reduce((s, t) => s + Math.abs(t.total || 0), 0);
    const lowStock = products.filter(p => (p.stock_qty || 0) < 10).length;
    const outOfStock = products.filter(p => (p.stock_qty || 0) <= 0).length;
    const recalled = products.filter(p => p.recalled).length;
    const promotional = products.filter(p => p.promotional).length;
    const upcomingReleases = products.filter(p => p.release_date && new Date(p.release_date) > new Date()).length;
    const maintenanceOpen = maintLogs.filter(m => m.status !== "completed").length;
    const hardwareIssues = registers.filter(r => r.status !== "online" || r.printer_status === "disconnected" || r.scanner_status === "disconnected").length;
    const sevenAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentLossLogs = regLogs.filter(l => new Date(l.created_date) >= sevenAgo);
    const voids = recentLossLogs.filter(l => l.event_type === "void").length;
    const lossEvents = recentLossLogs.filter(l => l.event_type === "void" || l.event_type === "override").length;
    const openCases = investigations.filter(i => i.status !== "closed").length;
    const totalStolen = investigations.filter(i => i.type === "stock_theft").reduce((s, i) => s + (Number(i.amount_impact) || 0), 0);
    const loyaltyMembers = loyalty.filter(l => l.status === "active").length;
    const activeGiftCards = giftcards.filter(g => g.status === "active").length;
    const giftBalance = giftcards.reduce((s, g) => s + (g.balance || 0), 0);
    const cashDiscrepancies = audits.filter(a => Math.abs(a.discrepancy || 0) > 0.01).length;
    const serializedProducts = products.filter(p => p.serialized).length;
    const serializedInStock = serializedStock.filter(s => s.status === "in_stock").length;
    const openClaims = claims.filter(c => c.status === "open").length;
    const claimsValue = claims.filter(c => c.status === "open").reduce((s, c) => s + (Number(c.total_cost) || 0), 0);
    const profitLossTotal = profitLoss.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const noReceiptBlocked = noReceipt.filter(n => n.disabled).length;
    const timeTheftFlags = timeDiscrepancies.filter(d => d.status === "open").length;
    const shrinkageLoss = totalStolen + profitLossTotal;
    const appVersion = appVersions[0]?.version || "—";
    const fourteenAgo = new Date(Date.now() - 13 * 24 * 3600 * 1000);
    const regLogs14 = regLogs.filter(l => new Date(l.created_date) >= fourteenAgo);
    const cashDiscAudits = audits.filter(a => Math.abs(a.discrepancy || 0) > 0.01);
    const spark = {
      revenue: dailySeriesTrailing(completed, "created_date", t => t.total || 0, 14),
      transactions: dailySeriesTrailing(transactions, "created_date", () => 1, 14),
      refunds: dailySeriesTrailing(refunds, "created_date", () => 1, 14),
      refundAmount: dailySeriesTrailing(refunds, "created_date", t => Math.abs(t.total) || 0, 14),
      voids: dailySeriesTrailing(regLogs14.filter(l => l.event_type === "void"), "created_date", () => 1, 14),
      lossEvents: dailySeriesTrailing(regLogs14.filter(l => l.event_type === "void" || l.event_type === "override"), "created_date", () => 1, 14),
      cashDiscrepancies: dailySeriesTrailing(cashDiscAudits, "audit_date", () => 1, 14),
    };
    setStats({ operators: operators.length, products: products.length, transactions: transactions.length, registers: registers.length, revenue, avgSale, refunds: refunds.length, refundAmount, lowStock, outOfStock, recalled, promotional, upcomingReleases, emergencies: alerts.length, systemAlerts: sysAlerts.length, maintenanceOpen, hardwareIssues, lossEvents, voids, openCases, totalStolen, loyaltyMembers, activeGiftCards, giftBalance, cashDiscrepancies, serializedProducts, serializedInStock, openClaims, claimsValue, profitLossTotal, noReceiptBlocked, timeTheftFlags, shrinkageLoss, appVersion, spark });
    setRecentTx(transactions.slice(0, 8));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync(["Transaction", "EmergencyAlert", "Register", "SystemAlert"], load, { intervalMs: 30000 });

  const allCards = [
    { category: "sales", label: "Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "bg-emerald-500", spark: { data: stats.spark?.revenue, color: "#10b981" } },
    { category: "sales", label: "Avg Sale", value: `$${stats.avgSale.toFixed(2)}`, icon: Percent, color: "bg-emerald-600" },
    { category: "sales", label: "Transactions", value: stats.transactions, icon: ShoppingCart, color: "bg-blue-500", spark: { data: stats.spark?.transactions, color: "#3b82f6" } },
    { category: "sales", label: "Refunds", value: stats.refunds, icon: RotateCcw, color: "bg-rose-500", spark: { data: stats.spark?.refunds, color: "#f43f5e" } },
    { category: "sales", label: "Refund Amount", value: `$${stats.refundAmount.toFixed(2)}`, icon: DollarSign, color: "bg-rose-600", spark: { data: stats.spark?.refundAmount, color: "#e11d48" } },
    { category: "inventory", label: "Products", value: stats.products, icon: Package, color: "bg-violet-500" },
    { category: "inventory", label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: "bg-orange-500" },
    { category: "inventory", label: "Out of Stock", value: stats.outOfStock, icon: AlertTriangle, color: stats.outOfStock > 0 ? "bg-red-600" : "bg-orange-500" },
    { category: "inventory", label: "Recalled", value: stats.recalled, icon: AlertTriangle, color: stats.recalled > 0 ? "bg-red-600" : "bg-rose-500" },
    { category: "inventory", label: "Promotional", value: stats.promotional, icon: Tag, color: "bg-indigo-500" },
    { category: "inventory", label: "Upcoming Releases", value: stats.upcomingReleases, icon: Clock, color: stats.upcomingReleases > 0 ? "bg-amber-600" : "bg-amber-500" },
    { category: "inventory", label: "Serialized Products", value: stats.serializedProducts, icon: Barcode, color: "bg-purple-600" },
    { category: "inventory", label: "Serialized In Stock", value: stats.serializedInStock, icon: Boxes, color: "bg-fuchsia-500" },
    { category: "system", label: "Operators", value: stats.operators, icon: Users, color: "bg-amber-500" },
    { category: "system", label: "Registers", value: stats.registers, icon: Monitor, color: "bg-cyan-500" },
    { category: "system", label: "Emergencies", value: stats.emergencies, icon: Bell, color: stats.emergencies > 0 ? "bg-red-600" : "bg-red-500" },
    { category: "system", label: "System Alerts", value: stats.systemAlerts, icon: Siren, color: stats.systemAlerts > 0 ? "bg-red-600" : "bg-slate-500" },
    { category: "system", label: "Maintenance Open", value: stats.maintenanceOpen, icon: Wrench, color: "bg-amber-500" },
    { category: "system", label: "Hardware Issues", value: stats.hardwareIssues, icon: HardDrive, color: stats.hardwareIssues > 0 ? "bg-red-600" : "bg-cyan-500" },
    { category: "system", label: "App Version", value: stats.appVersion, icon: Tag, color: "bg-slate-600" },
    { category: "loss", label: "Loss Events (7d)", value: stats.lossEvents, icon: ShieldAlert, color: "bg-orange-600", spark: { data: stats.spark?.lossEvents, color: "#f97316" } },
    { category: "loss", label: "Voids (7d)", value: stats.voids, icon: RotateCcw, color: "bg-amber-500", spark: { data: stats.spark?.voids, color: "#f59e0b" } },
    { category: "loss", label: "Open Cases", value: stats.openCases, icon: FolderSearch, color: stats.openCases > 0 ? "bg-amber-600" : "bg-amber-500" },
    { category: "loss", label: "Total Stolen", value: `$${stats.totalStolen.toFixed(2)}`, icon: ShieldAlert, color: "bg-red-600" },
    { category: "loss", label: "Cash Discrepancies", value: stats.cashDiscrepancies, icon: Scale, color: stats.cashDiscrepancies > 0 ? "bg-orange-600" : "bg-slate-500", spark: { data: stats.spark?.cashDiscrepancies, color: "#64748b" } },
    { category: "loss", label: "Open Claims", value: stats.openClaims, icon: ClipboardList, color: stats.openClaims > 0 ? "bg-amber-600" : "bg-amber-500" },
    { category: "loss", label: "Claims Value", value: `$${stats.claimsValue.toFixed(2)}`, icon: DollarSign, color: "bg-rose-600" },
    { category: "loss", label: "Profit Loss", value: `$${stats.profitLossTotal.toFixed(2)}`, icon: TrendingDown, color: "bg-red-500" },
    { category: "loss", label: "No-Receipt Blocked", value: stats.noReceiptBlocked, icon: Ban, color: stats.noReceiptBlocked > 0 ? "bg-red-600" : "bg-slate-500" },
    { category: "loss", label: "Time Theft Flags", value: stats.timeTheftFlags, icon: Fingerprint, color: stats.timeTheftFlags > 0 ? "bg-orange-600" : "bg-slate-500" },
    { category: "loss", label: "Shrinkage Loss", value: `$${stats.shrinkageLoss.toFixed(2)}`, icon: PackageMinus, color: "bg-red-700" },
    { category: "loyalty", label: "Loyalty Members", value: stats.loyaltyMembers, icon: Award, color: "bg-pink-500" },
    { category: "loyalty", label: "Gift Cards", value: stats.activeGiftCards, icon: Gift, color: "bg-indigo-500" },
    { category: "loyalty", label: "Gift Balance", value: `$${stats.giftBalance.toFixed(2)}`, icon: Gift, color: "bg-indigo-600" },
  ];
  const CATEGORIES = [
    { key: "sales", label: "Sales", icon: DollarSign, color: "bg-emerald-500" },
    { key: "inventory", label: "Inventory", icon: Package, color: "bg-violet-500" },
    { key: "system", label: "System & Alerts", icon: HardDrive, color: "bg-cyan-500" },
    { key: "loss", label: "Loss Prevention", icon: ShieldAlert, color: "bg-orange-500" },
    { key: "loyalty", label: "Loyalty & Gift Cards", icon: Award, color: "bg-pink-500" },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  const SectionHeader = ({ icon: Icon, title, subtitle, color }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-7 h-7 ${color} rounded-lg flex items-center justify-center`}><Icon className="w-4 h-4 text-white" /></div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full">
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">System overview and recent activity</p>
        </div>
        <button onClick={() => setCustomizeOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <SlidersHorizontal className="w-4 h-4" /> <span className="hidden sm:inline">Customize</span>
        </button>
      </div>

      {CATEGORIES.map(cat => {
        const catCards = allCards.filter(c => c.category === cat.key && config.metrics[cat.key]);
        if (catCards.length === 0) return null;
        const CatIcon = cat.icon;
        return (
          <div key={cat.key} className="mb-6 sm:mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 ${cat.color} rounded-lg flex items-center justify-center`}><CatIcon className="w-4 h-4 text-white" /></div>
              <h2 className="text-base font-semibold text-gray-900">{cat.label}</h2>
              <span className="text-xs text-gray-400">{catCards.length}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
              {catCards.map(c => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
                    <div className={`w-8 sm:w-9 h-8 sm:h-9 ${c.color} rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3`}>
                      <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" />
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{c.value}</p>
                    <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{c.label}</p>
                    {c.spark && c.spark.data && <div className="mt-1 -mx-1"><Sparkline data={c.spark.data} color={c.spark.color} width={96} height={22} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {config.graphs.sales && (
        <section className="mb-6 sm:mb-8 space-y-6">
          <SectionHeader icon={TrendingUp} title="Sales & Staffing" subtitle="Revenue, staffing, and recent sales activity" color="bg-blue-500" />
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-center gap-3 sm:gap-5">
            <div className="flex-shrink-0">
              <p className="text-[10px] sm:text-xs text-gray-500">14-Day Revenue Trend</p>
              <p className="text-base sm:text-lg font-bold text-gray-900">${stats.revenue.toFixed(2)}</p>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <Sparkline data={stats.spark?.revenue || []} color="#10b981" width={300} height={36} bars showAvg={false} />
            </div>
          </div>
          <ShiftCalendarView />
          <StaffingVsRevenueChart />
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-3 sm:p-5 border-b border-gray-100">
              <h2 className="font-semibold text-sm sm:text-base text-gray-900">Recent Transactions</h2>
            </div>
            <div className="divide-y divide-gray-50 overflow-x-auto">
              {recentTx.length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-gray-400 text-xs sm:text-sm">No transactions yet</div>
              ) : recentTx.map(tx => (
                <div key={tx.id} className="px-3 sm:px-5 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tx.status === "completed" ? "bg-emerald-500" : tx.status === "voided" ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{tx.transaction_id}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400 truncate">{tx.operator_name} • {tx.register_id}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs sm:text-sm font-semibold ${tx.status === "refunded" || tx.status === "exchanged" ? "text-red-600" : "text-emerald-600"}`}>
                      {(tx.status === "refunded" || tx.status === "exchanged") ? "−" : ""}${(Math.abs(tx.total) || 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-400">{tx.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {config.graphs.loss && (
        <section className="mb-6 sm:mb-8 space-y-6">
          <SectionHeader icon={ShieldAlert} title="Loss Prevention" subtitle="Audit patterns and stolen item trends" color="bg-amber-500" />
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Register Audit Frequency (Last 30 Days)</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Tracks audit frequency and discrepancy patterns by operator</p>
            </div>
            <AuditFrequencyChart />
          </div>
          <StolenItemsTrendChart rangeDays={30} />
        </section>
      )}

      {config.graphs.inventory && (
        <section className="mb-6 sm:mb-8 space-y-6">
          <SectionHeader icon={Package} title="Inventory" subtitle="Reorder guidance based on sales patterns" color="bg-violet-500" />
          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-6">
            <div className="mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Inventory Reorder Suggestions</h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Based on peak time sales patterns</p>
            </div>
            <InventoryReorderSuggestions />
          </div>
        </section>
      )}

      {config.graphs.system && (
        <section className="mb-6 sm:mb-8 space-y-6">
          <SectionHeader icon={HardDrive} title="System Health" subtitle="Register, hardware, and maintenance status" color="bg-cyan-500" />
          <SystemHealthPanel />
        </section>
      )}

      <DashboardCustomizer open={customizeOpen} onClose={() => setCustomizeOpen(false)} config={config} onChange={setConfig} onReset={() => setConfig(mergeCustom(operator?.role, roleOverrides[operator?.role]))} />
    </div>
  );
}