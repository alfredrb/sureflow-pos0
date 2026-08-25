import React, { useState } from "react";
import { Building2, ChevronDown, WifiOff, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import VMHealthCard from "@/components/infrastructure/VMHealthCard";
import PrinterStatusCard from "@/components/infrastructure/PrinterStatusCard";
import RegisterHardwareCard from "@/components/infrastructure/RegisterHardwareCard";
import RelaySetupGuide from "@/components/infrastructure/RelaySetupGuide";
import SyncHealthCard from "@/components/infrastructure/SyncHealthCard";
import RelayOpsCard from "@/components/infrastructure/RelayOpsCard";
import StoreRedundancyCard from "@/components/infrastructure/StoreRedundancyCard";
import LaneMaintenanceCard from "@/components/infrastructure/LaneMaintenanceCard";
import StoreUpdateTile from "@/components/infrastructure/StoreUpdateTile";

export default function StoreSection({ store, relay, registers, setupSteps, lastSync, credential, newKey, newToken, onGenerateToken, commands = [], onQueueCommand, maintenanceWindow, maintenanceTasks, updateAssignments = [], onSaveMaintenance, onPlanMaintenance, planningMaintenance, onToggleStep, onRebootClick, onOverride, onSaveRelayUrl, onGenerateKey, onForceSync, onSaveHa, onFailback }) {
  const [open, setOpen] = useState(true);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(store.relay_url || "");

  // Two ways a store can be healthy now. 'ok' means the relay answered the portal
  // directly (a public relay URL — instant operations). 'snapshot' means it pushed
  // fresh telemetry up on its last sync pass, which is the normal path for a relay on
  // a private store LAN the cloud has no route into.
  const live = relay?.status === "ok";
  const pushed = relay?.status === "snapshot";
  const reachable = live || pushed;
  const unreachable = !reachable;
  const stale = relay?.status === "stale";
  const awaiting = relay?.status === "awaiting";
  const statusLabel =
    relay?.status === "no_url" ? "No Relay URL"
    : stale ? "Awaiting Relay Sync"
    : awaiting ? "No Status Pushed Yet"
    : "Awaiting Relay Sync";
  const relayRegisters = relay?.data?.registers || [];

  const saveUrl = () => {
    onSaveRelayUrl(store, urlDraft.trim());
    setEditingUrl(false);
  };

  return (
    <div className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${unreachable ? "border-gray-200" : "border-gray-100"}`}>
      <div className={`px-5 py-4 flex items-center justify-between gap-3 ${unreachable ? "bg-gray-50" : ""}`}>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 min-w-0 text-left flex-1">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${reachable ? "bg-emerald-50" : "bg-gray-100"}`}>
            <Building2 className={`w-5 h-5 ${reachable ? "text-emerald-600" : "text-gray-400"}`} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{store.name} <span className="text-gray-400 font-normal text-sm">#{store.store_number}</span></p>
            <p className="text-xs text-gray-400 truncate">
              {relay?.pushedAt
                ? `Relay reported: ${format(new Date(relay.pushedAt), "MMM d, h:mm:ss a")}`
                : relay?.lastPoll ? `Checked: ${format(new Date(relay.lastPoll), "h:mm:ss a")}` : "No report yet"}
              {live && " · reachable directly"}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-1 ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          {reachable ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {live ? "Relay Online (direct)" : "Relay Reporting"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-600">
              <WifiOff className="w-3.5 h-3.5" /> {statusLabel}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="flex-shrink-0">Relay URL:</span>
        {editingUrl ? (
          <>
            <Input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="http://192.168.1.50:3000" className="h-7 text-xs font-mono max-w-xs" autoFocus />
            <button onClick={saveUrl} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setEditingUrl(false); setUrlDraft(store.relay_url || ""); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <>
            <span className="font-mono text-gray-700">{store.relay_url || "not configured"}</span>
            <button onClick={() => { setUrlDraft(store.relay_url || ""); setEditingUrl(true); }} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="w-3 h-3" /></button>
          </>
        )}
      </div>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {stale ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              This store has not reported in since{" "}
              <span className="font-medium">{relay?.pushedAt ? format(new Date(relay.pushedAt), "MMM d, h:mm a") : "an unknown time"}</span>.
              The panels below show its last known state, not current truth. The relay reports upward on each sync
              pass, so a gap means the relay is down, has no internet, or its sync key is wrong — check{" "}
              <span className="font-mono">journalctl -u sureflow-relay -n 50</span> on the controller. Operations you
              issue now are queued and will run as soon as it reports back.
            </div>
          ) : awaiting ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
              This store has never pushed status up. The portal no longer reaches into store networks — each relay
              reports its own health on its sync pass — so this store needs a valid{" "}
              <span className="font-mono">CLOUD_SYNC_URL</span>, <span className="font-mono">STORE_ID</span> and{" "}
              <span className="font-mono">CLOUD_API_KEY</span> in its <span className="font-mono">.env</span>, and the
              relay running. Generate a sync key on the Cloud Sync card below if it has none.
            </div>
          ) : pushed ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700">
              Reporting normally over its outbound sync — no inbound access into the store network is used or needed.
              Operations are queued and picked up on the next sync pass.
            </div>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <VMHealthCard vmStats={relay?.data?.vm_stats} unreachable={unreachable} onRebootClick={() => onRebootClick(store)} />
            <PrinterStatusCard printers={relay?.data?.printers} unreachable={unreachable} />
            <SyncHealthCard
              store={store}
              relay={relay}
              lastSync={lastSync}
              credential={credential}
              newKey={newKey}
              onGenerateKey={onGenerateKey}
              onForceSync={onForceSync}
            />
            <RelayOpsCard
              store={store}
              relay={relay}
              credential={credential}
              newToken={newToken}
              onGenerateToken={onGenerateToken}
              commands={commands}
              onQueueCommand={onQueueCommand}
            />
            <StoreRedundancyCard store={store} onSaveHa={onSaveHa} onFailback={onFailback} />
            <LaneMaintenanceCard
              key={maintenanceWindow?.id || "no-window"}
              store={store}
              window={maintenanceWindow}
              tasks={maintenanceTasks}
              onSave={onSaveMaintenance}
              onRunNow={onPlanMaintenance}
              running={planningMaintenance}
            />
            <StoreUpdateTile assignments={updateAssignments} windowEnabled={!!maintenanceWindow?.enabled} />
            <div className="bg-white border border-gray-100 rounded-2xl p-5 md:col-span-2 xl:col-span-1">
              <p className="text-sm font-semibold text-gray-900 mb-3">Register Hardware</p>
              {registers.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No registers assigned to this store</p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {registers.map((r) => (
                    <RegisterHardwareCard
                      key={r.id}
                      register={r}
                      relayRegister={relayRegisters.find((rr) => rr.register_id === r.register_id)}
                      relayLive={reachable}
                      onOverride={onOverride}
                      relayBase={store.relay_url || ""}
                      store={store}
                      direct={live}
                      onQueueCommand={onQueueCommand}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <RelaySetupGuide steps={setupSteps} onToggleStep={(stepId) => onToggleStep(store, stepId)} />
        </div>
      )}
    </div>
  );
}