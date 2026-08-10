import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Users, Receipt, Keyboard, BarChart3, Package, Monitor, Network, Settings, ChevronLeft, Menu, LogOut, ClipboardList, MonitorSpeaker, Percent, Calendar, DollarSign, AlertCircle, Volume2, VolumeX, AlertTriangle, Clock, CreditCard, Trash2, Download, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { playChime, getSoundEnabled, setSoundEnabled } from "@/lib/audioAlert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  { label: "Gift Cards", path: "/admin/gift-cards", icon: CreditCard },
  { label: "Tax Exempt", path: "/admin/tax-exempt", icon: ShieldCheck }
  ];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled());
  const [adminOperator, setAdminOperator] = useState(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStep, setResetStep] = useState("confirm"); // confirm, export, override
  const [overridePin, setOverridePin] = useState("");
  const [resetting, setResetting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

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

  const handleExportBeforeReset = async () => {
    try {
      const [transactions, deposits, audits, advances, pickups, robberies, logs, operators] = await Promise.all([
        base44.entities.Transaction.list("-created_date", 1000),
        base44.entities.EODCashDeposit.list("-created_date", 1000),
        base44.entities.CashAudit.list("-audit_date", 1000),
        base44.entities.CashAdvance.list("-created_date", 1000),
        base44.entities.CashPickup.list("-created_date", 1000),
        base44.entities.Robbery.list("-created_date", 1000),
        base44.entities.RegisterLog.list("-created_date", 1000),
        base44.entities.Operator.list()
      ]);

      const exportData = {
        timestamp: new Date().toISOString(),
        transactions: transactions.length,
        deposits: deposits.length,
        audits: audits.length,
        advances: advances.length,
        pickups: pickups.length,
        robberies: robberies.length,
        logs: logs.length,
        operators: operators.length,
        data: { transactions, deposits, audits, advances, pickups, robberies, logs }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sureflow_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setResetStep("override");
    } catch (e) {
      alert("Error exporting data: " + e.message);
    }
  };

  const handleResetConfirm = async () => {
    if (!overridePin) {
      alert("Please enter manager PIN");
      return;
    }

    const managerOp = adminOperator;
    if (managerOp.pin !== overridePin) {
      alert("Incorrect PIN");
      return;
    }

    setResetting(true);
    try {
      const entitiesToReset = [
        "Transaction",
        "EODCashDeposit",
        "CashAudit",
        "CashAdvance",
        "CashPickup",
        "Robbery",
        "RegisterLog",
        "SODProtocol",
        "EODReport",
        "ShiftAlert",
        "CashLimitAlert",
        "TillCheckout"
      ];

      for (const entityName of entitiesToReset) {
        const records = await base44.entities[entityName].list(undefined, 500);
        if (records && records.length > 0) {
          await base44.entities[entityName].deleteMany({});
        }
      }

      setOverridePin("");
      setResetStep("confirm");
      setResetDialogOpen(false);
      alert("All data has been reset successfully!");
    } catch (e) {
      alert("Error resetting data: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 w-full">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f172a] text-white flex items-center justify-between px-4 h-14 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <span className="font-bold text-sm">SurePOS Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-white/5 rounded-lg">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`bg-[#0f172a] text-white flex flex-col transition-all duration-300 flex-shrink-0
        ${collapsed ? "w-16" : "w-64"}
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
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
          <div className="flex items-center gap-1">
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:inline-flex p-1.5 hover:bg-white/5 rounded-lg transition-colors">
              {collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
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
             onClick={() => setResetDialogOpen(true)}
             className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-orange-400 hover:bg-orange-500/10`}
           >
             <Trash2 className="w-4 h-4 flex-shrink-0" />
             {!collapsed && <span>Reset Data</span>}
           </button>
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
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>

      {/* Reset Data Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Reset All Data</DialogTitle>
            <DialogDescription>
              {resetStep === "confirm" && "This will permanently delete all logs and data from the system."}
              {resetStep === "export" && "Exporting your data..."}
              {resetStep === "override" && "Enter your manager PIN to confirm reset."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {resetStep === "confirm" && (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                  <p className="font-semibold mb-2">Warning: This action cannot be undone!</p>
                  <p>All transactions, deposits, audits, logs, and other operational data will be permanently deleted.</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setResetDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleExportBeforeReset} className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2">
                    <Download className="w-4 h-4" /> Export & Continue
                  </Button>
                </div>
              </>
            )}

            {resetStep === "override" && (
              <>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Manager PIN</label>
                  <Input
                    type="password"
                    placeholder="Enter PIN to confirm"
                    value={overridePin}
                    onChange={(e) => setOverridePin(e.target.value)}
                    disabled={resetting}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setResetStep("confirm");
                      setOverridePin("");
                    }} 
                    className="flex-1"
                    disabled={resetting}
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleResetConfirm} 
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={resetting}
                  >
                    {resetting ? "Resetting..." : "Confirm Reset"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}