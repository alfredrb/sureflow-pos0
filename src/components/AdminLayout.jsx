import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Settings, ChevronLeft, ChevronDown, Menu, LogOut, Monitor, AlertCircle, Volume2, VolumeX, Trash2, Download, BarChart3, Palette } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { adminNavGroups } from "@/lib/adminNav";
import { getSoundEnabled, setSoundEnabled } from "@/lib/audioAlert";
import { getTheme, setTheme } from "@/lib/theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VersionButton from "@/components/VersionButton";
import useAdminAlertCount from "@/hooks/useAdminAlertCount";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [soundEnabled, setSoundEnabledState] = useState(getSoundEnabled());
  const [theme, setThemeState] = useState(getTheme());
  const [adminOperator, setAdminOperator] = useState(null);
  const [permission, setPermission] = useState(null);
  const [openGroups, setOpenGroups] = useState(new Set());
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStep, setResetStep] = useState("confirm");
  const [overridePin, setOverridePin] = useState("");
  const [resetting, setResetting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pendingCount = useAdminAlertCount(soundEnabled);

  const isManager = adminOperator?.role === "manager";
  const isTechnician = adminOperator?.role === "technician";
  const isLossPrevention = adminOperator?.role === "loss_prevention";
  const isVendor = adminOperator?.role === "vendor";
  const TECHNICIAN_PAGES = ["/admin/registers", "/admin/network", "/admin/hardware", "/admin-maintenance-log", "/admin/diagnostics"];
  const LP_PAGES = ["/admin/register-log", "/admin/loss-prevention", "/admin/transactions", "/admin/emergency-log", "/admin-system-alerts", "/admin/eod-reports", "/admin/cash-reconciliation", "/admin-maintenance-log", "/admin/staff-report"];
  const VENDOR_PAGES = ["/admin/inventory", "/admin/vendor-insights"];

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const storedOperator = sessionStorage.getItem("admin_operator");
    if (!storedOperator) { navigate("/admin/login"); }
    else { setAdminOperator(JSON.parse(storedOperator)); }
  }, [navigate]);

  useEffect(() => {
    if (!adminOperator || isManager || isTechnician || isLossPrevention) return;
    let active = true;
    (async () => {
      try {
        const recs = await base44.entities.AdminPermission.filter({ role: adminOperator.role || "csm" });
        if (active) setPermission(recs[0] || null);
      } catch (e) {}
    })();
    return () => { active = false; };
  }, [adminOperator, isManager]);

  const canAccess = (path) => {
    if (path === "/admin") return !isVendor;
    if (isManager) return true;
    if (!adminOperator) return true;
    if (isVendor) return VENDOR_PAGES.includes(path);
    if (isTechnician) return TECHNICIAN_PAGES.includes(path);
    if (isLossPrevention) return LP_PAGES.includes(path);
    if (!permission) return true; // not configured yet => full access
    return (permission.allowed_pages || []).includes(path);
  };

  useEffect(() => {
    if (!adminOperator) return;
    if (isVendor) { navigate("/vendor-dashboard", { replace: true }); return; }
    if (location.pathname === "/admin") return;
    if (!canAccess(location.pathname)) navigate("/admin");
  }, [location.pathname, adminOperator, permission, isVendor]);

  useEffect(() => {
    const g = adminNavGroups.find(gr => gr.items.some(i => i.path === location.pathname));
    if (g) setOpenGroups(prev => new Set(prev).add(g.label));
  }, [location.pathname]);



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
        transactions: transactions.length, deposits: deposits.length, audits: audits.length,
        advances: advances.length, pickups: pickups.length, robberies: robberies.length,
        logs: logs.length, operators: operators.length,
        data: { transactions, deposits, audits, advances, pickups, robberies, logs }
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `sureflow_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      setResetStep("override");
    } catch (e) { alert("Error exporting data: " + e.message); }
  };

  const handleResetConfirm = async () => {
    if (!overridePin) { alert("Please enter manager PIN"); return; }
    if (adminOperator.pin !== overridePin) { alert("Incorrect PIN"); return; }
    setResetting(true);
    try {
      // Note: Transaction records are intentionally preserved so the Peak Time
      // Analysis retains its historical transaction data after a reset.
      const entitiesToReset = ["EODCashDeposit", "CashAudit", "CashAdvance", "CashPickup", "Robbery", "RegisterLog", "SODProtocol", "EODReport", "ShiftAlert", "CashLimitAlert", "TillCheckout"];
      for (const entityName of entitiesToReset) {
        const records = await base44.entities[entityName].list(undefined, 500);
        if (records && records.length > 0) await base44.entities[entityName].deleteMany({});
      }
      setOverridePin(""); setResetStep("confirm"); setResetDialogOpen(false);
      alert("All data has been reset successfully!");
    } catch (e) { alert("Error resetting data: " + e.message); }
    finally { setResetting(false); }
  };

  const filteredGroups = adminNavGroups
    .map(g => ({ ...g, items: g.items.filter(i => canAccess(i.path)) }))
    .filter(g => g.items.length > 0);

  const toggleGroup = (label) => {
    if (collapsed) { setCollapsed(false); setOpenGroups(new Set([label])); }
    else setOpenGroups(prev => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  };

  return (
    <div className={`h-screen flex bg-gray-50 w-full ${theme === "grayscale" ? "theme-grayscale" : ""}`}>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#0f172a] text-white flex items-center justify-between px-4 h-14 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><Settings className="w-4 h-4" /></div>
          <span className="font-bold text-sm">SureFlow POS Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-white/5 rounded-lg"><Menu className="w-5 h-5" /></button>
      </div>

      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}

      <aside className={`bg-[#0f172a] text-white flex flex-col transition-all duration-300 flex-shrink-0
        ${collapsed ? "w-16" : "w-64"}
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          {!collapsed && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><Settings className="w-4 h-4" /></div>
                <span className="font-bold text-sm">SureFlow POS Admin</span>
              </div>
              {adminOperator && (
                <div className="text-xs text-blue-300/70 pl-10">{adminOperator.full_name} · {adminOperator.role === "manager" ? "Manager" : adminOperator.role === "technician" ? "Technician" : adminOperator.role === "loss_prevention" ? "Loss Prevention" : adminOperator.role === "vendor" ? "Vendor" : "CSM"}</div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:inline-flex p-1.5 hover:bg-white/5 rounded-lg transition-colors">{collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar scrollbar-thumb-white/10 scrollbar-track-transparent">
          {canAccess("/admin") && (
          <Link to="/admin" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === "/admin" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Dashboard</span>}
          </Link>
          )}
          {filteredGroups.map(g => {
            const isOpen = openGroups.has(g.label);
            const GIcon = g.icon;
            const groupActive = g.items.some(i => location.pathname === i.path);
            return (
              <div key={g.label} className="mt-1">
                <button onClick={() => toggleGroup(g.label)}
                  title={collapsed ? g.label : ""}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${groupActive ? "text-white" : "text-slate-400 hover:text-white"} hover:bg-white/5`}>
                  <GIcon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="flex-1 text-left font-medium">{g.label}</span>}
                  {!collapsed && <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                </button>
                {isOpen && !collapsed && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {g.items.map(item => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      const hasAlert = item.label === "Remote Workstation" && pendingCount > 0;
                      return (
                        <Link key={item.path} to={item.path}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {hasAlert && <span className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse"><AlertCircle className="w-3 h-3" />{pendingCount}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full text-slate-300">
            <Palette className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <select value={theme} onChange={(e) => { setTheme(e.target.value); setThemeState(e.target.value); }} className="flex-1 bg-transparent text-sm text-slate-200 border-none outline-none cursor-pointer">
                <option value="default" className="bg-slate-800">Theme: Default</option>
                <option value="dark" className="bg-slate-800">Theme: Dark</option>
                <option value="grayscale" className="bg-slate-800">Theme: Grayscale</option>
              </select>
            )}
          </div>
          {isManager && (
            <button onClick={() => setResetDialogOpen(true)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full text-orange-400 hover:bg-orange-500/10">
              <Trash2 className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Reset Data</span>}
            </button>
          )}
          <button onClick={() => { setSoundEnabledState(!soundEnabled); setSoundEnabled(!soundEnabled); }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors w-full ${soundEnabled ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-300/50 hover:bg-white/5"}`}>
            {soundEnabled ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
            {!collapsed && <span>{soundEnabled ? "Sound On" : "Sound Off"}</span>}
          </button>
          <VersionButton collapsed={collapsed} canManage={isManager} adminOperator={adminOperator} />
          {!isLossPrevention && !isVendor && (
          <Link to="/pos" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors">
            <Monitor className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Open POS</span>}
          </Link>
          )}
          <button onClick={() => { sessionStorage.removeItem("admin_operator"); base44.auth.logout("/"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-y-auto pt-14 lg:pt-0 ${theme === "dark" ? "theme-dark" : ""}`}>
        <Outlet />
      </main>

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
                  <Button variant="outline" onClick={() => setResetDialogOpen(false)} className="flex-1">Cancel</Button>
                  <Button onClick={handleExportBeforeReset} className="flex-1 bg-orange-600 hover:bg-orange-700 gap-2"><Download className="w-4 h-4" /> Export & Continue</Button>
                </div>
              </>
            )}
            {resetStep === "override" && (
              <>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Manager PIN</label>
                  <Input type="password" placeholder="Enter PIN to confirm" value={overridePin} onChange={(e) => setOverridePin(e.target.value)} disabled={resetting} autoFocus />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setResetStep("confirm"); setOverridePin(""); }} className="flex-1" disabled={resetting}>Back</Button>
                  <Button onClick={handleResetConfirm} className="flex-1 bg-red-600 hover:bg-red-700" disabled={resetting}>{resetting ? "Resetting..." : "Confirm Reset"}</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}