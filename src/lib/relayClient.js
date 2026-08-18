// Client for the store's Local Relay VM (Phase 1 relay server).
//
// The POS terminals load the app from the relay itself, so the relay lives at the
// same origin by default. A terminal loading the cloud build can point at its relay
// by setting `relay_base_url` in localStorage (e.g. http://192.168.1.50:3000).

export function getRelayBase() {
  const override = localStorage.getItem("relay_base_url");
  if (override) return override.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  return window.location.origin.replace(/\/$/, "");
}

async function relayFetch(path, options = {}, timeoutMs = 5000) {
  const res = await fetch(`${getRelayBase()}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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

// Ask the relay to sync with the cloud right now.
export const forceRelaySync = () => relayFetch("/api/sync", { method: "POST" }, 20000);