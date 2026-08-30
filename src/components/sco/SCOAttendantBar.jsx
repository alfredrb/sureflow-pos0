import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import SCOAttendantSignIn from "@/components/sco/SCOAttendantSignIn";
import SCOAttendantMenuDialog from "@/components/sco/SCOAttendantMenuDialog";
import SCODiagnosticsDialog from "@/components/sco/SCODiagnosticsDialog";

// Attendant control in the self-checkout top bar: sign on, then suspend or hand
// off the order, hold or close the lane, or open lane diagnostics.
export default function SCOAttendantBar({
  register, attendant, setAttendant, hasItems, itemCount,
  onSuspend, onSendToRegister, onPause, onResume, onCloseLane, onOpenLane,
}) {
  const [signIn, setSignIn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [diag, setDiag] = useState(false);
  const run = (fn) => (...args) => { setMenu(false); fn(...args); };

  return (
    <>
      <button
        onClick={() => (attendant ? setMenu(true) : setSignIn(true))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${
          attendant
            ? "bg-blue-600 border-blue-400 text-white"
            : "bg-[#0a0e27] border-blue-500/20 text-blue-300/50 hover:text-blue-200 hover:border-blue-500/40"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        {attendant ? attendant.full_name : "Attendant"}
      </button>

      <SCOAttendantSignIn
        open={signIn}
        onClose={() => setSignIn(false)}
        onSignedIn={(op) => { setAttendant(op); setSignIn(false); setMenu(true); }}
      />

      <SCOAttendantMenuDialog
        open={menu && !!attendant}
        onClose={() => setMenu(false)}
        attendant={attendant}
        register={register}
        hasItems={hasItems}
        attendantRegisterId={register?.attendant_register_id || ""}
        onSuspend={run(onSuspend)}
        onSendToRegister={run(onSendToRegister)}
        onPause={run(onPause)}
        onResume={run(onResume)}
        onClose_Lane={run(onCloseLane)}
        onOpenLane={run(onOpenLane)}
        onDiagnostics={() => { setMenu(false); setDiag(true); }}
        onSignOut={run(() => setAttendant(null))}
      />

      <SCODiagnosticsDialog
        open={diag}
        onClose={() => setDiag(false)}
        register={register}
        itemCount={itemCount}
        technician={attendant?.role === "technician"}
      />
    </>
  );
}