import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/data";
import { Monitor, Loader2, Wifi, WifiOff, Settings, AlertTriangle, Keyboard, Grid3x3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import SelfTimeClock from "@/components/SelfTimeClock";
import VersionLogDialog from "@/components/VersionLogDialog";
import POSVersionButton from "@/components/POSVersionButton";
import { getLatestVersionString, VERSION_FALLBACK } from "@/lib/appVersion";
import { useKeyClick } from "@/hooks/useKeyClick";
import POSCredentialPinpad from "@/components/pos/POSCredentialPinpad";
import ShiftLookupDialog from "@/components/pos/ShiftLookupDialog";
import { verifyOperatorCredentials, SUPERVISOR_ROLES, CONFIG_ROLES } from "@/lib/operatorAuth";

export default function POSLogin() {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("id");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [registerNum, setRegisterNum] = useState(() => sessionStorage.getItem("pos_register_num") || "");
  const [registerIp, setRegisterIp] = useState(sessionStorage.getItem("pos_register_ip") || "—");
  const [showConfig, setShowConfig] = useState(false);
  const [configId, setConfigId] = useState("");
  const [configPin, setConfigPin] = useState("");
  const [configUnlocked, setConfigUnlocked] = useState(false);
  const [availableRegisters, setAvailableRegisters] = useState([]);
  const [detectedIp, setDetectedIp] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [forceConfig, setForceConfig] = useState(false);
  const [showShiftLookup, setShowShiftLookup] = useState(false);
  const [showTimeClock, setShowTimeClock] = useState(false);
  const [operators, setOperators] = useState([]);
  const [conflict, setConflict] = useState(null); // { operator, otherRegister }
  const [overrideId, setOverrideId] = useState("");
  const [overridePin, setOverridePin] = useState("");
  const [overrideError, setOverrideError] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [lunchLockout, setLunchLockout] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [version, setVersion] = useState(VERSION_FALLBACK);
  const [versionOpen, setVersionOpen] = useState(false);
  const [loginMode, setLoginMode] = useState(() => sessionStorage.getItem("pos_login_mode") || "pinpad");
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("pos_dismissed_announcements") || "[]")); } catch { return new Set(); }
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Load operators for shift lookup
    base44.entities.Operator.list().then(ops => setOperators(ops)).catch(() => {});
    // Load active store announcements for the login screen
    base44.entities.Announcement.list("-created_date", 50).then(all => {
      const now = new Date();
      const active = all.filter(a => a.status === "active" &&
        (!a.start_date || new Date(a.start_date) <= now) &&
        (!a.end_date || new Date(a.end_date) >= now));
      setAnnouncements(active);
    }).catch(() => {});
    // PXE kiosk boot — the relay's /kiosk redirect carries the lane's register_id
    // from the kernel command line, so the lane selects its own register with no
    // on-screen config step.
    const currentReg = sessionStorage.getItem("pos_register_num");
    const bootReg = new URLSearchParams(window.location.search).get("register_id")
      || sessionStorage.getItem("pos_boot_register");
    if (bootReg) {
      sessionStorage.setItem("pos_boot_register", bootReg);
      base44.entities.Register.filter({ register_id: bootReg }).then(results => {
        if (results.length > 0) {
          const reg = results[0];
          base44.entities.Register.update(reg.id, { status: "online" }).catch(() => {});
          sessionStorage.setItem("pos_register_num", reg.register_id);
          if (reg.store_id) sessionStorage.setItem("pos_store_id", reg.store_id);
          setRegisterNum(reg.register_id);
          if (reg.ip_address) {
            setRegisterIp(reg.ip_address);
            sessionStorage.setItem("pos_register_ip", reg.ip_address);
          }
        } else {
          toast({ title: "Register Not Found", description: `Boot identity "${bootReg}" does not match any register. Please select one.`, variant: "destructive" });
          openForcedConfig();
        }
      }).catch(() => {});
    } else if (!currentReg) {
      openForcedConfig();
    } else {
      base44.entities.Register.filter({ register_id: currentReg }).then(results => {
        if (results.length === 0) {
          toast({ title: "Register Not Found", description: `Register "${currentReg}" no longer exists. Please select a new register.`, variant: "destructive" });
          openForcedConfig();
        } else {
          const reg = results[0];
          if (reg.ip_address) {
            setRegisterIp(reg.ip_address);
            sessionStorage.setItem("pos_register_ip", reg.ip_address);
          }
          if (reg.status === "offline" || reg.status === "maintenance") {
            toast({ title: "Register Unavailable", description: `Register "${currentReg}" is ${reg.status}. Please select an available register.`, variant: "destructive" });
            openForcedConfig();
          }
        }
      }).catch(() => {});
    }
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => { getLatestVersionString().then(setVersion).catch(() => {}); }, []);

  const numpad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

  const getLocalIP = () => new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("");
    pc.createOffer().then(o => pc.setLocalDescription(o));
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const match = e.candidate.candidate.match(/\b(\d{1,3}\.){3}\d{1,3}\b/);
      if (match) { resolve(match[0]); pc.close(); }
    };
    setTimeout(() => resolve(null), 3000);
  });

  const openForcedConfig = async () => {
    setForceConfig(true);
    setShowConfig(true);
    setConfigUnlocked(true);
    setConfigLoading(true);
    const [registers, ip] = await Promise.all([
      base44.entities.Register.list(),
      getLocalIP()
    ]);
    setAvailableRegisters(registers);
    setDetectedIp(ip);
    setConfigLoading(false);
  };

  const handleConfigOpen = () => {
    setForceConfig(false);
    setShowConfig(true);
    setConfigId(""); setConfigPin("");
    setConfigUnlocked(false);
    setAvailableRegisters([]);
    setDetectedIp(null);
  };

  const handleConfigUnlock = async () => {
    setConfigLoading(true);
    try {
      const res = await verifyOperatorCredentials(configId, configPin, { roles: CONFIG_ROLES, requireActive: true });
      if (res.ok) {
        const [registers, ip] = await Promise.all([
          base44.entities.Register.list(),
          getLocalIP()
        ]);
        setAvailableRegisters(registers);
        setDetectedIp(ip);
        setConfigUnlocked(true);
      } else {
        toast({ title: "Access Denied", description: res.error, variant: "destructive" });
        setConfigPin("");
      }
    } catch {
      toast({ title: "Error", description: "Could not verify credentials", variant: "destructive" });
    }
    setConfigLoading(false);
  };

  const handleSelectRegister = async (reg) => {
    setConfigLoading(true);
    const updatedIp = detectedIp || reg.ip_address || "—";
    // Claim the register locally FIRST. The lane's own session is not always
    // permitted to write the Register record (status / IP are admin-owned fields),
    // and a rejected write used to abort the whole selection — leaving the picker
    // open and the lane with no register. Identity is a local decision; the
    // status/IP write is best-effort telemetry on top of it.
    setRegisterNum(reg.register_id);
    setRegisterIp(updatedIp);
    sessionStorage.setItem("pos_register_num", reg.register_id);
    sessionStorage.setItem("pos_register_ip", updatedIp);
    if (reg.store_id) sessionStorage.setItem("pos_store_id", reg.store_id);
    await base44.entities.Register.update(reg.id, {
      status: "online",
      ip_address: detectedIp || reg.ip_address
    }).catch(() => {});
    setConfigLoading(false);
    setForceConfig(false);
    setShowConfig(false);
    toast({ title: "Register Set", description: `${reg.register_id} — IP: ${updatedIp}` });
  };

  const pinInputRef = React.useRef(null);

  const handleKey = (key) => {
    if (step === "id") {
      if (key === "CLR") setOperatorId("");
      else if (key === "ENT" && operatorId.length > 0) setStep("pin");
      else if (key !== "ENT" && operatorId.length < 6) setOperatorId(prev => prev + key);
    } else {
      if (key === "CLR") setPin("");
      else if (key === "ENT" && pin.length > 0) handleLogin();
      else if (key !== "ENT" && pin.length < 6) setPin(prev => prev + key);
    }
  };

  // Physical keyboard on the pinpad — operators with an IBM POS keyboard (or any
  // USB keyboard) type the ID and PIN instead of touching the on-screen keys.
  // Enter advances Operator ID -> PIN, then submits.
  useEffect(() => {
    if (loginMode !== "pinpad") return;
    if (showConfig || conflict || lunchLockout || showShiftLookup || showTimeClock) return;
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleKey(e.key); }
      else if (e.key === "Enter") { e.preventDefault(); handleKey("ENT"); }
      else if (e.key === "Backspace") {
        e.preventDefault();
        if (step === "id") setOperatorId(p => p.slice(0, -1));
        else setPin(p => p.slice(0, -1));
      } else if (e.key === "Escape") { e.preventDefault(); handleKey("CLR"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loginMode, step, operatorId, pin, loading, showConfig, conflict, lunchLockout, showShiftLookup, showTimeClock]);

  useKeyClick();

  // Secondary prompts run through POSCredentialPinpad, which owns its own physical
  // keyboard handling — only one of them is ever on screen at a time.

  const handleLogin = async () => {
    setLoading(true);
    try {
      const operatorData = await base44.entities.Operator.filter({ operator_id: operatorId, status: "active" });
      if (operatorData.length === 0 || operatorData[0].pin !== pin) {
        toast({ title: "Operator Not Found", description: "Check the Operator ID and PIN and try again.", variant: "destructive" });
        setStep("id"); setOperatorId(""); setPin("");
      } else {
        const op = operatorData[0];
        if (op.pos_access === false) {
          toast({ title: "Operator Not Found", description: "Check the Operator ID and PIN and try again.", variant: "destructive" });
          setStep("id"); setOperatorId(""); setPin("");
          setLoading(false);
          return;
        }
        // Clock-in and lunch enforcement
        const today = new Date().toISOString().split("T")[0];
        const tcEntries = await base44.entities.TimeClockEntry.filter({ operator_id: op.operator_id }, "-created_date", 50);
        const activeEntry = tcEntries.find(e => (e.date === today || (e.clock_in && e.clock_in.split("T")[0] === today)) && e.status !== "closed");
        if (!activeEntry) {
          toast({ title: "Operator Not Clocked In", description: "Clock in at the time clock before logging into the register.", variant: "destructive" });
          setStep("id"); setOperatorId(""); setPin("");
          setLoading(false);
          return;
        }
        if (activeEntry.status === "on_meal") {
          toast({ title: "Operator On Lunch", description: "You are currently on a lunch break. End your lunch to use the register.", variant: "destructive" });
          setStep("id"); setOperatorId(""); setPin("");
          setLoading(false);
          return;
        }
        const todayShifts = await base44.entities.Shift.filter({ operator_id: op.operator_id, date: today });
        const todayShift = todayShifts[0];
        if (todayShift && todayShift.lunch_start) {
          const [lh, lm] = todayShift.lunch_start.split(":").map(Number);
          const lunchStart = new Date(); lunchStart.setHours(lh, lm, 0, 0);
          const lunchTaken = !!(activeEntry.meal_start && activeEntry.meal_end);
          if (!lunchTaken && new Date() >= lunchStart) {
            setLunchLockout({ operator: op, shift: todayShift });
            setOverrideId(""); setOverridePin(""); setOverrideError("");
            setLoading(false);
            return;
          }
        }
        // Detect an active session on another register (most recent login without a later logout)
        const currentReg = sessionStorage.getItem("pos_register_num");
        const logs = await base44.entities.RegisterLog.filter({ operator_id: op.operator_id }, "-created_date", 100);
        const sessionEvents = logs.filter(l => l.event_type === "login" || l.event_type === "logout");
        const mostRecent = sessionEvents[0];
        const activeReg = (mostRecent && mostRecent.event_type === "login") ? mostRecent.register_id : null;
        if (activeReg && activeReg !== currentReg) {
          setConflict({ operator: op, otherRegister: activeReg });
          setOverrideId(""); setOverridePin(""); setOverrideError("");
          setLoading(false);
          return;
        }
        sessionStorage.setItem("pos_operator", JSON.stringify(op));
        navigate("/pos/register");
      }
    } catch (e) {
      toast({ title: "Error", description: "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDualLoginOverride = async () => {
    setOverrideError("");
    setOverrideLoading(true);
    try {
      const res = await verifyOperatorCredentials(overrideId, overridePin, { roles: SUPERVISOR_ROLES });
      if (!res.ok) {
        setOverrideError(res.error);
        setOverrideLoading(false);
        return;
      }
      const sup = res.operator;
      const op = conflict.operator;
      const currentReg = sessionStorage.getItem("pos_register_num");
      // Force logout from the other register to keep session tracking accurate
      await base44.entities.RegisterLog.create({
        event_type: "logout",
        operator_id: op.operator_id,
        operator_name: op.full_name,
        operator_role: op.role,
        register_id: conflict.otherRegister,
        detail: `Force logout — logged in at ${currentReg} via dual-login override by ${sup.full_name}`
      });
      // Log the override action
      await base44.entities.RegisterLog.create({
        event_type: "override",
        operator_id: op.operator_id,
        operator_name: op.full_name,
        operator_role: op.role,
        register_id: currentReg,
        detail: `Dual register login override — already logged in at ${conflict.otherRegister}, authorized by ${sup.full_name}`,
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Dual Register Login"
      });
      sessionStorage.setItem("pos_operator", JSON.stringify(op));
      setConflict(null);
      setOverrideId(""); setOverridePin("");
      navigate("/pos/register");
    } catch (e) {
      setOverrideError("Override failed — try again");
    }
    setOverrideLoading(false);
  };

  const handleLunchOverride = async () => {
    setOverrideError("");
    setOverrideLoading(true);
    try {
      const res = await verifyOperatorCredentials(overrideId, overridePin, { roles: SUPERVISOR_ROLES });
      if (!res.ok) {
        setOverrideError(res.error);
        setOverrideLoading(false);
        return;
      }
      const sup = res.operator;
      const op = lunchLockout.operator;
      await base44.entities.RegisterLog.create({
        event_type: "override",
        operator_id: op.operator_id,
        operator_name: op.full_name,
        operator_role: op.role,
        register_id: sessionStorage.getItem("pos_register_num"),
        detail: `Lunch lockout override — scheduled lunch ${lunchLockout.shift.lunch_start} passed; authorized by ${sup.full_name} to continue working.`,
        override_operator_id: sup.operator_id,
        override_operator_name: sup.full_name,
        override_action: "Lunch Lockout Override",
      });
      sessionStorage.setItem("pos_operator", JSON.stringify(op));
      setLunchLockout(null);
      setOverrideId(""); setOverridePin("");
      navigate("/pos/register");
    } catch (e) {
      setOverrideError("Override failed — try again");
    }
    setOverrideLoading(false);
  };

  return (
    <div className="h-screen w-screen bg-[#0a0e27] flex flex-col overflow-hidden relative">

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        {/* Clock — top left */}
        <div className="flex items-center gap-3">
          <p className="text-blue-100/70 font-mono text-lg tracking-wider">
            {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <p className="text-blue-300/30 font-mono text-xs">
            {time.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Register + Connection — top right */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {online
              ? <Wifi className="w-3.5 h-3.5 text-green-400" />
              : <WifiOff className="w-3.5 h-3.5 text-red-400" />
            }
            <span className={`text-xs font-mono ${online ? "text-green-400/70" : "text-red-400/70"}`}>
              {online ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-blue-200/60 text-xs font-mono">{registerNum}</p>
            <p className="text-blue-300/20 text-[10px] font-mono">{registerIp}</p>
          </div>
        </div>
      </div>

      {/* Announcements — left side, under the clock */}
      {announcements.filter(a => !dismissed.has(a.id)).length > 0 && (
        <div className="absolute left-4 top-12 w-72 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide space-y-2 pr-1">
          <p className="text-blue-300/30 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3 h-3" /> Store Announcements
          </p>
          {announcements.filter(a => !dismissed.has(a.id)).map(a => {
            const sev = a.severity === "critical"
              ? "border-red-500/30 bg-red-500/10 text-red-100"
              : a.severity === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-blue-500/30 bg-blue-500/10 text-blue-100";
            return (
              <div key={a.id} className={`rounded-xl border p-3 flex items-start gap-2 ${sev}`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-80" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{a.title}</p>
                  <p className="text-xs mt-1 leading-relaxed opacity-90 whitespace-pre-wrap">{a.body}</p>
                </div>
                <button onClick={() => {
                  setDismissed(prev => {
                    const next = new Set(prev); next.add(a.id);
                    sessionStorage.setItem("pos_dismissed_announcements", JSON.stringify([...next]));
                    return next;
                  });
                }} className="text-blue-300/40 hover:text-blue-100 text-xs flex-shrink-0">Dismiss</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Login Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold">SureFlow POS</span>
        </div>

        <div className="w-full max-w-xs bg-[#111638] border border-blue-500/10 rounded-2xl p-5 space-y-5">
          {loginMode === "pinpad" ? (
            <>
              <div className="text-center">
                <p className="text-blue-300/60 text-xs uppercase tracking-widest mb-2">
                  {step === "id" ? "Enter Operator ID" : "Enter PIN"}
                </p>
                <div className="bg-[#0a0e27] rounded-xl p-3 font-mono text-2xl text-white tracking-[0.5em] min-h-[50px] flex items-center justify-center border border-blue-500/10">
                  {step === "id"
                    ? operatorId || <span className="text-blue-500/20">---</span>
                    : "•".repeat(pin.length) || <span className="text-blue-500/20">---</span>
                  }
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {numpad.map(key => (
                  <button
                    key={key}
                    onClick={() => handleKey(key)}
                    disabled={loading}
                    className={`h-12 rounded-xl font-bold text-base transition-all duration-150 active:scale-95 ${
                      key === "ENT" ? "bg-blue-600 hover:bg-blue-500 text-white" :
                      key === "CLR" ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20" :
                      "bg-[#1a1f4a] hover:bg-[#222866] text-white border border-blue-500/10"
                    }`}
                  >
                    {loading && key === "ENT" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : key}
                  </button>
                ))}
              </div>

              {step === "pin" && (
                <button onClick={() => { setStep("id"); setPin(""); }} className="text-blue-400/50 hover:text-blue-300 text-xs w-full text-center transition-colors">
                  Different operator?
                </button>
              )}
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-blue-300/60 text-xs uppercase tracking-widest">Operator ID</p>
                <Input
                  value={operatorId}
                  onChange={e => setOperatorId(e.target.value)}
                  placeholder="Enter operator ID"
                  autoComplete="username"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); pinInputRef.current?.focus(); } }}
                  className="bg-[#0a0e27] border-blue-500/20 text-white placeholder:text-blue-500/30 font-mono h-11"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-blue-300/60 text-xs uppercase tracking-widest">PIN</p>
                <Input
                  ref={pinInputRef}
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="Enter PIN"
                  autoComplete="current-password"
                  className="bg-[#0a0e27] border-blue-500/20 text-white placeholder:text-blue-500/30 font-mono h-11"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !operatorId.trim() || !pin.trim()}
                className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          <button
            onClick={() => {
              const next = loginMode === "pinpad" ? "type" : "pinpad";
              setLoginMode(next);
              sessionStorage.setItem("pos_login_mode", next);
              setStep("id"); setPin("");
            }}
            className="text-blue-400/50 hover:text-blue-300 text-xs w-full flex items-center justify-center gap-1.5 transition-colors"
          >
            {loginMode === "pinpad" ? <><Keyboard className="w-3.5 h-3.5" /> Switch to keyboard login</> : <><Grid3x3 className="w-3.5 h-3.5" /> Switch to pinpad login</>}
          </button>
        </div>

        <POSVersionButton
          version={version}
          onVersionClick={() => setVersionOpen(true)}
          onShowShiftLookup={() => setShowShiftLookup(true)}
          onShowTimeClock={() => setShowTimeClock(true)}
          onAdmin={() => navigate("/admin/login")}
          onConfig={handleConfigOpen}
        />
        <VersionLogDialog open={versionOpen} onOpenChange={setVersionOpen} />
      </div>


      {/* Shift Lookup — same identify prompt as the self-service Time Clock */}
      <ShiftLookupDialog open={showShiftLookup} onOpenChange={setShowShiftLookup} operators={operators} />

      {/* Self-Service Time Clock Modal */}
      <SelfTimeClock open={showTimeClock} onOpenChange={setShowTimeClock} operators={operators} />

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[#111638] border border-blue-500/10 rounded-2xl p-6 w-full max-w-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">{forceConfig ? "Select Register" : "Configuration Options"}</h3>
            </div>

            {!configUnlocked ? (
              <POSCredentialPinpad
                active={showConfig && !configUnlocked}
                prompt="Enter a CSM, Manager, or Technician Operator ID and PIN to unlock:"
                operatorId={configId}
                setOperatorId={setConfigId}
                pin={configPin}
                setPin={setConfigPin}
                onSubmit={handleConfigUnlock}
                loading={configLoading}
              />
            ) : (
              <div className="space-y-3">
                {detectedIp && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <div>
                      <p className="text-green-400 text-[10px] uppercase tracking-wider">Host IP Detected</p>
                      <p className="text-green-300 font-mono text-sm">{detectedIp}</p>
                    </div>
                  </div>
                )}
                {!detectedIp && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <p className="text-yellow-400/70 text-[10px]">Could not auto-detect IP — existing register IP will be kept</p>
                  </div>
                )}
                <p className="text-blue-300/50 text-xs">Select a register:</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {availableRegisters.length === 0 && (
                    <p className="text-blue-300/30 text-xs text-center py-4">No registers configured in admin panel</p>
                  )}
                  {availableRegisters.map(reg => (
                    <button
                      key={reg.id}
                      disabled={configLoading}
                      onClick={() => handleSelectRegister(reg)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left ${
                        registerNum === reg.register_id
                          ? "bg-blue-600/20 border-blue-500/40 text-white"
                          : "bg-[#0a0e27] border-blue-500/10 text-blue-200 hover:border-blue-500/30 hover:bg-[#141838]"
                      }`}
                    >
                      <div>
                        <p className="font-mono text-sm font-semibold">{reg.register_id}</p>
                        <p className="text-[10px] text-blue-300/40">{reg.name}{reg.location ? ` — ${reg.location}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[10px] text-blue-300/30">{detectedIp || reg.ip_address || "—"}</p>
                        <span className={`text-[10px] ${reg.status === "online" ? "text-green-400/60" : reg.status === "maintenance" ? "text-yellow-400/60" : "text-red-400/60"}`}>
                          {reg.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!forceConfig && (
              <button onClick={() => setShowConfig(false)} className="text-blue-400/40 hover:text-blue-300 text-xs w-full text-center mt-2">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dual Login Conflict Modal */}
      {conflict && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[#111638] border border-amber-500/30 rounded-2xl p-6 w-full max-w-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold text-sm">Already Logged In</h3>
            </div>
            <p className="text-blue-300/70 text-xs leading-relaxed">
              {conflict.operator.full_name} is currently logged in at register{" "}
              <span className="font-mono font-bold text-amber-400">{conflict.otherRegister}</span>.
              To log in here, a CSM or Manager must authorize with their Operator ID and PIN.
            </p>
            <POSCredentialPinpad
              active={!!conflict}
              accent="amber"
              operatorId={overrideId}
              setOperatorId={setOverrideId}
              pin={overridePin}
              setPin={setOverridePin}
              onSubmit={handleDualLoginOverride}
              loading={overrideLoading}
              error={overrideError}
            />
            <button onClick={() => { setConflict(null); setOverrideId(""); setOverridePin(""); setOverrideError(""); }} className="text-blue-400/40 hover:text-blue-300 text-xs w-full text-center">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Lunch Lockout Override Modal */}
      {lunchLockout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[#111638] border border-orange-500/30 rounded-2xl p-6 w-full max-w-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h3 className="text-white font-semibold text-sm">Lunch Break Overdue</h3>
            </div>
            <p className="text-blue-300/70 text-xs leading-relaxed">
              {lunchLockout.operator.full_name} has passed the scheduled lunch time of{" "}
              <span className="font-mono font-bold text-orange-400">{lunchLockout.shift.lunch_start}</span>.
              A CSM or Manager must authorize with their Operator ID and PIN to continue working.
            </p>
            <POSCredentialPinpad
              active={!!lunchLockout}
              accent="orange"
              operatorId={overrideId}
              setOperatorId={setOverrideId}
              pin={overridePin}
              setPin={setOverridePin}
              onSubmit={handleLunchOverride}
              loading={overrideLoading}
              error={overrideError}
            />
            <button onClick={() => { setLunchLockout(null); setOverrideId(""); setOverridePin(""); setOverrideError(""); }} className="text-blue-400/40 hover:text-blue-300 text-xs w-full text-center">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}