import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Users, Receipt, Keyboard, BarChart3, Package, Monitor, Network, Settings, ChevronLeft, Menu, LogOut, ClipboardList, MonitorSpeaker, Percent, Calendar, DollarSign, AlertCircle, Volume2, VolumeX, AlertTriangle, Clock, CreditCard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { playChime, getSoundEnabled, setSoundEnabled } from "@/lib/audioAlert";

const navItems = [
  { label: "Dashboard", path: "/admin", icon: BarChart3 },
  { label: "Staff Report", path: "/admin/staff-report", icon: BarChart3 },
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
  { label: "Payroll", path: "/admin/payroll", icon: DollarSign },
  { label: "Emergency Log", path: "/admin/emergency-log", icon: AlertTriangle },
  { label: "Shift Scheduling", path: "/admin/shift-scheduling", icon: Clock },
  { label: "Gift Cards", path: "/admin/gift-cards", icon: CreditCard }
  ];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled());
  const [adminOperator, setAdminOperator] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const storedOperator = sessionStorage.getItem("admin_operator");
    if (!storedOperator) {
      navigate("/admin/login");
    } else {
      setAdminOperator(JSON.parse(storedOperator));
    }
  }, [navigate]);

  useEffect(() => {
    let previousCount = 0;
    // Poll for pending override requests and EOD issues
    const checkAlerts = async () => {
      try {
        const [requests, deposits, eodReports] = await Promise.all([
          base44.entities.OverrideRequest.filter({ status: "pending" }),
          base44.entities.EODCashDeposit.list("-created_date", 100),
          base44.entities.EODReport.list("-report_date", 30)
        ]);
        
        // Count pending overrides
        let count = requests.length;
        
        // Count registers with unresolved variances (difference not matching 0)
        const today = new Date().toISOString().split('T')[0];
        const todayDeposits = deposits.filter(d => d.report_date === today);
        const unresolvedCount = todayDeposits.filter(d => Math.abs(d.difference || 0) > 0.01).length;
        
        // Count pending EOD reports (today's date with no EOD report yet)
        const lastEOD = eodReports[0];
        const lastEODDate = lastEOD ? lastEOD.report_date : null;
        const pendingEODCount = lastEODDate !== today ? 1 : 0;
        
        const newCount = count + unresolvedCount + pendingEODCount;
        
        // Play chime if alerts increased (new alert detected)
        if (newCount > previousCount && soundEnabled) {
          playChime();
        }
        
        previousCount = newCount;
        setPendingCount(newCount);
      } catch (e) {
        // silently fail
      }
    };
    checkAlerts();
    const interval = setInterval(checkAlerts, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [soundEnabled]);

  return (
    <div className="h-screen flex bg-gray-50 max-w-[1366px] mx-auto">
      {/* Sidebar */}
      <aside className={`bg-[#0f172a] text-white flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-64"} flex-shrink-0`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          {!collapsed && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm">SurePOS Admin</span>
              </div>
              {adminOperator && (
                <div className="text-xs text-blue-300/70 pl-10">
                  {adminOperator.full_name}
                </div>
              )}
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
            {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto scrollbar scrollbar-thumb-white/10 scrollbar-track-transparent">
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
          <button 
            onClick={() => { setSoundEnabledState(!soundEnabled); setSoundEnabled(!soundEnabled); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full ${soundEnabled ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-300/50 hover:bg-white/5"}`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && <span>{soundEnabled ? "Sound On" : "Sound Off"}</span>}
          </button>
          <Link to="/pos" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors`}>
            <Monitor className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Open POS</span>}
          </Link>
          <button onClick={() => { sessionStorage.removeItem("admin_operator"); base44.auth.logout("/"); }} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full`}>
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