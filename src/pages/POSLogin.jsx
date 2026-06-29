import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Monitor, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function POSLogin() {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("id"); // id or pin
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const numpad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

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
    <div className="min-h-screen bg-[#0a0e27] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate("/pos")} className="text-blue-400/60 hover:text-blue-300 flex items-center gap-1 text-sm mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-bold">SurePOS</span>
        </div>

        <div className="bg-[#111638] border border-blue-500/10 rounded-2xl p-6 space-y-6">
          <div className="text-center">
            <p className="text-blue-300/60 text-xs uppercase tracking-widest mb-2">
              {step === "id" ? "Enter Operator ID" : "Enter PIN"}
            </p>
            <div className="bg-[#0a0e27] rounded-xl p-4 font-mono text-3xl text-white tracking-[0.5em] min-h-[60px] flex items-center justify-center border border-blue-500/10">
              {step === "id" ? operatorId || <span className="text-blue-500/20">---</span> : "•".repeat(pin.length) || <span className="text-blue-500/20">---</span>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {numpad.map(key => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                disabled={loading}
                className={`h-14 rounded-xl font-bold text-lg transition-all duration-150 active:scale-95 ${
                  key === "ENT" ? "bg-blue-600 hover:bg-blue-500 text-white" :
                  key === "CLR" ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20" :
                  "bg-[#1a1f4a] hover:bg-[#222866] text-white border border-blue-500/10"
                }`}
              >
                {loading && key === "ENT" ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : key}
              </button>
            ))}
          </div>

          {step === "pin" && (
            <button onClick={() => { setStep("id"); setPin(""); }} className="text-blue-400/50 hover:text-blue-300 text-xs w-full text-center transition-colors">
              Different operator?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}