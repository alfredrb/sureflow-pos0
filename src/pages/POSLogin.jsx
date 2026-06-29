import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Monitor, Loader2, Wifi, WifiOff, Settings, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function POSLogin() {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("id");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [registerNum, setRegisterNum] = useState(() => sessionStorage.getItem("pos_register_num") || "REG-001");
  const [showConfig, setShowConfig] = useState(false);
  const [configPin, setConfigPin] = useState("");
  const [configUnlocked, setConfigUnlocked] = useState(false);
  const [tempRegNum, setTempRegNum] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { clearInterval(t); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  const numpad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

  const handleConfigOpen = () => {
    setShowConfig(true);
    setConfigPin("");
    setConfigUnlocked(false);
    setTempRegNum(registerNum);
  };

  const handleConfigUnlock = async () => {
    try {
      const supervisors = await base44.entities.Operator.filter({ role: "supervisor", status: "active" });
      const admins = await base44.entities.Operator.filter({ role: "admin", status: "active" });
      const all = [...supervisors, ...admins];
      if (all.some(op => op.pin === configPin)) {
        setConfigUnlocked(true);
      } else {
        toast({ title: "Access Denied", description: "Invalid supervisor/admin PIN", variant: "destructive" });
        setConfigPin("");
      }
    } catch {
      toast({ title: "Error", description: "Could not verify PIN", variant: "destructive" });
    }
  };

  const handleConfigSave = () => {
    if (tempRegNum.trim()) {
      setRegisterNum(tempRegNum.trim());
      sessionStorage.setItem("pos_register_num", tempRegNum.trim());
      setShowConfig(false);
      toast({ title: "Saved", description: `Register set to ${tempRegNum.trim()}` });
    }
  };

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

  const handleLogin = async () => {
    setLoading(true);
    try {
      const operators = await base44.entities.Operator.filter({ operator_id: operatorId, status: "active" });
      if (operators.length === 0) {
        toast({ title: "Invalid Operator", description: "Operator ID not found", variant: "destructive" });
        setStep("id"); setOperatorId(""); setPin("");
      } else if (operators[0].pin !== pin) {
        toast({ title: "Invalid PIN", description: "Incorrect PIN entered", variant: "destructive" });
        setPin("");
      } else {
        sessionStorage.setItem("pos_operator", JSON.stringify(operators[0]));
        navigate("/pos/register");
      }
    } catch (e) {
      toast({ title: "Error", description: "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="h-screen bg-[#0a0e27] flex flex-col max-w-[1024px] max-h-[768px] mx-auto overflow-hidden relative">

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
            <p className="text-blue-300/20 text-[10px] font-mono">192.168.1.10</p>
          </div>
        </div>
      </div>

      {/* Login Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold">SurePOS</span>
        </div>

        <div className="w-full max-w-xs bg-[#111638] border border-blue-500/10 rounded-2xl p-5 space-y-5">
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
        </div>

        <p className="text-blue-300/20 text-[10px] mt-6">v4.2.1 — Terminal Ready</p>
      </div>

      {/* Config Button — bottom right */}
      <button
        onClick={handleConfigOpen}
        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-blue-300/40 hover:text-blue-200 transition-colors text-xs"
      >
        <Lock className="w-3 h-3" />
        <span>Configuration</span>
      </button>

      {/* Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[#111638] border border-blue-500/10 rounded-2xl p-6 w-full max-w-xs space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold text-sm">Configuration Options</h3>
            </div>

            {!configUnlocked ? (
              <div className="space-y-3">
                <p className="text-blue-300/50 text-xs">Enter supervisor or admin PIN to unlock:</p>
                <div className="bg-[#0a0e27] rounded-xl p-3 font-mono text-xl text-white tracking-[0.4em] text-center border border-blue-500/10 min-h-[44px] flex items-center justify-center">
                  {"•".repeat(configPin.length) || <span className="text-blue-500/20">----</span>}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {["1","2","3","4","5","6","7","8","9","CLR","0","ENT"].map(k => (
                    <button key={k} onClick={() => {
                      if (k === "CLR") setConfigPin("");
                      else if (k === "ENT" && configPin.length > 0) handleConfigUnlock();
                      else if (k !== "ENT" && configPin.length < 6) setConfigPin(p => p + k);
                    }}
                    className={`h-10 rounded-lg font-bold text-sm transition-all active:scale-95 ${
                      k === "ENT" ? "bg-blue-600 hover:bg-blue-500 text-white" :
                      k === "CLR" ? "bg-red-600/20 text-red-400 border border-red-500/20" :
                      "bg-[#1a1f4a] text-white border border-blue-500/10"
                    }`}>{k}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-blue-300/60 text-xs">Register Number</label>
                <input
                  type="text"
                  value={tempRegNum}
                  onChange={e => setTempRegNum(e.target.value)}
                  className="w-full bg-[#0a0e27] border border-blue-500/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500/30"
                />
                <button onClick={handleConfigSave} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                  Save
                </button>
              </div>
            )}

            <button onClick={() => setShowConfig(false)} className="text-blue-400/40 hover:text-blue-300 text-xs w-full text-center mt-2">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}