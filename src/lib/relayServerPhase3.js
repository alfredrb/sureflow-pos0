// Phase 3 — server.js for the store's Local Relay VM.
// Adds the relay token gate, SNMP printer telemetry, register heartbeats, and the
// backup / self-update trigger routes on top of the Phase 1/2 server.

export const RELAY_SERVER_PHASE3_CODE = `// server.js — SureFlow Local Relay (Phase 3)
const express = require("express");
const os = require("os");
const path = require("path");
const { execSync, exec } = require("child_process");
const apiRouter = require("./api");
const { startSync } = require("./sync");
const { requireRelayToken, tokenConfigured } = require("./auth");
const { printerTelemetry, recordHeartbeat, liveRegisters } = require("./telemetry");

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

// Kiosk provisioning (Phase 2) — hands the stored cloud session to a terminal.
app.get("/kiosk", (req, res) => {
  const token = process.env.KIOSK_ACCESS_TOKEN;
  if (!token) return res.status(503).json({ error: "KIOSK_ACCESS_TOKEN is not set" });
  res.redirect("/?access_token=" + encodeURIComponent(token));
});

// POS routes (catalog, offline sales, printing) stay open on the store LAN.
app.use("/api", apiRouter);

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

// Serve the locally built POS (Phase 2). Must stay last.
const POS_DIR = path.join(RELAY_DIR, "pos-dist");
app.use(express.static(POS_DIR));
app.use((req, res) => res.sendFile(path.join(POS_DIR, "index.html"), () =>
  res.status(404).json({ error: "POS build not deployed on this relay" })));

app.listen(PORT, () => {
  console.log("SureFlow relay (phase 3) for store " + process.env.STORE_ID + " on :" + PORT);
  console.log("privileged routes " + (tokenConfigured() ? "secured with RELAY_ACCESS_TOKEN" : "OPEN — set RELAY_ACCESS_TOKEN"));
  startSync();
});
`;