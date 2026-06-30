import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Monitor, Settings, ShoppingCart, Users, Package, Receipt, Keyboard, Network, Percent, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const [requests, deposits, eodReports] = await Promise.all([
          base44.entities.OverrideRequest.filter({ status: "pending" }),
          base44.entities.EODCashDeposit.list("-created_date", 100),
          base44.entities.EODReport.list("-report_date", 30)
        ]);
        
        let count = requests.length;
        const today = new Date().toISOString().split('T')[0];
        const todayDeposits = deposits.filter(d => d.report_date === today);
        const unresolvedCount = todayDeposits.filter(d => Math.abs(d.difference || 0) > 0.01).length;
        
        const lastEOD = eodReports[0];
        const lastEODDate = lastEOD ? lastEOD.report_date : null;
        const pendingEODCount = lastEODDate !== today ? 1 : 0;
        
        setPendingCount(count + unresolvedCount + pendingEODCount);
      } catch (e) {
        // silently fail
      }
    };
    checkAlerts();
    const interval = setInterval(checkAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-[#0a0e27] to-slate-900 flex flex-col items-center justify-center p-6 max-w-[1024px] max-h-[768px] mx-auto overflow-hidden">
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <span className="text-blue-200/60 text-xs">{user?.full_name || "User"}</span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
            <AlertCircle className="w-3 h-3" />
            {pendingCount}
          </span>
        )}
      </div>

      <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <Monitor className="w-7 h-7 text-white" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">Supermart</h1>
      <p className="text-blue-300/50 text-sm mb-12">Point of Sale Management System</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        <Link to="/pos"
          className="flex items-center gap-4 bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5 shadow-lg shadow-blue-600/20">
          <ShoppingCart className="w-6 h-6" />
          <div>
            <p className="font-semibold">POS Terminal</p>
            <p className="text-blue-200 text-xs">Open the register</p>
          </div>
        </Link>
        <Link to="/admin"
          className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white p-5 rounded-2xl transition-all hover:-translate-y-0.5">
          <Settings className="w-6 h-6 text-blue-400" />
          <div>
            <p className="font-semibold">Admin Dashboard</p>
            <p className="text-blue-300/50 text-xs">Manage your system</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-12 w-full max-w-2xl">
        {[
          { icon: Users, label: "Operators", to: "/admin/operators" },
          { icon: Package, label: "Inventory", to: "/admin/inventory" },
          { icon: Receipt, label: "Transactions", to: "/admin/transactions" },
          { icon: Keyboard, label: "Fn Keys", to: "/admin/function-keys" },
          { icon: Monitor, label: "Registers", to: "/admin/registers" },
          { icon: Percent, label: "Discounts", to: "/admin/discounts" },
        ].map(item => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}
              className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl text-blue-300/40 hover:text-blue-200 hover:bg-white/5 transition-colors">
              <Icon className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}