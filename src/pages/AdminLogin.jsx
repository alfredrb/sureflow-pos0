import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Settings, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function AdminLogin() {
  const [pin, setPin] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const numpad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

  const handleKey = (key) => {
    if (key === "CLR") setPin("");
    else if (key === "ENT" && pin.length > 0) handleLogin();
    else if (key !== "ENT" && pin.length < 6) setPin(prev => prev + key);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (!userId.trim() || pin.length === 0) {
        toast({ title: "Access Denied", description: "User ID and PIN are required", variant: "destructive" });
        setLoading(false);
        return;
      }
      const ops = await base44.entities.Operator.filter({ operator_id: userId.trim(), pin: pin, status: "active" });
      const admin = ops.find(o => o.role === "manager" || o.role === "csm");

      if (!admin) {
        toast({ title: "Access Denied", description: "Invalid User ID or PIN", variant: "destructive" });
        setPin("");
      } else {
        sessionStorage.setItem("admin_operator", JSON.stringify(admin));
        toast({ title: "Welcome", description: `Logged in as ${admin.full_name}` });
        navigate("/admin");
      }
    } catch (e) {
      toast({ title: "Error", description: "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <p className="text-blue-200/60 text-xs">
          {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>

      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <Settings className="w-6 h-6 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
      <p className="text-blue-300/50 text-sm mb-10">SurePOS Management System</p>

      <div className="w-full max-w-xs bg-[#111638] border border-blue-500/10 rounded-2xl p-6 space-y-6">
        <div className="space-y-4">
          <div className="text-left">
            <p className="text-blue-300/60 text-xs uppercase tracking-widest mb-2">User ID</p>
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="Enter User ID"
              className="w-full bg-[#0a0e27] rounded-xl px-4 py-3 text-white text-center text-lg tracking-wider border border-blue-500/10 focus:outline-none focus:border-blue-500/40"
              autoFocus
            />
          </div>
          <div className="text-center">
            <p className="text-blue-300/60 text-xs uppercase tracking-widest mb-3">Admin PIN</p>
            <div className="bg-[#0a0e27] rounded-xl p-4 font-mono text-3xl text-white tracking-[0.5em] min-h-[60px] flex items-center justify-center border border-blue-500/10">
              {"•".repeat(pin.length) || <span className="text-blue-500/20">---</span>}
            </div>
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

        <p className="text-blue-300/30 text-center text-xs">Managers & CSMs • PIN-protected access</p>
      </div>
    </div>
  );
}