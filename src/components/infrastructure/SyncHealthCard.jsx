import React, { useState } from "react";
import { CloudUpload, KeyRound, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// Per-store cloud sync health: last successful sync, pending offline sales,
// catalog cache freshness, and per-store relay API key management.
export default function SyncHealthCard({ store, relay, lastSync, credential, newKey, onGenerateKey, onForceSync }) {
  const [copied, setCopied] = useState(false);
  const relaySync = relay?.data?.sync;
  const pending = relaySync?.pending_count ?? null;

  const syncAt = relaySync?.last_sync_at || lastSync?.synced_at || null;
  const ageMin = syncAt ? (Date.now() - new Date(syncAt).getTime()) / 60000 : null;
  const health = ageMin === null ? "none" : ageMin <= 5 ? "good" : ageMin <= 30 ? "warn" : "bad";
  const healthMeta = {
    good: { cls: "bg-emerald-50 text-emerald-600", label: "Synced" },
    warn: { cls: "bg-amber-50 text-amber-600", label: "Sync Delayed" },
    bad: { cls: "bg-red-50 text-red-600", label: "Sync Stale" },
    none: { cls: "bg-gray-100 text-gray-500", label: "Never Synced" },
  }[health];

  const copyKey = () => {
    navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-blue-600" /> Cloud Sync
        </p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${healthMeta.cls}`}>{healthMeta.label}</span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Last successful sync</span>
          <span className="font-medium text-gray-900">{syncAt ? format(new Date(syncAt), "MMM d, h:mm:ss a") : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Pending offline sales</span>
          <span className={`font-semibold ${pending > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {pending === null ? "—" : pending}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Catalog cache</span>
          <span className={`font-medium ${relaySync?.catalog_stale ? "text-red-600" : "text-gray-900"}`}>
            {relaySync?.catalog_cached_at
              ? `${format(new Date(relaySync.catalog_cached_at), "MMM d, h:mm a")}${relaySync.catalog_stale ? " (stale)" : ""}`
              : "—"}
          </span>
        </div>
        {lastSync?.status && lastSync.status !== "success" && (
          <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-2 py-1.5 break-all">
            Last {lastSync.direction}: {lastSync.error || lastSync.status}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Relay API key
          </span>
          <span className="text-[11px] font-medium text-gray-700">
            {credential ? `Active · ${credential.last_used_at ? `used ${format(new Date(credential.last_used_at), "MMM d, h:mm a")}` : "never used"}` : "Not generated"}
          </span>
        </div>
        {newKey && (
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 flex items-center gap-2">
            <code className="text-[10px] text-emerald-300 font-mono break-all flex-1">{newKey}</code>
            <button onClick={copyKey} className="p-1 rounded text-gray-400 hover:text-white flex-shrink-0">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        {newKey && <p className="text-[10px] text-amber-600">Copy this now — it will not be shown again after you leave the page.</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onGenerateKey(store)}>
            {credential ? "Regenerate Key" : "Generate Key"}
          </Button>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => onForceSync(store)} disabled={relay?.status !== "ok"} title="Ask the relay to sync immediately">
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Force Sync
          </Button>
        </div>
      </div>
    </div>
  );
}