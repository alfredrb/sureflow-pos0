import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Monitor, ShieldAlert, Check, X, Clock, Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, XCircle, DollarSign, Eye } from "lucide-react";
import TransactionDetailDialog from "@/components/TransactionDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CONFIG = {
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700 border-amber-300",  dot: "bg-amber-500" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-300",  dot: "bg-green-500" },
  declined: { label: "Declined", color: "bg-red-100 text-red-700 border-red-300",        dot: "bg-red-500" },
  expired:  { label: "Expired",  color: "bg-gray-100 text-gray-500 border-gray-300",     dot: "bg-gray-400" },
};

export default function AdminRemoteWorkstation() {
  const [registers, setRegisters] = useState([]);
  const [requests, setRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [operators, setOperators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [robberies, setRobberies] = useState([]);
  const [audits, setAudits] = useState([]);
  const [shiftAlerts, setShiftAlerts] = useState([]);
  const [cashLimitAlerts, setCashLimitAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [declineDialog, setDeclineDialog] = useState(false);
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [selectedRegisterLogout, setSelectedRegisterLogout] = useState(null);
  const [logoutReason, setLogoutReason] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [forceLogoutDialog, setForceLogoutDialog] = useState(false);
  const [forceLogoutLoading, setForceLogoutLoading] = useState(false);
  const [adminOperator, setAdminOperator] = useState(null);
  const [txDetail, setTxDetail] = useState(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  useEffect(() => {
    const storedOperator = sessionStorage.getItem("admin_operator");
    if (!storedOperator) {
      navigate("/admin/login");
    } else {
      setAdminOperator(JSON.parse(storedOperator));
    }
    loadAll();
    setLastRefresh(new Date());
  }, [navigate]);

  useEffect(() => {
    if (!autoRefresh) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // Poll every 5 seconds for live updates when auto-refresh is on
    const refresh = async () => {
      await checkAutoLogouts();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRequests();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTransactions();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadOperators();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadLogs();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRobberies();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadAudits();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadShiftAlerts();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadCashLimitAlerts();
      setLastRefresh(new Date());
    };
    pollRef.current = setInterval(refresh, 5000);
    return () => clearInterval(pollRef.current);
  }, [autoRefresh]);

  const loadAll = async () => {
    setLoading(true);
    try {
      await loadRegisters();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRequests();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadTransactions();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadOperators();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadLogs();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRobberies();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadAudits();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadShiftAlerts();
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadCashLimitAlerts();
    } catch (e) {
      console.error("Error loading data:", e);
    }
    setLoading(false);
  };

  const loadRegisters = async () => {
    try {
      const regs = await base44.entities.Register.list();
      setRegisters(regs);
    } catch (e) {
      console.error("Error loading registers:", e);
    }
  };

  const loadRequests = async () => {
    try {
      // Expire old pending requests (older than 5 minutes) on the client side
      const all = await base44.entities.OverrideRequest.list("-created_date", 200);
      const now = Date.now();
      const updated = all.map(r => {
        if (r.status === "pending") {
          const created = new Date(r.created_date).getTime();
          if (now - created > 5 * 60 * 1000) return { ...r, status: "expired" };
        }
        return r;
      });
      // Persist expired status changes silently
      updated.filter((r, i) => r.status === "expired" && all[i].status === "pending").forEach(r => {
        base44.entities.OverrideRequest.update(r.id, { status: "expired" });
      });
      setRequests(updated);
    } catch (e) {
      console.error("Error loading requests:", e);
    }
  };

  const loadTransactions = async () => {
    try {
      const txs = await base44.entities.Transaction.list("-created_date", 100);
      setTransactions(txs);
    } catch (e) {
      console.error("Error loading transactions:", e);
    }
  };

  const loadOperators = async () => {
    try {
      const ops = await base44.entities.Operator.list();
      setOperators(ops);
    } catch (e) {
      console.error("Error loading operators:", e);
    }
  };

  const loadLogs = async () => {
    try {
      const logRecords = await base44.entities.RegisterLog.list("-created_date", 100);
      setLogs(logRecords);
    } catch (e) {
      console.error("Error loading logs:", e);
    }
  };

  const loadRobberies = async () => {
    try {
      const alerts = await base44.entities.EmergencyAlert.filter({ status: "active" });
      setRobberies(alerts);
    } catch (e) {
      console.error("Error loading robberies:", e);
    }
  };

  const loadAudits = async () => {
    try {
      const audits = await base44.entities.CashAudit.filter({ status: "pending" }, "-created_date", 50);
      setAudits(audits);
    } catch (e) {
      console.error("Error loading audits:", e);
    }
  };

  const loadShiftAlerts = async () => {
    try {
      const alerts = await base44.entities.ShiftAlert.filter({ is_active: true }, "-triggered_at", 50);
      setShiftAlerts(alerts);
    } catch (e) {
      console.error("Error loading shift alerts:", e);
    }
  };

  const loadCashLimitAlerts = async () => {
    try {
      const alerts = await base44.entities.CashLimitAlert.filter({ status: ["active", "acknowledged"] }, "-triggered_at", 50);
      setCashLimitAlerts(alerts);
    } catch (e) {
      console.error("Error loading cash limit alerts:", e);
    }
  };

  // Get the most recent transaction for a register
  const getRegisterTransaction = (registerId) =>
    transactions.find(tx => tx.register_id === registerId);

  // Get pending requests for a register
  const getRegisterPendingRequests = (registerId) =>
    requests.filter(r => r.register_id === registerId && r.status === "pending");

  // Get current logged-in operator for a register.
  // An operator counts as logged in here only if their most recent session event on this
  // register is a login AND they have not since logged in/out on a different register
  // (e.g. a dual-login override that force-logged them out and moved them elsewhere).
  const computeCurrentOperator = (registerId, logsArr, operatorsArr = operators) => {
    const regEvents = logsArr
      .filter(l => l.register_id === registerId && (l.event_type === "login" || l.event_type === "logout"))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const lastEvent = regEvents[0];
    if (!lastEvent || lastEvent.event_type !== "login") return null;
    const opId = lastEvent.operator_id;
    const loginTime = new Date(lastEvent.created_date).getTime();
    const movedElsewhere = logsArr.some(l =>
      l.operator_id === opId &&
      l.register_id !== registerId &&
      (l.event_type === "login" || l.event_type === "logout") &&
      new Date(l.created_date).getTime() > loginTime
    );
    if (movedElsewhere) return null;
    return operatorsArr.find(o => o.operator_id === opId) || { operator_id: opId, full_name: lastEvent.operator_name, role: lastEvent.operator_role };
  };

  const getCurrentOperator = (registerId) => computeCurrentOperator(registerId, logs);

  // Get active transaction for a register (most recent non-completed)
  const getActiveTransaction = (registerId) => {
    const active = transactions
      .filter(t => t.register_id === registerId && t.status !== "completed" && t.status !== "voided" && t.status !== "refunded")
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    return active || null;
  };

  const handleRemoteLogout = async () => {
    if (!selectedRegisterLogout) return;
    setLogoutLoading(true);
    try {
      // Use the actual database ID from the register object
      const registerId = selectedRegisterLogout.id || Object.keys(selectedRegisterLogout).find(k => selectedRegisterLogout[k] === selectedRegisterLogout.register_id && k !== 'register_id');
      await base44.entities.Register.update(registerId || selectedRegisterLogout.register_id, {
        remote_logout_requested: true,
        remote_logout_requested_at: new Date().toISOString(),
        remote_logout_reason: logoutReason || "Remote logout requested"
      });
      await base44.entities.RegisterLog.create({
        event_type: "register_change",
        operator_id: "admin",
        operator_name: "Remote Admin",
        operator_role: "manager",
        register_id: selectedRegisterLogout.register_id,
        register_name: selectedRegisterLogout.name,
        detail: `Remote logout requested: ${logoutReason || "No reason provided"}`
      });
      toast({ title: "Remote logout initiated", description: `${selectedRegisterLogout.name} will logout after active transaction completes` });
      setLogoutDialog(false);
      setLogoutReason("");
      setSelectedRegisterLogout(null);
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRegisters();
    } catch (e) {
      toast({ title: "Error initiating logout", description: e.message || "Check console for details", variant: "destructive" });
    }
    setLogoutLoading(false);
  };

  // Immediately end the operator's session on a register, regardless of transaction state.
  const forceLogoutRegister = async (reg, detail) => {
    const currentOp = getCurrentOperator(reg.register_id);
    await base44.entities.Register.update(reg.id, {
      remote_logout_requested: false,
      remote_logout_requested_at: null,
      remote_logout_reason: "",
      assigned_operator: ""
    });
    if (currentOp) {
      await base44.entities.RegisterLog.create({
        event_type: "logout",
        operator_id: currentOp.operator_id,
        operator_name: currentOp.full_name,
        operator_role: currentOp.role || "",
        register_id: reg.register_id,
        register_name: reg.name,
        detail: detail || `Force logout by Admin — ${currentOp.full_name}`
      });
    }
  };

  const handleForceLogoutConfirm = async () => {
    if (!selectedRegisterLogout) return;
    setForceLogoutLoading(true);
    try {
      await forceLogoutRegister(selectedRegisterLogout, `Force logout by Admin — ${selectedRegisterLogout.name}`);
      toast({ title: "Force logout complete", description: `${selectedRegisterLogout.name} operator logged out immediately` });
      setForceLogoutDialog(false);
      setSelectedRegisterLogout(null);
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadRegisters();
      await loadLogs();
    } catch (e) {
      toast({ title: "Error forcing logout", description: e.message || "Check console for details", variant: "destructive" });
    }
    setForceLogoutLoading(false);
  };

  // Auto-logout: if a remote logout request is not acknowledged within 10 minutes,
  // force the operator out. Runs on every poll cycle.
  const checkAutoLogouts = async () => {
    try {
      const [regs, logRecords] = await Promise.all([
        base44.entities.Register.list(),
        base44.entities.RegisterLog.list("-created_date", 100)
      ]);
      const now = Date.now();
      const due = regs.filter(r =>
        r.remote_logout_requested === true &&
        r.remote_logout_requested_at &&
        (now - new Date(r.remote_logout_requested_at).getTime()) >= 10 * 60 * 1000
      );
      let loggedOut = 0;
      for (const reg of due) {
        const op = computeCurrentOperator(reg.register_id, logRecords);
        await base44.entities.Register.update(reg.id, {
          remote_logout_requested: false,
          remote_logout_requested_at: null,
          remote_logout_reason: "",
          assigned_operator: ""
        });
        if (op) {
          await base44.entities.RegisterLog.create({
            event_type: "logout",
            operator_id: op.operator_id,
            operator_name: op.full_name,
            operator_role: op.role || "",
            register_id: reg.register_id,
            register_name: reg.name,
            detail: `Auto force logout — operator did not acknowledge remote logout within 10 minutes (${op.full_name})`
          });
          loggedOut++;
        }
      }
      if (loggedOut > 0) {
        toast({ title: `${loggedOut} register(s) auto-logged out`, description: "Remote logout not acknowledged within 10 minutes", variant: "destructive" });
        await loadRegisters();
        await loadLogs();
      }
    } catch (e) {
      console.error("Auto logout check failed", e);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || !adminOperator) return;
    setActionLoading(true);
    try {
      await base44.entities.OverrideRequest.update(selectedRequest.id, {
        status: "approved",
        approved_by_operator_id: adminOperator.operator_id,
        approved_by_operator_name: adminOperator.full_name,
        note: note || ""
      });
      // Log it
      await base44.entities.RegisterLog.create({
        event_type: "override",
        operator_id: adminOperator.operator_id,
        operator_name: adminOperator.full_name,
        operator_role: adminOperator.role,
        register_id: selectedRequest.register_id,
        detail: `Remote override APPROVED for "${selectedRequest.action}" (requested by ${selectedRequest.requested_by_operator_name || selectedRequest.register_id})`,
        override_operator_id: adminOperator.operator_id,
        override_operator_name: adminOperator.full_name,
        override_action: selectedRequest.action
      });
      toast({ title: "Override Approved", description: `${adminOperator.full_name} approved "${selectedRequest.action}"` });
      setApproveDialog(false); setNote(""); setSelectedRequest(null);
    } catch (e) {
      toast({ title: "Error", description: "Failed to approve override", variant: "destructive" });
    }
    setActionLoading(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    await loadRequests();
  };

  const handleDecline = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    await base44.entities.OverrideRequest.update(selectedRequest.id, {
      status: "declined",
      note: note || ""
    });
    toast({ title: "Override Declined", variant: "destructive" });
    setDeclineDialog(false); setNote(""); setSelectedRequest(null);
    setActionLoading(false);
    loadRequests();
  };

  const openApprove = (req) => {
    setSelectedRequest(req);
    setNote("");
    setApproveDialog(true);
  };

  const openDecline = (req) => {
    setSelectedRequest(req);
    setNote("");
    setDeclineDialog(true);
  };

  const togglePause = async (reg) => {
    const newPaused = !reg.paused;
    await base44.entities.Register.update(reg.id, { paused: newPaused });
    toast({ title: `${reg.name} ${newPaused ? "paused" : "unpaused"}` });
    loadRegisters();
  };

  const handleAcknowledgeCashRequest = async (req) => {
    try {
      await base44.entities.RegisterLog.update(req.id, { acknowledged: true });
      setLogs(prev => prev.map(l => l.id === req.id ? { ...l, acknowledged: true } : l));
      toast({ title: "Cash request acknowledged" });
    } catch (e) {
      toast({ title: "Error acknowledging request", description: e.message, variant: "destructive" });
    }
  };

  // Get newly requested audits (created within last 5 minutes)
  const getNewlyRequestedAudits = () => {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return audits.filter(a => {
      const createdTime = new Date(a.created_date).getTime();
      return createdTime > fiveMinutesAgo;
    });
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const newAudits = getNewlyRequestedAudits();
  // Cash pickup/advance requests logged from the POS (active within last 15 minutes)
  const cashRequests = logs.filter(l => l.event_type === "cash_request" && !l.acknowledged);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col gap-4 sm:gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Remote Workstation</h1>
            <p className="text-gray-500 text-xs sm:text-sm">Monitor registers and approve remote override requests</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-full text-xs sm:text-sm font-bold animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              {pendingRequests.length} pending override{pendingRequests.length !== 1 ? "s" : ""}
            </span>
          )}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAutoRefresh(!autoRefresh)} 
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${autoRefresh ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:text-gray-700"}`}
            >
              <div className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
            <button onClick={loadAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 text-sm transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Audit Requests — highest priority alert */}
      {newAudits.length > 0 && (
        <div className="bg-red-50 border border-red-500 rounded-2xl p-4 flex-shrink-0 ring-2 ring-red-500 animate-pulse">
          <p className="text-red-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 animate-pulse" /> AUDIT REQUESTED ({newAudits.length})
          </p>
          <div className="space-y-2">
            {newAudits.map(audit => {
              const minutesAgo = Math.floor((Date.now() - new Date(audit.created_date).getTime()) / 60000);
              return (
                <div key={audit.id} className="bg-white rounded-xl border-2 border-red-400 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0 animate-bounce">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">
                      <span className="text-red-600">{audit.register_name || audit.register_id}</span> — Manual Audit Request
                    </p>
                    <p className="text-gray-500 text-xs">Requested by: {audit.operator_name} · {minutesAgo < 1 ? "just now" : `${minutesAgo}m ago`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mandatory Audits — highest priority */}
      {audits.filter(a => a.status === "pending").length > 0 && (
        <div className="bg-red-50 border border-red-400 rounded-2xl p-4 flex-shrink-0 ring-2 ring-red-400">
          <p className="text-red-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> MANDATORY AUDITS PENDING ({audits.filter(a => a.status === "pending").length})
          </p>
          <div className="space-y-2">
            {audits.filter(a => a.status === "pending").slice(0, 5).map(audit => (
              <div key={audit.id} className="bg-white rounded-xl border border-red-300 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    <span className="text-red-600">{audit.register_name}</span> — audit pending review
                  </p>
                  <p className="text-gray-500 text-xs">Operator: {audit.operator_name} · ${audit.total_counted?.toFixed(2)} counted · {new Date(audit.audit_date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Limit Alerts — high priority */}
      {cashLimitAlerts.filter(a => a.status === "active").length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-red-200">
          <p className="text-red-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> CASH LIMIT EXCEEDED ({cashLimitAlerts.filter(a => a.status === "active").length})
          </p>
          <div className="space-y-2">
            {cashLimitAlerts.filter(a => a.status === "active").slice(0, 5).map(alert => (
              <div key={alert.id} className="bg-white rounded-xl border border-red-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    <span className="text-red-600">{alert.register_name}</span> — ${alert.actual_cash?.toFixed(2)} counted
                  </p>
                  <p className="text-gray-500 text-xs">Excess: <strong className="text-red-600">${alert.excess_amount?.toFixed(2)}</strong> over ${alert.cash_limit} limit · {alert.operator_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift Alerts — medium-high priority */}
      {shiftAlerts.filter(a => a.alert_type === "shift_overtime").length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-red-200">
          <p className="text-red-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> SHIFT OVERTIME LOCKOUT ({shiftAlerts.filter(a => a.alert_type === "shift_overtime").length})
          </p>
          <div className="space-y-2">
            {shiftAlerts.filter(a => a.alert_type === "shift_overtime").slice(0, 5).map(alert => (
              <div key={alert.id} className="bg-white rounded-xl border border-red-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm text-red-600">{alert.operator_name} — 30+ min past shift</p>
                  <p className="text-gray-500 text-xs">{alert.register_id} · {new Date(alert.triggered_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shift Break/Lunch Alerts */}
      {shiftAlerts.filter(a => ["break_overtime", "lunch_overtime"].includes(a.alert_type)).length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-amber-200">
          <p className="text-amber-800 font-bold text-sm mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" /> BREAK/LUNCH OVERDUE ({shiftAlerts.filter(a => ["break_overtime", "lunch_overtime"].includes(a.alert_type)).length})
          </p>
          <div className="space-y-2">
            {shiftAlerts.filter(a => ["break_overtime", "lunch_overtime"].includes(a.alert_type)).slice(0, 5).map(alert => (
              <div key={alert.id} className="bg-white rounded-xl border border-amber-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{alert.operator_name} — {alert.alert_type === "break_overtime" ? "Break" : "Lunch"} overdue</p>
                  <p className="text-gray-500 text-xs">{alert.register_id} · {new Date(alert.triggered_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Audit Alerts — medium priority */}
      {audits.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-orange-200">
          <p className="text-orange-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> CASH AUDIT REQUIRED ({audits.length})
          </p>
          <div className="space-y-2">
            {audits.slice(0, 5).map(audit => (
              <div key={audit.id} className="bg-white rounded-xl border border-orange-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    <span className="text-orange-600 font-bold">${audit.total_counted?.toFixed(2) || '0.00'}</span>
                    {" counted at "}
                    <span className="text-violet-600">{audit.register_name || audit.register_id}</span>
                  </p>
                  <p className="text-gray-500 text-xs">
                    {audit.operator_name} ({audit.operator_id}) · {new Date(audit.audit_date).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Robbery Alerts — critical priority */}
      {robberies.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-red-200">
          <p className="text-red-800 font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 animate-pulse" /> ROBBERY ALERT
          </p>
          <div className="space-y-2">
            {robberies.slice(0, 5).map(rob => (
              <div key={rob.id} className="bg-white rounded-xl border border-red-200 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    Robbery reported at{" "}
                    <span className="text-violet-600">{rob.register_name || rob.register_id}</span>
                  </p>
                  <p className="text-gray-500 text-xs">
                    {rob.operator_name} ({rob.operator_id}) · {new Date(rob.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cash Pickup / Advance Requests — from POS */}
      {cashRequests.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex-shrink-0 ring-2 ring-emerald-200">
          <p className="text-emerald-800 font-bold text-sm mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 animate-pulse" /> CASH REQUESTS ({cashRequests.length})
          </p>
          <div className="space-y-2">
            {cashRequests.map(req => {
              const mins = Math.floor((Date.now() - new Date(req.created_date).getTime()) / 60000);
              return (
                <div key={req.id} className="bg-white rounded-xl border border-emerald-200 p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0 animate-bounce">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      <span className="text-emerald-600">{req.register_id}</span> — {req.detail}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {req.operator_name || "Unknown"} · {mins < 1 ? "just now" : `${mins}m ago`}
                    </p>
                  </div>
                  <Button onClick={() => handleAcknowledgeCashRequest(req)} size="sm" variant="outline" className="flex-shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                    <Check className="w-3.5 h-3.5 mr-1" /> Acknowledge
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Override Requests — top priority */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex-shrink-0">
          <p className="text-amber-800 font-bold text-sm mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Pending Override Requests
          </p>
          <div className="space-y-2">
            {pendingRequests.map(req => {
              const age = Math.floor((Date.now() - new Date(req.created_date).getTime()) / 1000);
              const ageStr = age < 60 ? `${age}s ago` : `${Math.floor(age / 60)}m ago`;
              return (
                <div key={req.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center gap-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      <span className="text-violet-600">{req.register_id}</span>
                      {" · "}
                      <span className="text-amber-700">"{req.action}"</span>
                    </p>
                    <p className="text-gray-500 text-xs">
                      {req.requested_by_operator_name
                        ? `Requested by ${req.requested_by_operator_name} (${req.requested_by_operator_id})`
                        : `From register ${req.register_id}`}
                      {" · "}<Clock className="w-3 h-3 inline" /> {ageStr}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button onClick={() => openDecline(req)} variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50">
                      <X className="w-3.5 h-3.5 mr-1" /> Decline
                    </Button>
                    <Button onClick={() => openApprove(req)} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      <Check className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Register Status Grid */}
      <div className="flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Register Status</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {registers.map(reg => {
            const tx = getRegisterTransaction(reg.register_id);
            const pending = getRegisterPendingRequests(reg.register_id);
            const currentOp = getCurrentOperator(reg.register_id);
            const activeTx = getActiveTransaction(reg.register_id);
            return (
              <div key={reg.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${pending.length > 0 ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-100"}`}>
                {/* Register header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${reg.status === "online" ? "bg-green-500" : reg.status === "maintenance" ? "bg-amber-500" : "bg-gray-300"}`} />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{reg.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{reg.register_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    {reg.status === "online" ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5" />}
                    <span className={reg.status === "online" ? "text-green-600" : "capitalize"}>{reg.status}</span>
                  </div>
                </div>

                {/* Paused badge */}
                {reg.paused && (
                  <div className="mb-3 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="text-red-700 text-xs font-bold">PAUSED — Register Locked</span>
                  </div>
                )}

                {/* Pending override badge */}
                {pending.length > 0 && (
                  <div className="mb-3 flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-amber-700 text-xs font-bold">{pending.length} override request{pending.length !== 1 ? "s" : ""} pending</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="mb-3 flex gap-2">
                  <Button onClick={() => togglePause(reg)} size="sm" variant={reg.paused ? "default" : "outline"} className={`flex-1 text-xs ${reg.paused ? "bg-red-600 hover:bg-red-700 text-white" : "border-amber-200 text-amber-600 hover:bg-amber-50"}`}>
                    {reg.paused ? "Unpause" : "Pause"}
                  </Button>
                  <Button onClick={() => {
                    if (reg.remote_logout_requested) {
                      setSelectedRegisterLogout(reg);
                      setForceLogoutDialog(true);
                    } else {
                      setSelectedRegisterLogout(reg); setLogoutReason(""); setLogoutDialog(true);
                    }
                  }} size="sm" variant="outline" className={`flex-1 text-xs ${reg.remote_logout_requested ? "border-red-300 text-red-600 hover:bg-red-50" : "border-blue-200 text-blue-600 hover:bg-blue-50"}`}>
                    {reg.remote_logout_requested ? "Force Logout" : "Logout"}
                  </Button>
                </div>

                {/* Current Operator */}
                {reg.remote_logout_requested ? (
                  <div className="mb-3 bg-amber-50 rounded-xl p-3 space-y-1.5 border border-amber-200">
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Remote Logout Requested</p>
                    <p className="text-xs font-semibold text-gray-900">
                      {currentOp ? `${currentOp.full_name} — logging out…` : "Operator logging out…"}
                    </p>
                    {reg.remote_logout_reason && (
                      <p className="text-[10px] text-gray-500">Reason: {reg.remote_logout_reason}</p>
                    )}
                    {reg.remote_logout_requested_at && (() => {
                      const remaining = Math.max(0, 10 * 60 * 1000 - (Date.now() - new Date(reg.remote_logout_requested_at).getTime()));
                      const m = Math.floor(remaining / 60000);
                      const s = Math.floor((remaining % 60000) / 1000);
                      return <p className="text-[10px] text-amber-600 font-semibold">Auto-logout in {m}m {s}s</p>;
                    })()}
                  </div>
                ) : currentOp ? (
                  <div className="mb-3 bg-blue-50 rounded-xl p-3 space-y-1.5 border border-blue-100">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Logged In Operator</p>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-gray-900">{currentOp.full_name}</p>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-500">ID: {currentOp.operator_id}</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                          currentOp.role === "manager" ? "bg-red-100 text-red-700" :
                          currentOp.role === "csm" ? "bg-amber-100 text-amber-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{currentOp.role === "manager" ? "Manager" : currentOp.role === "csm" ? "CSM" : "Cashier"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Not Logged In</p>
                  </div>
                )}

                {/* Active Transaction */}
                {activeTx ? (
                  <div className="mb-3 bg-green-50 rounded-xl p-3 space-y-1.5 border border-green-100">
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Active Transaction</p>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs text-gray-600">{activeTx.transaction_id}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-200 text-green-700">In Progress</span>
                      </div>
                      <div className="text-xs">
                        <p className="text-gray-800">{activeTx.items?.length || 0} item{activeTx.items?.length !== 1 ? "s" : ""}</p>
                        <p className="text-gray-600 text-[10px]">Subtotal: ${(activeTx.subtotal || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3 bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No Active Transaction</p>
                  </div>
                )}

                {/* Last transaction */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Transaction</p>
                    {tx && (
                      <button onClick={() => setTxDetail(tx)} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                        <Eye className="w-3 h-3" /> View
                      </button>
                    )}
                  </div>
                  {tx ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs text-gray-600">{tx.transaction_id}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          tx.status === "completed" ? "bg-green-100 text-green-700" :
                          tx.status === "voided" ? "bg-red-100 text-red-700" :
                          tx.status === "refunded" ? "bg-purple-100 text-purple-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{tx.status}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{tx.operator_name || "—"}</span>
                        <span className="font-bold text-gray-800">${tx.total?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>{tx.items?.length || 0} item{tx.items?.length !== 1 ? "s" : ""} · {tx.payment_method}</span>
                        <span>{new Date(tx.created_date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-400 text-xs text-center py-1">No transactions yet</p>
                  )}
                </div>
              </div>
            );
          })}
          {registers.length === 0 && (
            <div className="col-span-3 text-center py-12 text-gray-400">
              <Monitor className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No registers configured</p>
            </div>
          )}
        </div>
      </div>



      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={v => { setApproveDialog(v); if (!v) setNote(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" /> Approve Override
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Register: <span className="font-bold text-gray-800">{selectedRequest.register_id}</span></p>
                <p className="text-xs text-gray-500">Action: <span className="font-bold text-amber-700">"{selectedRequest.action}"</span></p>
                {selectedRequest.requested_by_operator_name && (
                  <p className="text-xs text-gray-500">Requested by: <span className="font-medium text-gray-800">{selectedRequest.requested_by_operator_name}</span></p>
                )}
              </div>
              {adminOperator && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-1">
                  <p className="text-xs text-gray-500">Approving as:</p>
                  <p className="text-sm font-bold text-blue-700">{adminOperator.full_name}</p>
                  <p className="text-xs text-gray-500">{adminOperator.operator_id} · {adminOperator.role}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
                <Input placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setApproveDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleApprove} disabled={actionLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  {actionLoading ? "Approving..." : "Approve Override"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={declineDialog} onOpenChange={v => { setDeclineDialog(v); if (!v) setNote(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-red-700">
              <XCircle className="w-4 h-4" /> Decline Override
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Register: <span className="font-bold text-gray-800">{selectedRequest.register_id}</span></p>
                <p className="text-xs text-gray-500">Action: <span className="font-bold text-amber-700">"{selectedRequest.action}"</span></p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Reason (optional)</label>
                <Input placeholder="Reason for declining..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeclineDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleDecline} disabled={actionLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {actionLoading ? "Declining..." : "Decline"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remote Logout Dialog */}
      <Dialog open={logoutDialog} onOpenChange={v => { setLogoutDialog(v); if (!v) { setLogoutReason(""); setSelectedRegisterLogout(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-blue-700">
              <AlertTriangle className="w-4 h-4" /> Remote Logout
            </DialogTitle>
          </DialogHeader>
          {selectedRegisterLogout && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs text-gray-500">Register: <span className="font-bold text-gray-800">{selectedRegisterLogout.name}</span></p>
                <p className="text-xs text-gray-500 font-mono">{selectedRegisterLogout.register_id}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700"><span className="font-semibold">Note:</span> Operator will be logged out after any active transaction completes.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Reason to display on POS</label>
                <Input 
                  placeholder="e.g., Go to lunch, Break, End of shift" 
                  value={logoutReason} 
                  onChange={e => setLogoutReason(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setLogoutDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleRemoteLogout} disabled={logoutLoading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {logoutLoading ? "Initiating..." : "Confirm Logout"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Force Logout Dialog */}
      <Dialog open={forceLogoutDialog} onOpenChange={v => { setForceLogoutDialog(v); if (!v) setSelectedRegisterLogout(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" /> Force Logout
            </DialogTitle>
          </DialogHeader>
          {selectedRegisterLogout && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-700">
                  A remote logout is already pending on <span className="font-bold">{selectedRegisterLogout.name}</span>.
                  Forcing logout will immediately end the operator's session, even if a transaction is still in progress.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setForceLogoutDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleForceLogoutConfirm} disabled={forceLogoutLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {forceLogoutLoading ? "Forcing..." : "Force Logout Now"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransactionDetailDialog tx={txDetail} onClose={() => setTxDetail(null)} />
      </div>
      );
      }