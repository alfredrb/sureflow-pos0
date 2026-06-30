import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Package, Receipt, Monitor, DollarSign, TrendingUp, ShoppingCart, AlertTriangle, Bell } from "lucide-react";
import ShiftCalendarView from "@/components/ShiftCalendarView";
import InventoryReorderSuggestions from "@/components/InventoryReorderSuggestions";
import StaffingVsRevenueChart from "@/components/StaffingVsRevenueChart";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ operators: 0, products: 0, transactions: 0, registers: 0, revenue: 0, lowStock: 0, emergencies: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [operators, products, transactions, registers, alerts] = await Promise.all([
        base44.entities.Operator.list(),
        base44.entities.Product.list(),
        base44.entities.Transaction.list("-created_date", 50),
        base44.entities.Register.list(),
        base44.entities.EmergencyAlert.filter({ status: "active" })
      ]);
      const revenue = transactions.filter(t => t.status === "completed").reduce((s, t) => s + (t.total || 0), 0);
      const lowStock = products.filter(p => (p.stock_qty || 0) < 10).length;
      setStats({ operators: operators.length, products: products.length, transactions: transactions.length, registers: registers.length, revenue, lowStock, emergencies: alerts.length });
      setRecentTx(transactions.slice(0, 8));
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "bg-emerald-500" },
    { label: "Transactions", value: stats.transactions, icon: ShoppingCart, color: "bg-blue-500" },
    { label: "Products", value: stats.products, icon: Package, color: "bg-violet-500" },
    { label: "Operators", value: stats.operators, icon: Users, color: "bg-amber-500" },
    { label: "Registers", value: stats.registers, icon: Monitor, color: "bg-cyan-500" },
    { label: "Emergencies", value: stats.emergencies, icon: Bell, color: stats.emergencies > 0 ? "bg-red-600" : "bg-red-500" },
    { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: "bg-orange-500" },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">System overview and recent activity</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-gray-100 shadow-sm">
              <div className={`w-8 sm:w-9 h-8 sm:h-9 ${c.color} rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3`}>
                <Icon className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-gray-500 text-[10px] sm:text-xs mt-0.5">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-6 sm:mb-8">
        <ShiftCalendarView />
      </div>

      <div className="mb-6 sm:mb-8">
        <StaffingVsRevenueChart />
      </div>

      <div className="mb-6 sm:mb-8 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Inventory Reorder Suggestions</h2>
          <p className="text-sm text-gray-500 mt-1">Based on peak time sales patterns</p>
        </div>
        <InventoryReorderSuggestions />
      </div>

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
    </div>
  );
}