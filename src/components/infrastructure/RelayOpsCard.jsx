import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, DatabaseBackup, DownloadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relayBackupNow, relaySelfUpdate } from "@/lib/relayClient";
import RelayAccessTokenCard from "@/components/infrastructure/RelayAccessTokenCard";
import RelayCommandStatus from "@/components/infrastructure/RelayCommandStatus";

// Phase 3 — on-demand local backup and relay self-update, plus the relay's
// token-protection state as reported by /status.
//
// Operations take whichever path the store's network allows: a directly reachable relay
// is called now, and everything else is queued for the relay to collect on its next
// sync pass. The buttons look the same either way — the difference shows up as a
// "waiting for the next sync pass" line rather than an immediate result.
export default function RelayOpsCard({ store, relay, credential, newToken, onGenerateToken, commands = [], onQueueCommand }) {
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);

  const live = relay?.status === "ok";
  const reporting = live || relay?.status === "snapshot";
  const phase = relay?.data?.phase || null;
  const secured = !!relay?.data?.secured;
  const base = store.relay_url || "";

  const run = async (kind) => {
    setBusy(kind); setResult(null);
    const commandType = kind === "backup" ? "backup" : "self_update";

    if (!live) {
      // No inbound route — hand it to the queue and let the card's status line report it.
      await onQueueCommand?.(store, commandType);
      setBusy("");
      return;
    }
    try {
      const res = kind === "backup" ? await relayBackupNow(base) : await relaySelfUpdate(base);
      setResult({ ok: true, text: res.output || res.message || "Done" });
    } catch (e) {
      setResult({ ok: false, text: e.message === "HTTP 401" ? "Relay token missing or wrong for this store" : e.message });
    }
    setBusy("");
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Relay Operations</p>
        {reporting && phase === 3 ? (
          secured ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-3.5 h-3.5" /> Token secured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
              <ShieldAlert className="w-3.5 h-3.5" /> Routes open
            </span>
          )
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
            {reporting ? "Phase 1/2 relay" : "Not reporting"}
          </span>
        )}
      </div>

      {!reporting ? (
        <p className="text-xs text-gray-400 py-4 text-center">This relay has not reported in — operations can be queued once it syncs</p>
      ) : phase !== 3 ? (
        <p className="text-xs text-gray-500 py-3">
          This relay is not running the Phase 3 server yet. Complete the Phase 3 telemetry and resilience steps in the setup guide below.
        </p>
      ) : (
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" disabled={!!busy} onClick={() => run("backup")}>
            {busy === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />}
            Back Up Now
          </Button>
          <Button variant="outline" className="w-full justify-start" disabled={!!busy} onClick={() => run("update")}>
            {busy === "update" ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Run Self-Update
          </Button>
          <p className="text-[11px] text-gray-400 leading-snug">
            Backup writes a database + .env snapshot on the VM. Self-update pulls the store's update source, restarts the relay, and rolls back automatically if it stops answering.
            {!live && " This store is commanded through its outbound sync, so operations run on the next sync pass rather than instantly."}
          </p>
          {result && (
            <p className={`text-xs font-mono break-words ${result.ok ? "text-emerald-600" : "text-red-600"}`}>{result.text}</p>
          )}
        </div>
      )}

      <RelayCommandStatus storeNumber={store.store_number} commands={commands} />

      <RelayAccessTokenCard
        store={store}
        credential={credential}
        newToken={newToken}
        onGenerateToken={onGenerateToken}
      />
    </div>
  );
}