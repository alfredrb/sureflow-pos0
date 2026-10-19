import React from "react";
import { Server, ServerOff, Cloud, CloudOff, Database, Upload } from "lucide-react";

// Compact lane readiness strip: relay reachability, cloud link, catalog freshness,
// queued offline sales and which tenders are available right now.
function Pill({ ok, warn, icon: Icon, label }) {
  const tone = ok ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
    : warn ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
    : "text-red-300 bg-red-500/10 border-red-500/30";
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${tone}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

export default function POSReadinessChip({ relayPresent, isOffline, catalogStale, pendingCount, lastSyncAt }) {
  const syncAge = lastSyncAt ? Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60000) : null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-2">
      <Pill ok={relayPresent} warn={!relayPresent} icon={relayPresent ? Server : ServerOff} label={relayPresent ? "Relay OK" : "No relay — offline sales unavailable"} />
      <Pill ok={!isOffline} icon={isOffline ? CloudOff : Cloud} label={isOffline ? "Cloud down" : "Cloud OK"} />
      {relayPresent && (
        <Pill ok={!catalogStale} warn={catalogStale} icon={Database} label={catalogStale ? "Catalog stale" : `Catalog synced${syncAge !== null ? ` ${syncAge}m ago` : ""}`} />
      )}
      {relayPresent && (
        <Pill ok={pendingCount === 0} warn={pendingCount > 0} icon={Upload} label={pendingCount > 0 ? `${pendingCount} queued` : "Queue clear"} />
      )}
      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300/60">
        Tenders: {isOffline ? "Cash · Check" : "All"}
      </span>
    </div>
  );
}