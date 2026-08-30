import React, { useState } from "react";
import { PauseCircle, Unlock, Lock } from "lucide-react";

// Pause / close controls for one overseen self-checkout lane, run by the operator
// already signed on to the attendant register.
export default function SCOLaneControlButtons({ lane, onPause, onResume, onCloseLane, onOpenLane }) {
  const [confirmClose, setConfirmClose] = useState(false);
  const closed = !!lane.sco_closed;
  const paused = !!lane.paused;
  const btn = "flex-1 h-8 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1";

  if (confirmClose) {
    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-red-200 text-[11px]">Take {lane.register_id} out of service?</p>
        <div className="flex gap-2">
          <button onClick={() => { setConfirmClose(false); onCloseLane("Closed by attendant"); }} className={`${btn} bg-red-600 hover:bg-red-500 text-white`}>Close lane</button>
          <button onClick={() => setConfirmClose(false)} className={`${btn} bg-[#1a1f4a] border border-blue-500/20 text-blue-200`}>Keep open</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex gap-2">
      {closed ? (
        <button onClick={onOpenLane} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
          <Unlock className="w-3 h-3" /> Open lane
        </button>
      ) : (
        <>
          <button
            onClick={paused ? onResume : onPause}
            className={`${btn} ${paused ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-[#1a1f4a] border border-blue-500/20 text-blue-200 hover:border-blue-500/40"}`}
          >
            {paused ? <Unlock className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button onClick={() => setConfirmClose(true)} className={`${btn} bg-red-500/10 border border-red-500/30 text-red-300 hover:border-red-500/60`}>
            <Lock className="w-3 h-3" /> Close
          </button>
        </>
      )}
    </div>
  );
}