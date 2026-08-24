import React, { useState } from "react";
import { Layers, Pencil, RotateCcw, ShieldCheck, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Per-store view of the controller pair: which box is acting primary, whether a
// failover has happened, and the controlled failback back to the original primary.
export default function StoreRedundancyCard({ store, onSaveHa, onFailback }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    ha_enabled: !!store.ha_enabled,
    controller_vip: store.controller_vip || "",
    primary_controller_host: store.primary_controller_host || "",
    secondary_controller_host: store.secondary_controller_host || "",
  });
  const [saving, setSaving] = useState(false);

  const onSecondary = store.acting_primary === "secondary";

  const save = async () => {
    setSaving(true);
    await onSaveHa(store, {
      ha_enabled: draft.ha_enabled,
      controller_vip: draft.controller_vip.trim(),
      primary_controller_host: draft.primary_controller_host.trim(),
      secondary_controller_host: draft.secondary_controller_host.trim(),
    });
    setSaving(false);
    setEditing(false);
  };

  const field = (label, key, placeholder) => (
    <div>
      <p className="mb-1 text-[11px] font-medium text-gray-500">{label}</p>
      <Input
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-8 font-mono text-xs"
      />
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          <p className="text-sm font-semibold text-gray-900">Controller Redundancy</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600">
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-xs font-medium text-gray-700">Redundant pair enabled</p>
            <Switch checked={draft.ha_enabled} onCheckedChange={(v) => setDraft((d) => ({ ...d, ha_enabled: v }))} />
          </div>
          {field("Floating VIP (lanes + relay use this)", "controller_vip", "192.168.1.50")}
          {field("Primary controller (ctrl-a)", "primary_controller_host", "192.168.1.51")}
          {field("Secondary controller (ctrl-b)", "secondary_controller_host", "192.168.1.52")}
          <p className="text-[11px] leading-relaxed text-gray-400">
            The store's Relay URL must point at the VIP, not at a box address, or the cloud keeps polling a dead
            controller after a failover.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="flex-1">{saving ? "Saving..." : "Save"}</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : !store.ha_enabled ? (
        <p className="py-4 text-center text-xs text-gray-400">
          Single controller — no redundancy. A controller failure takes this store dark until it is restored.
        </p>
      ) : (
        <div className="space-y-3">
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${onSecondary ? "bg-amber-50" : "bg-emerald-50"}`}>
            {onSecondary ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
            <p className={`text-xs font-semibold ${onSecondary ? "text-amber-900" : "text-emerald-900"}`}>
              {onSecondary ? "Running on SECONDARY controller" : "Primary controller healthy"}
            </p>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">Floating VIP</span>
              <span className="font-mono text-gray-700">{store.controller_vip || "not set"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">Primary (ctrl-a)</span>
              <span className={`font-mono ${onSecondary ? "text-gray-400 line-through" : "text-gray-700"}`}>
                {store.primary_controller_host || "not set"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-400">Secondary (ctrl-b)</span>
              <span className={`font-mono ${onSecondary ? "font-semibold text-amber-700" : "text-gray-700"}`}>
                {store.secondary_controller_host || "not set"}
              </span>
            </div>
            {store.last_failover_at && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-400">Last failover</span>
                <span className="text-gray-700">{format(new Date(store.last_failover_at), "MMM d, h:mm a")}</span>
              </div>
            )}
          </div>

          {store.last_failover_reason && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
              {store.last_failover_reason}
            </p>
          )}

          {store.failback_pending && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] leading-relaxed text-amber-800">
                Fail back only once the original primary is up and DRBD reads <span className="font-mono">UpToDate/UpToDate</span> on
                both boxes. Failing back mid-resync serves lanes a half-copied root.
              </p>
              <Button size="sm" variant="outline" className="w-full" onClick={() => onFailback(store)}>
                <RotateCcw className="mr-2 h-3.5 w-3.5" /> Mark Failed Back to Primary
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}