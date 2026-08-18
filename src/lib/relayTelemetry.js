// Phase 3 — telemetry.js for the store's Local Relay VM.
// Real printer paper levels over SNMP + a live register heartbeat registry that
// feeds the Infrastructure Command Center's VM / Printer / Register panels.

export const RELAY_TELEMETRY_CODE = `// telemetry.js — SureFlow Local Relay (Phase 3)
// Real printer supply levels over SNMP + in-memory register heartbeat registry.
const net = require("net");

let snmp = null;
try { snmp = require("net-snmp"); } catch { /* SNMP optional — falls back to reachability only */ }

const COMMUNITY = process.env.SNMP_COMMUNITY || "public";
const HEARTBEAT_TTL_MS = 120000; // a register is "live" for 2 minutes after its last beat

// Standard Printer MIB (RFC 3805) supply OIDs — Epson TMNet NICs implement these.
const OID_LEVEL = "1.3.6.1.2.1.43.11.1.1.9.1.1";
const OID_MAX   = "1.3.6.1.2.1.43.11.1.1.8.1.1";

function snmpGet(ip, oids) {
  return new Promise((resolve) => {
    if (!snmp) return resolve(null);
    const session = snmp.createSession(ip, COMMUNITY, { timeout: 2000, retries: 0 });
    session.get(oids, (err, varbinds) => {
      session.close();
      if (err || !varbinds) return resolve(null);
      const out = varbinds.map((v) => (snmp.isVarbindError(v) ? null : Number(v.value)));
      resolve(out);
    });
  });
}

// TCP probe on 9100 (ESC/POS raw print port)
function probePort(ip, port = 9100, timeout = 1500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(timeout);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.connect(port, ip);
  });
}

function paperFromPct(pct) {
  if (pct === null) return "unknown";
  if (pct <= 0) return "out";
  if (pct <= 20) return "low";
  return "ok";
}

// Full telemetry for one printer: reachability + real paper percentage when SNMP answers.
async function printerTelemetry(ip) {
  const reachable = await probePort(ip);
  let paper_pct = null;
  if (reachable) {
    const vals = await snmpGet(ip, [OID_LEVEL, OID_MAX]);
    if (vals && vals[0] !== null && vals[1] > 0) {
      paper_pct = Math.max(0, Math.min(100, Math.round((vals[0] / vals[1]) * 100)));
    }
  }
  return {
    ip,
    model: "Epson TM-H6000IV",
    reachable,
    paper_pct,
    paper_status: reachable ? paperFromPct(paper_pct) : "unknown",
    snmp: !!snmp,
    last_used: lastUsed[ip] || null,
  };
}

// Printers record their own last-used time when a receipt is sent through printer.js.
const lastUsed = {};
function markPrinterUsed(ip) { if (ip) lastUsed[ip] = new Date().toISOString(); }

// ---- Register heartbeats ----
// Terminals POST /api/heartbeat every 60s with their own device health. The relay
// keeps the latest beat per register and expires it after HEARTBEAT_TTL_MS.
const beats = new Map();

function recordHeartbeat(body = {}) {
  const id = String(body.register_id || "").trim();
  if (!id) throw new Error("register_id is required");
  beats.set(id, {
    register_id: id,
    name: body.name || id,
    operator_name: body.operator_name || null,
    printer_status: body.printer_status || "unknown",
    scanner_status: body.scanner_status || "unknown",
    cash_drawer_status: body.cash_drawer_status || "unknown",
    printer_ip: body.printer_ip || null,
    app_version: body.app_version || null,
    offline_mode: !!body.offline_mode,
    last_beat: new Date().toISOString(),
  });
  return { ok: true, register_id: id };
}

function liveRegisters() {
  const now = Date.now();
  return [...beats.values()].map((b) => ({
    ...b,
    online: now - new Date(b.last_beat).getTime() < HEARTBEAT_TTL_MS,
  }));
}

module.exports = { printerTelemetry, probePort, markPrinterUsed, recordHeartbeat, liveRegisters };
`;