import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/data";
import { Link } from "react-router-dom";
import { useRelayPolling } from "@/hooks/useRelayPolling";
import { logAuditEvent } from "@/lib/auditLogger";
import { forceRelaySync, rebootRelayVm } from "@/lib/relayClient";
import { queueRelayCommand, isFastPathAvailable, COMMAND_LABELS } from "@/lib/relayCommandQueue";
import { HardDrive, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import StoreSection from "@/components/infrastructure/StoreSection";
import OpsNotificationsCard from "@/components/infrastructure/OpsNotificationsCard";
import RebootConfirmDialog from "@/components/infrastructure/RebootConfirmDialog";
import RegisterHardwareCard from "@/components/infrastructure/RegisterHardwareCard";
import { DEFAULT_SETUP_STEPS } from "@/components/infrastructure/RelaySetupGuide";

export default function AdminHardwareStatus() {
  const [stores, setStores] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [setups, setSetups] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [windows, setWindows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [updateAssignments, setUpdateAssignments] = useState([]);
  const [commands, setCommands] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [savingOps, setSavingOps] = useState(false);
  const [testingOps, setTestingOps] = useState(false);
  const [newKeys, setNewKeys] = useState({});
  const [newTokens, setNewTokens] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [rebootStore, setRebootStore] = useState(null);
  const [rebooting, setRebooting] = useState(false);
  const { toast } = useToast();

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [st, regs, sus, creds, logs, sets, wins, mtasks, upd, cmds] = await Promise.all([
        base44.entities.Store.list(),
        base44.entities.Register.list(),
        base44.entities.StoreRelaySetup.list(),
        base44.entities.RelayCredential.filter({ status: "active" }),
        base44.entities.RelaySyncLog.list("-synced_at", 200),
        base44.entities.StoreSettings.list(),
        base44.entities.LaneMaintenanceWindow.list(),
        base44.entities.LaneMaintenanceTask.list("-created_date", 300),
        base44.entities.RelayUpdateAssignment.list("-created_date", 300),
        base44.entities.RelayCommand.list("-created_date", 200),
      ]);
      setUpdateAssignments(upd);
      setCommands(cmds);
      setSettings(sets.find((s) => !s.store_id) || sets[0] || null);
      setWindows(wins);
      setTasks(mtasks);
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

  // ---- Ops notification recipients for critical system alerts ----
  const handleSaveOps = async (values) => {
    setSavingOps(true);
    try {
      let saved;
      if (settings) {
        await base44.entities.StoreSettings.update(settings.id, values);
        saved = { ...settings, ...values };
      } else {
        saved = await base44.entities.StoreSettings.create({ store_name: "SureFlow", ...values });
      }
      setSettings(saved);
      logAuditEvent({
        action: "Updated Ops Notification Recipients",
        category: "configuration",
        description: `System alert notifications set to ${values.ops_notification_emails.length} recipient(s): ${values.ops_notification_emails.join(", ") || "(none)"}. Minimum severity '${values.ops_notify_min_severity}', reminder every ${values.ops_renotify_hours} hours.`,
        page: "/admin/hardware",
        changes: [
          { field: "ops_notification_emails", from: (settings?.ops_notification_emails || []).join(", "), to: values.ops_notification_emails.join(", ") },
          { field: "ops_notify_min_severity", from: settings?.ops_notify_min_severity || "critical", to: values.ops_notify_min_severity },
          { field: "ops_renotify_hours", from: String(settings?.ops_renotify_hours ?? 12), to: String(values.ops_renotify_hours) },
        ],
      });
      toast({ title: "Saved", description: "Ops notification settings updated." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save notification settings", variant: "destructive" });
    }
    setSavingOps(false);
  };

  const handleTestOps = async () => {
    setTestingOps(true);
    try {
      const res = await base44.functions.invoke("dispatchSystemAlerts", { test: true });
      if (res.data?.ok) {
        toast({ title: "Test Sent", description: `Test notification sent to ${res.data.sent_to} recipient(s).` });
      } else {
        toast({ title: "Test Failed", description: res.data?.error || "Could not send the test notification.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Test Failed", description: "Could not send the test notification. Save the recipient list first.", variant: "destructive" });
    }
    setTestingOps(false);
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

  // ---- Controller redundancy (dual PXE controller + dual relay pair) ----
  const handleSaveHa = async (store, values) => {
    try {
      await base44.entities.Store.update(store.id, values);
      setStores((ss) => ss.map((s) => (s.id === store.id ? { ...s, ...values } : s)));
      logAuditEvent({
        action: "Updated Controller Redundancy Configuration",
        category: "configuration",
        description: `Redundant controller pair for ${store.name} (#${store.store_number}) ${values.ha_enabled ? "enabled" : "disabled"}. VIP '${values.controller_vip || "(none)"}', primary '${values.primary_controller_host || "(none)"}', secondary '${values.secondary_controller_host || "(none)"}'.`,
        page: "/admin/hardware",
        changes: Object.keys(values).map((f) => ({ field: f, from: String(store[f] ?? ""), to: String(values[f]) })),
      });
      toast({ title: "Saved", description: `Redundancy settings updated for ${store.name}` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save redundancy settings", variant: "destructive" });
    }
  };

  const handleFailback = async (store) => {
    const patch = { acting_primary: "primary", failback_pending: false };
    try {
      await base44.entities.Store.update(store.id, patch);
      setStores((ss) => ss.map((s) => (s.id === store.id ? { ...s, ...patch } : s)));
      logAuditEvent({
        action: "Controller Failback to Primary",
        category: "system",
        description: `${store.name} (#${store.store_number}) marked failed back to its primary controller (${store.primary_controller_host || "unknown"}) after running on the secondary since ${store.last_failover_at || "an unrecorded time"}.`,
        page: "/admin/hardware",
        changes: [{ field: "acting_primary", from: "secondary", to: "primary" }],
      });
      toast({ title: "Failed Back", description: `${store.name} is recorded as running on its primary controller.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to record failback", variant: "destructive" });
    }
  };

  // ---- Nightly lane maintenance window ----
  const handleSaveMaintenance = async (store, values) => {
    try {
      const existing = windows.find((w) => w.store_id === store.store_number);
      if (existing) {
        await base44.entities.LaneMaintenanceWindow.update(existing.id, values);
        setWindows((ws) => ws.map((w) => (w.id === existing.id ? { ...w, ...values } : w)));
      } else {
        const created = await base44.entities.LaneMaintenanceWindow.create({ store_id: store.store_number, ...values });
        setWindows((ws) => [...ws, created]);
      }
      logAuditEvent({
        action: "Updated Nightly Lane Maintenance Window",
        category: "configuration",
        description: `Nightly lane maintenance for ${store.name} (#${store.store_number}) ${values.enabled ? "enabled" : "disabled"} — ${values.batch_size} lane(s) per batch every ${values.batch_interval_minutes} minute(s), controller update ${values.include_controller_update ? "included" : "excluded"}. Lanes with a parked sale or an operator still clocked in are deferred, never rebooted.`,
        page: "/admin/hardware",
        changes: Object.keys(values).map((f) => ({ field: f, from: String(windows.find((w) => w.store_id === store.store_number)?.[f] ?? ""), to: String(values[f]) })),
      });
      toast({ title: "Saved", description: `Maintenance window updated for ${store.name}` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save maintenance window", variant: "destructive" });
    }
  };

  const handlePlanMaintenance = async (store) => {
    setPlanning(true);
    try {
      const res = await base44.functions.invoke("nightlyLaneMaintenance", { pass: "initial" });
      const mine = res.data?.results?.find((r) => r.store_id === store.store_number);
      toast({
        title: "Planning Complete",
        description: mine?.summary || "No lanes were planned — check that the window is enabled for this store.",
      });
      load(true);
    } catch (e) {
      toast({ title: "Error", description: "Failed to plan maintenance", variant: "destructive" });
    }
    setPlanning(false);
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
        // Carried across the rotation — rotating the SYNC key must not silently strip
        // the relay access token and break every portal operation for this store.
        access_token: existing?.access_token || "",
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

  // ---- Per-store relay ACCESS token (gates the relay's privileged routes) ----
  // Stored on the credential and never read back by the browser: the relayProxy
  // function attaches it server-side, which is what lets this HTTPS portal command a
  // plain-HTTP relay at all.
  const handleGenerateToken = async (store) => {
    const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const token = `sft_${store.store_number}_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const now = new Date().toISOString();
    try {
      const existing = credentials.find((c) => c.store_id === store.store_number);
      let saved;
      if (existing) {
        await base44.entities.RelayCredential.update(existing.id, { access_token: token });
        saved = { ...existing, access_token: token };
      } else {
        // A store can be given a relay token before it has a sync key; api_key is
        // required on the entity, so it is seeded here rather than blocking on it.
        saved = await base44.entities.RelayCredential.create({
          store_id: store.store_number,
          api_key: `sfr_${store.store_number}_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`,
          access_token: token,
          status: "active",
          generated_by: actor.full_name || "Admin",
          generated_at: now,
        });
      }
      setCredentials((cs) => [...cs.filter((c) => c.store_id !== store.store_number), saved]);
      setNewTokens((t) => ({ ...t, [store.store_number]: token }));
      logAuditEvent({
        action: existing?.access_token ? "Rotated Relay Access Token" : "Generated Relay Access Token",
        category: "system",
        description: `${existing?.access_token ? "Rotated" : "Generated"} the relay access token for ${store.name} (#${store.store_number}). The portal now authorizes reboot, backup, self-update and lane reboot with this token; it must be set on the relay as RELAY_ACCESS_TOKEN and the service restarted.`,
        page: "/admin/hardware",
      });
      toast({ title: "Token Generated", description: "Copy it now — it is only shown once." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to generate relay access token", variant: "destructive" });
    }
  };

  // ---- Hybrid operation dispatch ----
  // A store whose relay answered the portal directly is commanded instantly. Every
  // other store — the normal case, a relay on a private LAN the cloud cannot route to
  // — gets the operation written to the command queue, which its relay collects on its
  // next sync pass and runs locally.
  const dispatchOperation = async (store, commandType, { registerId = "", payload = null, direct = null } = {}) => {
    const relay = relayData[store.store_number];
    const label = COMMAND_LABELS[commandType] || commandType;

    if (direct && isFastPathAvailable(relay)) {
      const out = await direct();
      return { queued: false, output: out };
    }

    await queueRelayCommand({ store, commandType, registerId, payload });
    load(true);
    toast({
      title: `${label} Queued`,
      description: `${store.name} is not reachable from the cloud, so the command is queued. Its relay will run it on the next sync pass.`,
    });
    return { queued: true };
  };

  const handleQueueCommand = async (store, commandType, extras = {}) => {
    try {
      return await dispatchOperation(store, commandType, extras);
    } catch (e) {
      toast({ title: "Error", description: e.message || "Could not issue the operation", variant: "destructive" });
      return { queued: false, error: e.message };
    }
  };

  // ---- Force an immediate relay sync ----
  const handleForceSync = async (store) => {
    if (!isFastPathAvailable(relayData[store.store_number])) {
      await handleQueueCommand(store, "force_sync");
      return;
    }
    try {
      const data = await forceRelaySync(store.relay_url || "");
      if (data?.ok) {
        toast({ title: "Sync Complete", description: `${store.name} synced with the cloud.` });
      } else {
        toast({ title: "Sync Failed", description: data?.error || "The relay did not report a successful sync.", variant: "destructive" });
      }
      load(true);
      pollNow();
    } catch (e) {
      const missing = /HTTP 404|No relay at this address/i.test(e.message);
      toast({
        title: missing ? "Sync Endpoint Missing" : "Sync Failed",
        description: missing
          ? "The relay answered but has no /api/sync route — it is still running the pre-Phase 1 server.js. Deploy db.js, sync.js, api.js and the Phase 1 server.js from the setup guide."
          : `${e.message}. Check the relay log: journalctl -u sureflow-relay -n 50`,
        variant: "destructive",
      });
    }
  };

  // ---- Remote VM reboot ----
  const handleRebootConfirm = async () => {
    const store = rebootStore;
    if (!store) return;
    setRebooting(true);

    if (!isFastPathAvailable(relayData[store.store_number])) {
      await handleQueueCommand(store, "reboot_vm");
      setRebooting(false);
      setRebootStore(null);
      return;
    }

    let ok = false;
    try {
      await rebootRelayVm(store.relay_url || "");
      ok = true;
    } catch (e) {
      ok = false;
    }
    logAuditEvent({
      action: "Remote VM Reboot Issued",
      category: "system",
      description: `Remote reboot of the Local Relay VM issued directly to ${store.name} (#${store.store_number}). Relay ${ok ? "accepted the command" : "did not confirm receipt"}.`,
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
          <p className="text-gray-500 text-sm mt-1">Per-store Relay VM health, network printers, and register hardware. Each relay reports its own status upward on its sync pass, so no inbound access into a store network is needed.</p>
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

      <OpsNotificationsCard
        key={settings?.id || "new"}
        settings={settings}
        onSave={handleSaveOps}
        onTest={handleTestOps}
        saving={savingOps}
        testing={testingOps}
      />

      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Hardware, PXE & driver reference</p>
          <p className="text-xs text-gray-400 mt-0.5">The fleet hardware guide, port maps, PXE controller build and driver library now live on the Technical Documentation page.</p>
        </div>
        <Link to="/admin/technical-docs" className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap">Open Technical Documentation →</Link>
      </div>

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
              newToken={newTokens[store.store_number]}
              onGenerateToken={handleGenerateToken}
              maintenanceWindow={windows.find((w) => w.store_id === store.store_number)}
              maintenanceTasks={tasks.filter((t) => t.store_id === store.store_number)}
              updateAssignments={updateAssignments.filter((a) => a.store_id === store.store_number)}
              commands={commands.filter((c) => c.store_id === store.store_number)}
              onQueueCommand={handleQueueCommand}
              onSaveMaintenance={handleSaveMaintenance}
              onPlanMaintenance={handlePlanMaintenance}
              planningMaintenance={planning}
              onGenerateKey={handleGenerateKey}
              onForceSync={handleForceSync}
              onToggleStep={handleToggleStep}
              onRebootClick={setRebootStore}
              onOverride={handleOverride}
              onSaveRelayUrl={handleSaveRelayUrl}
              onSaveHa={handleSaveHa}
              onFailback={handleFailback}
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