import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Package, Receipt, Monitor, DollarSign, TrendingUp, ShoppingCart, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ operators: 0, products: 0, transactions: 0, registers: 0, revenue: 0, lowStock: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [operators, products, transactions, registers] = await Promise.all([
        base44.entities.Operator.list(),
        base44.entities.Product.list(),
        base44.entities.Transaction.list("-created_date", 50),
        base44.entities.Register.list()
      ]);
      const revenue = transactions.filter(t => t.status === "completed").reduce((s, t) => s + (t.total || 0), 0);
      const lowStock = products.filter(p => (p.stock_qty || 0) < 10).length;
      setStats({ operators: operators.length, products: products.length, transactions: transactions.length, registers: registers.length, revenue, lowStock });
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
    { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: "bg-red-500" },
  ];

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">System overview and recent activity</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className={`w-9 h-9 ${c.color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {recentTx.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No transactions yet</div>
          ) : recentTx.map(tx => (
            <div key={tx.id} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${tx.status === "completed" ? "bg-emerald-500" : tx.status === "voided" ? "bg-red-500" : "bg-amber-500"}`} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{tx.transaction_id}</p>
                  <p className="text-xs text-gray-400">{tx.operator_name} • {tx.register_id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">${(tx.total || 0).toFixed(2)}</p>
                <p className="text-xs text-gray-400">{tx.payment_method}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}