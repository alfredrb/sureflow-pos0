import React, { useState, useEffect } from "react";
import { Power, Loader2, AlertTriangle } from "lucide-react";
import { rebootLane } from "@/lib/relayClient";

// Full-screen 5-second countdown before the lane reboots. Cancel aborts it; on zero
// the relay is asked to reboot this lane and the kiosk goes down with it.
export default function RebootCountdownOverlay({ open, onClose, registerId }) {
  const [seconds, setSeconds] = useState(5);
  const [phase, setPhase] = useState("counting"); // counting | sending | failed
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSeconds(5);
    setPhase("counting");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "counting") return;
    if (seconds <= 0) {
      setPhase("sending");
      rebootLane({ register_id: registerId, requested_by: "POS" }).catch((e) => {
        setPhase("failed");
        setError(e.message || "The relay could not reboot this lane.");
      });
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, phase, seconds, registerId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#111638] border border-red-500/30 rounded-2xl p-6 text-center space-y-4">
        {phase === "failed" ? (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <p className="text-white font-semibold">Reboot Failed</p>
            <p className="text-blue-300/70 text-xs leading-relaxed">{error}</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-[#1a1f4a] hover:bg-[#222866] text-white text-sm font-bold border border-blue-500/10">
              Close
            </button>
          </>
        ) : phase === "sending" ? (
          <>
            <Loader2 className="w-10 h-10 text-red-400 mx-auto animate-spin" />
            <p className="text-white font-semibold">Rebooting lane…</p>
            <p className="text-blue-300/60 text-xs">This terminal will go dark and return to the login screen.</p>
          </>
        ) : (
          <>
            <Power className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-white font-semibold">Rebooting lane in</p>
            <p className="text-red-400 font-mono text-6xl font-bold leading-none">{seconds}</p>
            <p className="text-blue-300/60 text-xs leading-relaxed">
              {registerId ? `${registerId} — ` : ""}any in-progress transaction will be lost.
            </p>
            <button onClick={onClose} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-base font-bold transition-colors">
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}