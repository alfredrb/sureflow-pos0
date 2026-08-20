// Full Phase 3 relay server.js with the cheque-station routes already in place,
// so a technician can see exactly where they belong: after the POS /api router and
// BEFORE the static POS build + SPA catch-all (anything below the catch-all is
// never reached).

export const RELAY_SERVER_WITH_CHECKS_CODE = `// server.js — SureFlow Local Relay (Phase 3 + cheque station)
const express = require("express");
const os = require("os");
const path = require("path");
const { execSync, exec } = require("child_process");
const apiRouter = require("./api");
const { startSync } = require("./sync");
const { requireRelayToken, tokenConfigured } = require("./auth");
const { printerTelemetry, recordHeartbeat, liveRegisters } = require("./telemetry");
const checkReader = require("./checkReader");   // <-- cheque station module

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Relay-Token,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
const PORT = process.env.PORT || 3000;
const RELAY_DIR = __dirname;

function vmStats() {
  const total = os.totalmem(), free = os.freemem();
  let disk_pct = 0;
  try { disk_pct = parseInt(execSync("df --output=pcent / | tail -1").toString().trim()); } catch {}
  return {
    cpu_pct: Math.min(100, Math.round((os.loadavg()[0] / os.cpus().length) * 100)),
    ram_pct: Math.round(((total - free) / total) * 100),
    disk_pct,
    uptime_seconds: Math.round(os.uptime()),
  };
}

// Live store telemetry for the Infrastructure Command Center.
app.get("/status", async (req, res) => {
  const printers = await Promise.all(PRINTER_IPS.map((ip) => printerTelemetry(ip)));
  res.json({
    store_id: process.env.STORE_ID,
    phase: 3,
    secured: tokenConfigured(),
    check_reader: checkReader.BUILD,
    vm_stats: vmStats(),
    printers,
    registers: liveRegisters(),
  });
});

// Terminals report their own device health every 60 seconds.
app.post("/api/heartbeat", (req, res) => {
  try { res.json(recordHeartbeat(req.body || {})); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// Kiosk provisioning — hands the stored cloud session to a terminal.
app.get("/kiosk", (req, res) => {
  const token = process.env.KIOSK_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "KIOSK_ACCESS_TOKEN is not set" });
  const reg = String(req.query.register_id || "").replace(/[^\\\\w-]/g, "");
  res.redirect("/pos/login?access_token=" + encodeURIComponent(token) +
    (reg ? "&register_id=" + encodeURIComponent(reg) : ""));
});

// The lane's own LAN address, as seen by the relay on the store network.
app.get("/api/whoami", (req, res) => {
  const raw = req.socket.remoteAddress || "";
  res.json({ ip: raw.replace(/^::ffff:/, "") });
});

// POS routes (catalog, offline sales, printing) stay open on the store LAN.
app.use("/api", apiRouter);

// ───── CHEQUE STATION ROUTES — put them HERE ─────
// After /api (so they sit beside /api/print) and well before the static POS build
// and SPA catch-all further down, which would otherwise swallow the requests.

// Blocking read: the printer waits for the operator to insert the cheque, so the POS
// calls this with a long client timeout while showing an "insert cheque" prompt.
app.post("/api/check/read", async (req, res) => {
  try {
    const out = await checkReader.readMicr(req.body.printer_ip);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Print the endorsement legend on the back of the cheque and eject it.
app.post("/api/check/frank", async (req, res) => {
  try {
    await checkReader.frankCheck(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Release a cheque without franking (declined tender / aborted read).
app.post("/api/check/eject", async (req, res) => {
  try {
    await checkReader.ejectCheck(req.body.printer_ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
// ───── END CHEQUE STATION ROUTES ─────

// ---- Privileged routes: require the relay token ----
app.post("/proxmox/reboot", requireRelayToken, (req, res) => {
  res.json({ ok: true, message: "Reboot scheduled" });
  setTimeout(() => exec("sudo /sbin/reboot"), 1000);
});

app.post("/ops/backup", requireRelayToken, (req, res) => {
  exec(RELAY_DIR + "/sureflow-backup.sh backup", (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: (stderr || err.message).trim() });
    res.json({ ok: true, output: stdout.trim() });
  });
});

app.post("/ops/self-update", requireRelayToken, (req, res) => {
  res.json({ ok: true, message: "Update started — the relay will restart" });
  exec(RELAY_DIR + "/sureflow-selfupdate.sh");
});

// Serve the locally built POS. Must stay last.
const POS_DIR = path.join(RELAY_DIR, "pos-dist");
app.use(express.static(POS_DIR));
// SPA fallback. sendFile's callback also fires on SUCCESS (err undefined), so the
// error branch must be guarded — replying unconditionally throws
// ERR_HTTP_HEADERS_SENT and kills the process on every page load.
app.use((req, res) => {
  res.sendFile(path.join(POS_DIR, "index.html"), (err) => {
    if (!err) return;
    if (res.headersSent) return res.destroy();
    res.status(404).json({ error: "POS build not deployed on this relay" });
  });
});

// Last-resort guards: a relay must never take the store's sales path down over a
// single bad request or a stray socket error.
app.use((err, req, res, next) => {
  console.error("[relay] request error:", err && err.message);
  if (res.headersSent) return res.destroy();
  res.status(500).json({ error: "Relay request failed" });
});
process.on("unhandledRejection", (e) => console.error("[relay] unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("[relay] uncaught exception:", e));

app.listen(PORT, () => {
  console.log("SureFlow relay (phase 3 + cheque station) for store " + process.env.STORE_ID + " on :" + PORT);
  console.log("cheque reader " + checkReader.BUILD);
  console.log("privileged routes " + (tokenConfigured() ? "secured with RELAY_ACCESS_TOKEN" : "OPEN — set RELAY_ACCESS_TOKEN"));
  startSync();
});
`;