import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { usePinpadKeys } from "@/hooks/usePinpadKeys";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "ENT"];

const ACCENTS = {
  blue: { enter: "bg-blue-600 hover:bg-blue-500", ring: "border-blue-500/10" },
  amber: { enter: "bg-amber-600 hover:bg-amber-500", ring: "border-amber-500/20" },
  orange: { enter: "bg-orange-600 hover:bg-orange-500", ring: "border-orange-500/20" },
};

// Two-step pinpad: Operator ID first, then PIN. Used by every on-screen POS
// authorization prompt so a PIN alone is never enough to authorize anything.
export default function POSCredentialPinpad({
  active = true, operatorId, setOperatorId, pin, setPin,
  onSubmit, loading = false, error = "", accent = "blue", prompt,
}) {
  const [step, setStep] = useState("id");
  useEffect(() => { if (!active) setStep("id"); }, [active]);

  const isId = step === "id";
  const value = isId ? operatorId : pin;
  const setValue = isId ? setOperatorId : setPin;
  const a = ACCENTS[accent] || ACCENTS.blue;

  const handleKey = (k) => {
    if (k === "CLR") { setValue(""); return; }
    if (k === "ENT") {
      if (isId) { if (operatorId.length > 0) setStep("pin"); }
      else if (pin.length > 0) onSubmit();
      return;
    }
    if (value.length < 6) setValue(value + k);
  };

  usePinpadKeys({
    active,
    value,
    setValue,
    onEnter: () => handleKey("ENT"),
    onClear: () => handleKey("CLR"),
  });

  return (
    <div className="space-y-3">
      {prompt && <p className="text-blue-300/50 text-xs">{prompt}</p>}
      <p className="text-blue-300/60 text-[10px] uppercase tracking-widest text-center">
        {isId ? "Operator ID" : "PIN"}
      </p>
      <div className={`bg-[#0a0e27] rounded-xl p-3 font-mono text-xl text-white tracking-[0.4em] text-center border min-h-[44px] flex items-center justify-center ${a.ring}`}>
        {isId
          ? (operatorId || <span className="text-blue-500/20">----</span>)
          : ("•".repeat(pin.length) || <span className="text-blue-500/20">----</span>)}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {KEYS.map(k => (
          <button key={k} disabled={loading} onClick={() => handleKey(k)}
            className={`h-10 rounded-lg font-bold text-sm transition-all active:scale-95 disabled:opacity-50 ${
              k === "ENT" ? `${a.enter} text-white` :
              k === "CLR" ? "bg-red-600/20 text-red-400 border border-red-500/20" :
              "bg-[#1a1f4a] text-white border border-blue-500/10"
            }`}>
            {loading && k === "ENT" ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : k}
          </button>
        ))}
      </div>
      {!isId && (
        <button onClick={() => { setStep("id"); setPin(""); }} className="text-blue-400/50 hover:text-blue-300 text-xs w-full text-center">
          Different operator?
        </button>
      )}
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
    </div>
  );
}