import { base44 } from "@/api/base44Client";
import { logAuditEvent } from "@/lib/auditLogger";

// Queued relay operations — the store-network-safe half of the hybrid control path.
//
// The cloud cannot open a connection into a private store LAN, so an operation the
// portal cannot deliver directly is written here as a pending record instead. The
// store's relay picks it up on its next sync pass, runs it locally, and reports the
// outcome back through relaySync. Same operations, opposite direction of travel.

export const COMMAND_LABELS = {
  reboot_vm: "Reboot Relay VM",
  backup: "Back Up Relay",
  self_update: "Relay Self-Update",
  force_sync: "Force Cloud Sync",
  lane_reboot: "Reboot Lane",
  test_print: "Test Print",
};

// A store is directly commandable only when its relay actually answered the portal's
// live probe. Everything else — private LAN, no URL, a relay that is down — goes
// through the queue.
export function isFastPathAvailable(relay) {
  return relay?.status === "ok";
}

// Queue one operation for a store's relay. Returns the created record so the caller
// can tell the admin it is waiting rather than done.
export async function queueRelayCommand({ store, commandType, registerId = "", payload = null, reason = "" }) {
  const actor = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
  const now = new Date().toISOString();

  const created = await base44.entities.RelayCommand.create({
    store_id: store.store_number,
    command_type: commandType,
    register_id: registerId || "",
    ...(payload ? { payload } : {}),
    status: "pending",
    requested_by: actor.full_name || "Admin",
    requested_at: now,
  });

  logAuditEvent({
    action: `Relay Command Queued: ${COMMAND_LABELS[commandType] || commandType}`,
    category: "system",
    description: `${COMMAND_LABELS[commandType] || commandType} queued for ${store.name} (#${store.store_number})${registerId ? ` targeting lane ${registerId}` : ""}. The relay is not reachable from the cloud, so the command waits for the store's next sync pass and the relay executes it locally.${reason ? ` ${reason}` : ""}`,
    page: "/admin/hardware",
    changes: [{ field: "command_type", from: "", to: commandType }],
  });

  return created;
}

// Pending/claimed commands for a store, newest first — what the Command Center shows
// as "waiting on the relay".
export function openCommandsFor(commands, storeNumber) {
  return (commands || []).filter(
    (c) => c.store_id === storeNumber && (c.status === "pending" || c.status === "claimed")
  );
}

// The most recent finished command for a store, so an admin sees the outcome of what
// they queued without opening another page.
export function lastFinishedCommand(commands, storeNumber) {
  return (commands || [])
    .filter((c) => c.store_id === storeNumber && (c.status === "completed" || c.status === "failed"))
    .sort((a, b) => new Date(b.completed_at || b.created_date || 0) - new Date(a.completed_at || a.created_date || 0))[0] || null;
}