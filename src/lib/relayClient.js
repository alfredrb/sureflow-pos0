import { base44 } from "@/api/base44Client";

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
// Only used on the same-origin (lane) path; the cloud portal's token lives server-side
// on RelayCredential and is attached by the relayProxy function.
function relayToken() {
  try { return localStorage.getItem("relay_access_token") || ""; } catch { return ""; }
}

// A relay on a DIFFERENT origin than the page cannot be called by the browser: the
// portal is HTTPS and store relays answer on plain http://, which the browser blocks as
// mixed content before the request ever leaves the machine. Those calls go through the
// relayProxy backend function instead, which has no such restriction.
// Same-origin (a lane serving the POS from its own relay) still calls direct.
function needsProxy(base) {
  if (!base) return false;
  if (typeof window === "undefined") return false;
  try {
    return new URL(base, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

async function relayFetch(path, options = {}, timeoutMs = 5000, base = "") {
  if (needsProxy(base)) {
    const res = await base44.functions.invoke("relayProxy", {
      relay_url: getRelayBase(base),
      path,
      method: options.method || "GET",
      body: options.body,
      timeout_ms: timeoutMs,
    });
    const out = res.data || {};
    if (!out.ok) throw new Error(out.error || `HTTP ${out.status || 0}`);
    return out.data;
  }

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
  // A lane that loads the POS from the CLOUD has the cloud app as its origin, and a
  // single-page app answers ANY unknown path with index.html at status 200. Without
  // this content-type guard that HTML parsed into an empty object, which looked like
  // a relay replying "online: false" and put every lane into OFFLINE MODE.
  // No JSON body = there is no relay at this address.
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("No relay at this address");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// { online, last_sync_at, pending_count, catalog_cached_at, catalog_stale }
export const fetchConnectivity = () => relayFetch("/api/connectivity");

// This terminal's LAN IP as the relay sees it on the store network.
export const fetchLocalIp = () => relayFetch("/api/whoami", {}, 4000);

// Locally cached catalog snapshot (products, operators, registers, settings, ...).
export const fetchCatalog = () => relayFetch("/api/catalog", {}, 10000);

// Hand a completed sale to the relay outbox. Cash/check only while offline.
export const queueOfflineSale = (sale) =>
  relayFetch("/api/sales", { method: "POST", body: JSON.stringify(sale) }, 10000);

// Raw ESC/POS receipt print on the register's printer. Set open_drawer for cash sales.
export const printReceiptViaRelay = (receipt, base = "") =>
  relayFetch("/api/print", { method: "POST", body: JSON.stringify(receipt) }, 10000, base);

// Pop the cash drawer without printing (cash pickup, no-sale, till checkout).
// This is the fleet standard: ESC p to the receipt printer, whose controller
// fires the 24V pulse out its DK (RJ11/SDL) port.
export const openCashDrawer = (printer_ip) =>
  relayFetch("/api/drawer", { method: "POST", body: JSON.stringify({ printer_ip }) }, 8000);

// Is the cash drawer open right now? The drawer's open/closed sense line is wired
// to the printer's DK port, so the relay asks the printer with ESC/POS DLE EOT 2.
// Returns { open: true|false|null } — null means the printer did not answer, which
// the POS treats as "unknown" and never as open.
export const fetchDrawerStatus = (printer_ip, base = "") =>
  relayFetch("/api/drawer/status", { method: "POST", body: JSON.stringify({ printer_ip }) }, 6000, base);

// The receipt printer's own condition: { reachable, online, error, paper_low,
// paper_out }, read with the DLE EOT real-time status probes. reachable:false =
// the printer did not answer at all, which the POS shows as nothing (never a
// fabricated alert).
export const fetchPrinterHealth = (printer_ip, base = "") =>
  relayFetch("/api/printer/health", { method: "POST", body: JSON.stringify({ printer_ip }) }, 8000, base);

// RESERVED — pop a native USB drawer bridged at the lane. The relay writes the
// model's own open command straight to the lane's drawer bridge socket instead of
// routing ESC p through the printer.
// Payload: { drawer_ip, drawer_port, command_hex, transport_hint }.
export const openUsbDrawer = (payload) =>
  relayFetch("/api/drawer/usb", { method: "POST", body: JSON.stringify(payload) }, 8000);

// Diagnostic test print from the Infrastructure Command Center.
// station "slip" targets the front impact slot — the printer waits ~30s for a
// blank sheet, so that call gets a longer timeout.
export const relayTestPrint = (printer_ip, base = "", station = "") =>
  relayFetch("/api/print-test", { method: "POST", body: JSON.stringify({ printer_ip, station }) }, station === "slip" ? 40000 : 10000, base);

// Cheque station — read the E-13B MICR line. The printer waits for the operator
// to insert the cheque, so this call gets a long timeout.
export const readCheckMicr = (printer_ip) =>
  relayFetch("/api/check/read", { method: "POST", body: JSON.stringify({ printer_ip }) }, 50000);

// Print the FOR DEPOSIT ONLY endorsement on the back of the cheque and eject it.
export const frankCheck = (payload) =>
  relayFetch("/api/check/frank", { method: "POST", body: JSON.stringify(payload) }, 45000);

// Release a cheque without franking (refused tender / aborted read).
export const ejectCheck = (printer_ip) =>
  relayFetch("/api/check/eject", { method: "POST", body: JSON.stringify({ printer_ip }) }, 15000);

// ── Customer-facing Ingenico pinpad ────────────────────────────────────────
// Every call carries the lane's pinpad_ip plus the profile key (isc250,
// lane_7000) so the relay knows which command set to speak. Display calls are
// fire-and-forget; capture calls hold the socket open while the customer acts.

// Mirror the running cart on the pad so the customer can follow the sale.
export const pinpadShowCart = (payload) =>
  relayFetch("/api/pinpad/cart", { method: "POST", body: JSON.stringify(payload) }, 6000);

// Simple high-contrast message on the pad ("INSERT CHEQUE", "THANK YOU").
export const pinpadDisplay = (payload) =>
  relayFetch("/api/pinpad/display", { method: "POST", body: JSON.stringify(payload) }, 6000);

// Return the pad to its idle/welcome screen.
export const pinpadClear = (payload) =>
  relayFetch("/api/pinpad/clear", { method: "POST", body: JSON.stringify(payload) }, 6000);

// Blocking: the customer signs on the pad. Returns { image_base64, format }.
export const pinpadCaptureSignature = (payload) =>
  relayFetch("/api/pinpad/signature", { method: "POST", body: JSON.stringify(payload) }, 90000);

// Blocking: the customer keys a number on the pad (gift card number). Returns { value }.
export const pinpadEnterNumber = (payload) =>
  relayFetch("/api/pinpad/input", { method: "POST", body: JSON.stringify(payload) }, 90000);

// Blocking: "Approve $amount?" — returns { approved }.
export const pinpadConfirm = (payload) =>
  relayFetch("/api/pinpad/confirm", { method: "POST", body: JSON.stringify(payload) }, 90000);

// Blocking: post-sale 1–5 rating screen. Returns { rating } (null if skipped).
export const pinpadCollectRating = (payload) =>
  relayFetch("/api/pinpad/rating", { method: "POST", body: JSON.stringify(payload) }, 45000);

// Abort whatever the pad is waiting on and hand control back to the operator.
export const pinpadCancel = (payload) =>
  relayFetch("/api/pinpad/cancel", { method: "POST", body: JSON.stringify(payload) }, 8000);

// ── Customer pole display (line display) ───────────────────────────────────
// Fire-and-forget 2×20 frames. DM-D110 poles ride the receipt printer's address
// (pass-through); the profile key tells the relay which command set to speak.

// Write two display lines: { profile, pole_ip, lines: [line1, line2] }.
export const poleShow = (payload) =>
  relayFetch("/api/pole/show", { method: "POST", body: JSON.stringify(payload) }, 6000);

// Return the pole to its idle/welcome message.
export const poleIdle = (payload) =>
  relayFetch("/api/pole/idle", { method: "POST", body: JSON.stringify(payload) }, 6000);

// Ask the relay to sync with the cloud right now.
export const forceRelaySync = (base = "") => relayFetch("/api/sync", { method: "POST" }, 20000, base);

// Reboot the relay VM itself (not a lane).
export const rebootRelayVm = (base = "") => relayFetch("/proxmox/reboot", { method: "POST" }, 15000, base);

// Phase 3 — terminal health beat (register/printer/scanner/drawer) for live telemetry.
export const sendRegisterHeartbeat = (beat) =>
  relayFetch("/api/heartbeat", { method: "POST", body: JSON.stringify(beat) }, 5000);

// Phase 3 — operations: on-demand local backup and relay self-update.
export const relayBackupNow = (base = "") =>
  relayFetch("/ops/backup", { method: "POST" }, 30000, base);

export const relaySelfUpdate = (base = "") =>
  relayFetch("/ops/self-update", { method: "POST" }, 20000, base);

// Reboot a lane TERMINAL (not the relay VM).
//
// The lanes sit on the isolated PXE VLAN behind the controller's NAT, so NOTHING can
// open a connection to them — not the relay, not the portal. Both paths below work
// around that, and neither one ever uses a lane IP (the relay only ever sees the
// controller's address anyway).

// Admin path: queue the reboot on the store relay, keyed by register_id. The lane's
// own agent polls for it and reboots itself within ~10 seconds.
export const rebootLane = (payload = {}, base = "") =>
  relayFetch("/lane/reboot", { method: "POST", body: JSON.stringify(payload) }, 15000, base);

// On-lane path: the POS talks to the lane agent on its own loopback, so the reboot is
// immediate and needs no network at all. Only ever succeeds when running on a lane.
export async function rebootThisLane(registerId) {
  const res = await fetch("http://127.0.0.1:3099/reboot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ register_id: registerId || "" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Lane agent returned HTTP ${res.status}`);
  return res.json();
}