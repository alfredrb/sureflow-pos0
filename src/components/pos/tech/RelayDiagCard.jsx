import React, { useState } from "react";
import { Activity, Wifi, RefreshCw, Server, MapPin } from "lucide-react";
import TechDiagCard from "@/components/pos/tech/TechDiagCard";
import TechDiagTile from "@/components/pos/tech/TechDiagTile";
import LaneRelayDiagnostic from "@/components/pos/LaneRelayDiagnostic";
import { fetchConnectivity, fetchLocalIp, forceRelaySync } from "@/lib/relayClient";
import moment from "moment";

// Splits the two failures that look identical from the lane: the internet being down,
// and the store relay being unreachable from this terminal. A lane can sell offline
// through its relay, so knowing which one is broken decides whether the technician
// touches the WAN or the terminal.
export default function RelayDiagCard({ loadData, toast }) {
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState({});
  const [conn, setConn] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setRes((p) => ({ ...p, [key]: { status: null, detail: "" } }));
    try {
      const detail = await fn();
      setRes((p) => ({ ...p, [key]: { status: "pass", detail } }));
    } catch (e) {
      setRes((p) => ({ ...p, [key]: { status: "fail", detail: e.message || "failed" } }));
    }
    setBusy(null);
  };
  const at = (k) => res[k] || {};

  const cloudTest = () => run("cloud", async () => {
    if (!navigator.onLine) throw new Error("Terminal reports no network link");
    const t0 = performance.now();
    await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    return `Cloud reachable · ${Math.round(performance.now() - t0)} ms round trip`;
  });

  const relayState = () => run("relay", async () => {
    const c = await fetchConnectivity();
    setConn(c);
    return `Relay answered · cloud link ${c.online ? "up" : "down"}`;
  });

  const whoami = () => run("ip", async () => {
    const out = await fetchLocalIp();
    return `This lane is ${out?.ip || out?.address || "—"} on the store LAN`;
  });

  const sync = () => run("sync", async () => {
    await loadData?.();
    let relayed = " · relay sync unavailable";
    try {
      await forceRelaySync();
      relayed = " · relay pushed its outbox";
    } catch (e) {}
    toast?.({ title: "Sync Complete", description: "Register data reloaded" });
    return `Catalog reloaded${relayed}`;
  });

  return (
    <TechDiagCard icon={Activity} title="Network, Relay &amp; Sync" hint={navigator.onLine ? "link up" : "link down"}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        <TechDiagTile icon={Wifi} label="Cloud Reachability" onClick={cloudTest} busy={busy === "cloud"} {...at("cloud")} />
        <TechDiagTile icon={Server} label="Relay State" onClick={relayState} busy={busy === "relay"} {...at("relay")} />
        <TechDiagTile icon={MapPin} label="Lane IP (whoami)" onClick={whoami} busy={busy === "ip"} {...at("ip")} />
        <TechDiagTile icon={RefreshCw} label="Force Data Sync" onClick={sync} busy={busy === "sync"} {...at("sync")} />
      </div>

      {conn && (
        <div className="bg-[#0a0e27] rounded-lg border border-slate-500/10 p-3 text-xs space-y-1 mb-3">
          <div className="flex justify-between"><span className="text-slate-400">Cloud link</span><span className={conn.online ? "text-emerald-400" : "text-red-400"}>{conn.online ? "online" : "offline"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Queued sales</span><span className={`font-mono ${conn.pending_count ? "text-amber-400" : "text-white"}`}>{conn.pending_count ?? 0}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Last sync</span><span className="text-white font-mono">{conn.last_sync_at ? moment(conn.last_sync_at).format("MMM D h:mm A") : "—"}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Cached catalog</span><span className={`font-mono ${conn.catalog_stale ? "text-amber-400" : "text-white"}`}>{conn.catalog_cached_at ? moment(conn.catalog_cached_at).fromNow() : "none"}{conn.catalog_stale ? " (stale)" : ""}</span></div>
        </div>
      )}

      <LaneRelayDiagnostic />
    </TechDiagCard>
  );
}