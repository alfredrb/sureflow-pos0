import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Users, Receipt, Keyboard, BarChart3, Package, Monitor, Network, Settings, ChevronLeft, Menu, LogOut, ClipboardList, MonitorSpeaker, Percent } from "lucide-react";
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
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

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
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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