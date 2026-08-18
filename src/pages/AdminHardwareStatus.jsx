import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { useRelayPolling } from "@/hooks/useRelayPolling";
import { logAuditEvent } from "@/lib/auditLogger";
import { HardDrive, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import StoreSection from "@/components/infrastructure/StoreSection";
import RebootConfirmDialog from "@/components/infrastructure/RebootConfirmDialog";
import RegisterHardwareCard from "@/components/infrastructure/RegisterHardwareCard";
import { DEFAULT_SETUP_STEPS } from "@/components/infrastructure/RelaySetupGuide";
import PXEControllerGuide from "@/components/infrastructure/PXEControllerGuide";
import HardwareLibraryPanel from "@/components/infrastructure/HardwareLibraryPanel";

export default function AdminHardwareStatus() {
  const [stores, setStores] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [setups, setSetups] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [newKeys, setNewKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [rebootStore, setRebootStore] = useState(null);
  const [rebooting, setRebooting] = useState(false);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [st, regs, sus, creds, logs] = await Promise.all([
        base44.entities.Store.list(),
        base44.entities.Register.list(),
        base44.entities.StoreRelaySetup.list(),
        base44.entities.RelayCredential.filter({ status: "active" }),
        base44.entities.RelaySyncLog.list("-synced_at", 200),
      ]);
      setStores(st.filter((s) => s.status !== "inactive"));
      setRegisters(regs);
      setSetups(sus);
      setCredentials(creds);
      setSyncLogs(logs);
    } catch (e) {
      if (!silent) toast({ title: "Error", description: "Failed to load infrastructure data", variant: "destructive" });
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const { relayData, pollNow } = useRelayPolling(stores);

  const sortedStores = useMemo(() => {
    let list = stores.filter((s) =>
      !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.store_number?.includes(search)
    );
    const reachRank = (s) => (relayData[s.store_number]?.status === "ok" ? 0 : relayData[s.store_number]?.status === "unreachable" ? 1 : 2);
    if (sortBy === "name") list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sortBy === "number") list = [...list].sort((a, b) => (a.store_number || "").localeCompare(b.store_number || ""));
    else if (sortBy === "reachability") list = [...list].sort((a, b) => reachRank(a) - reachRank(b));
    return list;
  }, [stores, search, sortBy, relayData]);

  const unassignedRegisters = useMemo(
    () => registers.filter((r) => !r.store_id || !stores.some((s) => s.store_number === r.store_id)),
    [registers, stores]
  );

  // ---- Manual hardware override (fallback when relay is offline) ----
  const handleOverride = async (reg, field, value) => {
    try {
      await base44.entities.Register.update(reg.id, { [field]: value });
      setRegisters((rs) => rs.map((r) => (r.id === reg.id ? { ...r, [field]: value } : r)));
      logAuditEvent({
        action: "Hardware Status Manually Overridden",
        category: "register",
        description: `${reg.name || reg.register_id}: ${field.replace(/_/g, " ")} set to '${value}' (manual override — relay offline).`,
        page: "/admin/hardware",
        changes: [{ field, from: String(reg[field] || "unknown"), to: value }],
      });
    } catch (e) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  // ---- Relay URL configuration ----
  const handleSaveRelayUrl = async (store, url) => {
    try {
      await base44.entities.Store.update(store.id, { relay_url: url });
      setStores((ss) => ss.map((s) => (s.id === store.id ? { ...s, relay_url: url } : s)));
      logAuditEvent({
        action: "Updated Store Relay URL",
        category: "configuration",
        description: `Relay URL for ${store.name} (#${store.store_number}) set to '${url || "(cleared)"}'.`,
        page: "/admin/hardware",
        changes: [{ field: "relay_url", from: store.relay_url || "", to: url }],
      });
      toast({ title: "Saved", description: `Relay URL updated for ${store.name}` });
      setTimeout(pollNow, 500);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save relay URL", variant: "destructive" });
    }
  };

  // ---- Setup guide checklist ----
  const handleToggleStep = async (store, stepId) => {
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    const existing = setups.find((s) => s.store_id === store.store_number);
    const baseSteps = existing?.steps?.length
      ? existing.steps
      : DEFAULT_SETUP_STEPS.map((s) => ({ ...s, completed: false, completed_by: "", completed_at: "" }));
    const steps = baseSteps.map((s) =>
      s.step_id === stepId
        ? { ...s, completed: !s.completed, completed_by: !s.completed ? actor.full_name || "Admin" : "", completed_at: !s.completed ? new Date().toISOString() : "" }
        : s
    );
    const now = new Date().toISOString();
    try {
      if (existing) {
        await base44.entities.StoreRelaySetup.update(existing.id, { steps, last_updated: now });
        setSetups((ss) => ss.map((s) => (s.id === existing.id ? { ...s, steps, last_updated: now } : s)));
      } else {
        const created = await base44.entities.StoreRelaySetup.create({ store_id: store.store_number, steps, last_updated: now });
        setSetups((ss) => [...ss, created]);
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save setup progress", variant: "destructive" });
    }
  };

  // ---- Per-store relay API key ----
  const handleGenerateKey = async (store) => {
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const key = `sfr_${store.store_number}_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const now = new Date().toISOString();
    try {
      const existing = credentials.find((c) => c.store_id === store.store_number);
      if (existing) await base44.entities.RelayCredential.update(existing.id, { status: "revoked" });
      const created = await base44.entities.RelayCredential.create({
        store_id: store.store_number,
        api_key: key,
        status: "active",
        generated_by: actor.full_name || "Admin",
        generated_at: now,
      });
      setCredentials((cs) => [...cs.filter((c) => c.store_id !== store.store_number), created]);
      setNewKeys((k) => ({ ...k, [store.store_number]: key }));
      logAuditEvent({
        action: existing ? "Regenerated Relay API Key" : "Generated Relay API Key",
        category: "system",
        description: `${existing ? "Regenerated (previous key revoked)" : "Generated"} the cloud sync API key for ${store.name} (#${store.store_number}). The relay VM must be updated with the new key to continue syncing.`,
        page: "/admin/hardware",
      });
      toast({ title: "Key Generated", description: "Copy it now — it is only shown once." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate relay key", variant: "destructive" });
    }
  };

  // ---- Force an immediate relay sync ----
  const handleForceSync = async (store) => {
    try {
      const res = await fetch(`${(store.relay_url || "").replace(/\/$/, "")}/api/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        toast({ title: "Sync Endpoint Missing", description: "The relay answered but has no /api/sync route — it is still running the pre-Phase 1 server.js. Deploy db.js, sync.js, api.js and the Phase 1 server.js from the setup guide.", variant: "destructive" });
      } else if (data.ok) {
        toast({ title: "Sync Complete", description: `${store.name} synced with the cloud.` });
      } else {
        toast({ title: "Sync Failed", description: data.error || `Relay returned HTTP ${res.status}. Check the relay log: journalctl -u sureflow-relay -n 50`, variant: "destructive" });
      }
      load(true);
      pollNow();
    } catch (e) {
      toast({ title: "Relay Unreachable", description: `Could not reach ${store.name}'s relay at ${store.relay_url || "(no relay URL set)"}. This browser must be on the store LAN, the relay service must be running, and it must send CORS headers.`, variant: "destructive" });
    }
  };

  // ---- Remote VM reboot ----
  const handleRebootConfirm = async () => {
    const store = rebootStore;
    if (!store) return;
    setRebooting(true);
    let ok = false;
    try {
      const res = await fetch(`${(store.relay_url || "").replace(/\/$/, "")}/proxmox/reboot`, { method: "POST" });
      ok = res.ok;
    } catch (e) {
      ok = false;
    }
    logAuditEvent({
      action: "Remote VM Reboot Issued",
      category: "system",
      description: `Remote reboot of the Local Relay VM issued for ${store.name} (#${store.store_number}). Relay ${ok ? "accepted the command" : "did not confirm receipt"}.`,
      page: "/admin/hardware",
    });
    toast(ok
      ? { title: "Reboot Issued", description: `${store.name}'s Relay VM is rebooting.` }
      : { title: "Reboot Sent", description: `Command sent, but ${store.name}'s relay did not confirm. Check the VM directly.`, variant: "destructive" });
    setRebooting(false);
    setRebootStore(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-blue-600" /> Infrastructure Command Center
          </h1>
          <p className="text-gray-500 text-sm mt-1">Per-store Relay VM health, network printers, and register hardware. Relays are polled every 30 seconds.</p>
        </div>
        <Button variant="outline" onClick={() => { load(true); pollNow(); }}><RefreshCw className="w-4 h-4 mr-2" /> Poll Now</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stores..." className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort by name</SelectItem>
            <SelectItem value="number">Sort by store #</SelectItem>
            <SelectItem value="reachability">Sort by reachability</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <PXEControllerGuide />

      <HardwareLibraryPanel />

      {sortedStores.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400">
          No stores configured. Add stores to begin monitoring their infrastructure.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedStores.map((store) => (
            <StoreSection
              key={store.id}
              store={store}
              relay={relayData[store.store_number]}
              registers={registers.filter((r) => r.store_id === store.store_number)}
              setupSteps={setups.find((s) => s.store_id === store.store_number)?.steps}
              lastSync={syncLogs.find((l) => l.store_id === store.store_number)}
              credential={credentials.find((c) => c.store_id === store.store_number)}
              newKey={newKeys[store.store_number]}
              onGenerateKey={handleGenerateKey}
              onForceSync={handleForceSync}
              onToggleStep={handleToggleStep}
              onRebootClick={setRebootStore}
              onOverride={handleOverride}
              onSaveRelayUrl={handleSaveRelayUrl}
            />
          ))}
        </div>
      )}

      {unassignedRegisters.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-900 mb-1">Unassigned Registers</p>
          <p className="text-xs text-gray-400 mb-3">These registers have no store number and are managed with manual status only.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {unassignedRegisters.map((r) => (
              <RegisterHardwareCard key={r.id} register={r} relayRegister={null} relayLive={false} onOverride={handleOverride} />
            ))}
          </div>
        </div>
      )}

      <RebootConfirmDialog
        open={!!rebootStore}
        onOpenChange={(v) => { if (!v) setRebootStore(null); }}
        storeName={rebootStore?.name || ""}
        onConfirm={handleRebootConfirm}
        submitting={rebooting}
      />
    </div>
  );
}