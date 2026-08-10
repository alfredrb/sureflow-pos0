import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Settings, Loader2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function AdminLogin() {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!operatorId.trim() || !pin.trim()) {
      toast({ title: "Missing credentials", description: "Enter your User ID and PIN", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const ops = await base44.entities.Operator.filter({ operator_id: operatorId.trim(), pin: pin.trim(), status: "active" });
      const admin = ops.find(o => o.role === "manager" || o.role === "csm" || o.role === "technician");
      if (!admin) {
        toast({ title: "Access Denied", description: "Invalid User ID or PIN", variant: "destructive" });
        setPin("");
      } else {
        sessionStorage.setItem("admin_operator", JSON.stringify(admin));
        toast({ title: "Welcome", description: `Logged in as ${admin.full_name}` });
        navigate(admin.role === "technician" ? "/admin/hardware" : "/admin");
      }
    } catch (e) {
      toast({ title: "Error", description: "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-blue-300/60 hover:text-blue-200 text-xs transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </Link>

      <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/30">
        <Settings className="w-6 h-6 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
      <p className="text-blue-300/50 text-sm mb-10">SureFlow POS Management System</p>

      <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#111638] border border-blue-500/10 rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-blue-200/70 text-xs uppercase tracking-widest">User ID</Label>
          <Input
            value={operatorId}
            onChange={e => setOperatorId(e.target.value)}
            placeholder="Enter your operator ID"
            autoComplete="username"
            autoFocus
            className="bg-[#0a0e27] border-blue-500/20 text-white placeholder:text-blue-500/30 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-blue-200/70 text-xs uppercase tracking-widest">PIN</Label>
          <Input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter your PIN"
            autoComplete="current-password"
            className="bg-[#0a0e27] border-blue-500/20 text-white placeholder:text-blue-500/30 font-mono"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <p className="text-blue-300/30 text-center text-xs">Managers, CSMs &amp; Technicians • PIN-protected access</p>
      </form>

      <Link to="/central/login" className="mt-6 text-indigo-400/60 hover:text-indigo-300 text-xs underline underline-offset-4">
        Central Admin (all stores) login
      </Link>
    </div>
  );
}