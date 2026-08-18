import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";

/**
 * Shown at the top of the POS whenever the store's relay has lost its connection
 * to the cloud. Cash and check tender only; sales are queued locally and uploaded
 * automatically once the connection returns.
 */
export default function POSOfflineBanner({ pendingCount = 0, catalogStale = false, onSyncNow, syncing = false }) {
  return (
    <div className="bg-gradient-to-r from-red-500/10 via-red-500/20 to-red-500/10 border-b-2 border-red-500/50 px-3 py-2 flex items-center justify-center gap-3 flex-shrink-0">
      <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-red-400 font-bold text-xs uppercase tracking-widest">
        OFFLINE MODE — CASH &amp; CHECK ONLY · SALES QUEUED LOCALLY
      </span>
      {pendingCount > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-200">
          {pendingCount} sale{pendingCount === 1 ? "" : "s"} waiting to upload
        </span>
      )}
      {catalogStale && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200">
          Prices over 24h old
        </span>
      )}
      <button
        onClick={onSyncNow}
        disabled={syncing}
        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-200/80 hover:text-white disabled:opacity-40"
      >
        <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} /> Retry Now
      </button>
    </div>
  );
}