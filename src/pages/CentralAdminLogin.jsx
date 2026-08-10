import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Building2, Loader2, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function CentralAdminLogin() {
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!userId.trim() || !pin.trim()) {
      toast({ title: "Missing credentials", description: "Enter your User ID and PIN", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const users = await base44.entities.CentralUser.filter({ user_id: userId.trim(), pin: pin.trim(), status: "active" });
      if (!users.length) {
        toast({ title: "Access Denied", description: "Invalid Central Admin credentials", variant: "destructive" });
        setPin("");
      } else {
        const user = users[0];
        sessionStorage.setItem("central_user", JSON.stringify(user));
        toast({ title: "Welcome", description: `Logged in as ${user.full_name}` });
        navigate("/central");
      }
    } catch (err) {
      toast({ title: "Error", description: "Login failed", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-900 flex flex-col items-center justify-center p-4">
      <Link to="/" className="absolute top-6 left-6 flex items-center gap-1.5 text-indigo-300/60 hover:text-indigo-200 text-xs transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
      </Link>

      <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-600/30">
        <Building2 className="w-7 h-7 text-white" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Central Admin</h1>
      <p className="text-indigo-300/50 text-sm mb-10">SureFlow POS · All-Store Headquarters</p>

      <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#0f1430] border border-indigo-500/10 rounded-2xl p-6 space-y-5">
        <div className="space-y-1.5">
          <Label className="text-indigo-200/70 text-xs uppercase tracking-widest">User ID</Label>
          <Input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="Enter your central admin ID"
            autoComplete="username"
            autoFocus
            className="bg-[#0a0e27] border-indigo-500/20 text-white placeholder:text-indigo-500/30 font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-indigo-200/70 text-xs uppercase tracking-widest">PIN</Label>
          <Input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="Enter your PIN"
            autoComplete="current-password"
            className="bg-[#0a0e27] border-indigo-500/20 text-white placeholder:text-indigo-500/30 font-mono"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {loading ? "Signing in..." : "Sign In"}
        </Button>

        <p className="text-indigo-300/30 text-center text-xs">Headquarters access · All stores overview</p>
      </form>

      <Link to="/admin/login" className="mt-6 text-indigo-400/60 hover:text-indigo-300 text-xs underline underline-offset-4">
        Store-level admin login
      </Link>
    </div>
  );
}