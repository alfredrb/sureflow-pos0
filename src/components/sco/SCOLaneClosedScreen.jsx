import React from "react";
import { Lock, PauseCircle } from "lucide-react";

// Shown to the customer when an attendant has closed or paused this lane. The
// attendant menu in the header stays reachable so the lane can be reopened here.
export default function SCOLaneClosedScreen({ closed, reason }) {
  const Icon = closed ? Lock : PauseCircle;
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
      <Icon className="w-24 h-24 text-blue-400/50" />
      <h1 className="text-white text-5xl font-bold">{closed ? "Lane Closed" : "Lane Paused"}</h1>
      <p className="text-blue-200/70 text-2xl max-w-xl">
        {closed ? "Please use another self-checkout or any open register." : "An attendant is on the way — please wait."}
      </p>
      {closed && reason && <p className="text-blue-300/40 text-lg">{reason}</p>}
    </div>
  );
}