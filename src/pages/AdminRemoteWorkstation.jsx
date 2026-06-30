import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Monitor, ShieldAlert, Check, X, Clock, Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
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
  const [transactions, setTransactions] = useState([]); // latest completed tx per register
  const [operators, setOperators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [robberies, setRobberies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveDialog, setApproveDialog] = useState(false);
  const [declineDialog, setDeclineDialog] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logoutDialog, setLogoutDialog] = useState(false);
  const [selectedRegisterLogout, setSelectedRegisterLogout] = useState(null);
  const [logoutReason, setLogoutReason] = useState("");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const { toast } = useToast();
  const pollRef = useRef(null);

  useEffect(() => {
    loadAll();
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    // Poll every 5 seconds for live updates when auto-refresh is on
    const refresh = async () => {
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

  // Get the most recent transaction for a register
  const getRegisterTransaction = (registerId) =>
    transactions.find(tx => tx.register_id === registerId);

  // Get pending requests for a register
  const getRegisterPendingRequests = (registerId) =>
    requests.filter(r => r.register_id === registerId && r.status === "pending");

  // Get current logged-in operator for a register
  const getCurrentOperator = (registerId) => {
    const loginLog = logs
      .filter(l => l.register_id === registerId && (l.event_type === "login" || l.event_type === "logout"))
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    if (loginLog && loginLog.event_type === "login") {
      return operators.find(o => o.operator_id === loginLog.operator_id) || { operator_id: loginLog.operator_id, full_name: loginLog.operator_name, role: loginLog.operator_role };
    }
    return null;
  };

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
      await base44.entities.Register.update(selectedRegisterLogout.id, {
        remote_logout_requested: true,
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
      toast({ title: "Error initiating logout", variant: "destructive" });
    }
    setLogoutLoading(false);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setPinError("");
    setActionLoading(true);
    const ops = await base44.entities.Operator.filter({ pin: pinInput });
    const sup = ops.find(o => o.role === "csm" || o.role === "manager");
    if (!sup) {
      setPinError("Invalid PIN or insufficient role (CSM or Manager required)");
      setActionLoading(false);
      return;
    }
    await base44.entities.OverrideRequest.update(selectedRequest.id, {
      status: "approved",
      approved_by_operator_id: sup.operator_id,
      approved_by_operator_name: sup.full_name,
      note: note || ""
    });
    // Log it
    await base44.entities.RegisterLog.create({
      event_type: "override",
      operator_id: sup.operator_id,
      operator_name: sup.full_name,
      operator_role: sup.role,
      register_id: selectedRequest.register_id,
      detail: `Remote override APPROVED for "${selectedRequest.action}" (requested by ${selectedRequest.requested_by_operator_name || selectedRequest.register_id})`,
      override_operator_id: sup.operator_id,
      override_operator_name: sup.full_name,
      override_action: selectedRequest.action
    });
    toast({ title: "Override Approved", description: `${sup.full_name} approved "${selectedRequest.action}"` });
    setApproveDialog(false); setPinInput(""); setNote(""); setSelectedRequest(null);
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
    setPinInput(""); setPinError(""); setNote("");
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

  const pendingRequests = requests.filter(r => r.status === "pending");

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 h-full flex flex-col gap-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Remote Workstation</h1>
            <p className="text-gray-500 text-sm">Monitor registers and approve remote override requests</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1.5 bg-amber-100 text-amber-700 border border-amber-300 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
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
            <span className="text-xs text-gray-400">
              {lastRefresh.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>

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
                  <Button onClick={() => { setSelectedRegisterLogout(reg); setLogoutReason(""); setLogoutDialog(true); }} size="sm" variant="outline" className="flex-1 text-xs border-blue-200 text-blue-600 hover:bg-blue-50">
                    Logout
                  </Button>
                </div>

                {/* Current Operator */}
                {currentOp ? (
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Transaction</p>
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
      <Dialog open={approveDialog} onOpenChange={v => { setApproveDialog(v); if (!v) { setPinInput(""); setPinError(""); setNote(""); } }}>
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
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">CSM / Manager PIN</label>
                <Input
                  type="password"
                  placeholder="Enter PIN"
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleApprove()}
                  className="text-center text-lg tracking-widest"
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-xs mt-1">{pinError}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
                <Input placeholder="Add a note..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setApproveDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleApprove} disabled={!pinInput || actionLoading} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
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
      </div>
      );
      }