import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { getRelayBase, fetchConnectivity } from "@/lib/relayClient";

// Shown in the POS Configuration panel. Answers the two questions that decide
// whether a lane can print: does this terminal know its relay address at all, and
// can the browser actually reach it (a blocked mixed-content request fails here
// while curl on the same lane succeeds).
export default function LaneRelayDiagnostic() {
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const base = getRelayBase();
  const captured = !!localStorage.getItem("relay_base_url");

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const c = await fetchConnectivity();
      setResult({ ok: true, message: `Relay reached — cloud link ${c.online ? "up" : "down"}` });
    } catch (e) {
      setResult({ ok: false, message: e.message });
    }
    setTesting(false);
  };

  return (
    <div className="bg-[#0a0e27] border border-blue-500/10 rounded-lg px-3 py-2 space-y-2">
      <div>
        <p className="text-blue-300/40 text-[10px] uppercase tracking-wider">Relay Address</p>
        <p className={`font-mono text-xs break-all ${captured ? "text-blue-200" : "text-amber-400"}`}>
          {captured ? base : `${base} (not set — falling back to the page origin)`}
        </p>
      </div>
      <button
        onClick={runTest}
        disabled={testing}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-200 text-[10px] font-bold uppercase tracking-wider hover:bg-blue-600/30 disabled:opacity-50"
      >
        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        Test Relay Connection
      </button>
      {result && (
        <div className={`flex items-start gap-1.5 text-[10px] ${result.ok ? "text-green-400" : "text-red-400"}`}>
          {result.ok ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />}
          <span className="break-all">{result.message}</span>
        </div>
      )}
    </div>
  );
}