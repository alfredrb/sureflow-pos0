// Client for the store's Local Relay VM (Phase 1 relay server).
//
// The POS terminals load the app from the relay itself, so the relay lives at the
// same origin by default. A terminal loading the cloud build can point at its relay
// by setting `relay_base_url` in localStorage (e.g. http://192.168.1.50:3000).

// `base` lets a caller target a specific store's relay explicitly — the admin panel
// runs on the cloud origin, so it must pass the store's relay_url instead of relying
// on window.location.
export function getRelayBase(base) {
  if (base) return base.replace(/\/$/, "");
  const override = localStorage.getItem("relay_base_url");
  if (override) return override.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

// Phase 3 — the relay's privileged routes (reboot, sync, ops) require its token.
// Stored per browser so the cloud portal can act on a secured relay.
function relayToken() {
  try { return localStorage.getItem("relay_access_token") || ""; } catch { return ""; }
}

async function relayFetch(path, options = {}, timeoutMs = 5000, base = "") {
  const token = relayToken();
  const res = await fetch(`${getRelayBase(base)}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Relay-Token": token } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// { online, last_sync_at, pending_count, catalog_cached_at, catalog_stale }
export const fetchConnectivity = () => relayFetch("/api/connectivity");

// Locally cached catalog snapshot (products, operators, registers, settings, ...).
export const fetchCatalog = () => relayFetch("/api/catalog", {}, 10000);

// Hand a completed sale to the relay outbox. Cash/check only while offline.
export const queueOfflineSale = (sale) =>
  relayFetch("/api/sales", { method: "POST", body: JSON.stringify(sale) }, 10000);

// Raw ESC/POS receipt print on the register's printer. Set open_drawer for cash sales.
export const printReceiptViaRelay = (receipt, base = "") =>
  relayFetch("/api/print", { method: "POST", body: JSON.stringify(receipt) }, 10000, base);

// Pop the cash drawer without printing (cash pickup, no-sale, till checkout).
export const openCashDrawer = (printer_ip) =>
  relayFetch("/api/drawer", { method: "POST", body: JSON.stringify({ printer_ip }) }, 8000);

// Diagnostic test print from the Infrastructure Command Center.
export const relayTestPrint = (printer_ip, base = "") =>
  relayFetch("/api/print-test", { method: "POST", body: JSON.stringify({ printer_ip }) }, 10000, base);

// Ask the relay to sync with the cloud right now.
export const forceRelaySync = () => relayFetch("/api/sync", { method: "POST" }, 20000);

// Phase 3 — terminal health beat (register/printer/scanner/drawer) for live telemetry.
export const sendRegisterHeartbeat = (beat) =>
  relayFetch("/api/heartbeat", { method: "POST", body: JSON.stringify(beat) }, 5000);

// Phase 3 — operations: on-demand local backup and relay self-update.
export const relayBackupNow = (base = "") =>
  relayFetch("/ops/backup", { method: "POST" }, 30000, base);

export const relaySelfUpdate = (base = "") =>
  relayFetch("/ops/self-update", { method: "POST" }, 20000, base);