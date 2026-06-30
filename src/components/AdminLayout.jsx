import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Users, Receipt, Keyboard, BarChart3, Package, Monitor, Network, Settings, ChevronLeft, Menu, LogOut, ClipboardList, MonitorSpeaker, Percent, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: BarChart3 },
  { label: "Operators", path: "/admin/operators", icon: Users },
  { label: "Inventory", path: "/admin/inventory", icon: Package },
  { label: "Transactions", path: "/admin/transactions", icon: Receipt },
  { label: "Function Keys", path: "/admin/function-keys", icon: Keyboard },
  { label: "Receipt Setup", path: "/admin/receipt", icon: Receipt },
  { label: "Registers", path: "/admin/registers", icon: Monitor },
  { label: "Network", path: "/admin/network", icon: Network },
  { label: "Register Log", path: "/admin/register-log", icon: ClipboardList },
  { label: "Remote Workstation", path: "/admin/remote-workstation", icon: MonitorSpeaker },
  { label: "Discounts", path: "/admin/discounts", icon: Percent },
  { label: "EOD Reports", path: "/admin/eod-reports", icon: Calendar },
  { label: "Cash Reconciliation", path: "/admin/cash-reconciliation", icon: DollarSign },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Poll for pending override requests
    const checkPending = async () => {
      try {
        const requests = await base44.entities.OverrideRequest.filter({ status: "pending" });
        setPendingCount(requests.length);
      } catch (e) {
        // silently fail
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex bg-gray-50 max-w-[1366px] mx-auto">
      {/* Sidebar */}
      <aside className={`bg-[#0f172a] text-white flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex-shrink-0`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm">SurePOS Admin</span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            const hasAlert = item.label === "Remote Workstation" && pendingCount > 0;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && (
                  <div className="flex items-center gap-2 flex-1">
                    <span>{item.label}</span>
                    {hasAlert && (
                      <span className="ml-auto flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        {pendingCount}
                      </span>
                    )}
                  </div>
                )}
                {collapsed && hasAlert && (
                  <span className="absolute right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-1">
          <Link to="/pos" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors`}>
            <Monitor className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Open POS</span>}
          </Link>
          <button onClick={() => base44.auth.logout("/")} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full`}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}