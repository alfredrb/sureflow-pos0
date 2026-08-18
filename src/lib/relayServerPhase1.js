// Phase 1 Local Relay server source, delivered as copyable code in the Relay Setup Guide.
// Adds a SQLite catalog cache, an offline sale outbox, and a bidirectional sync worker
// on top of the hardware-bridge relay.

export const RELAY_DB_CODE = `// db.js — local SQLite store for catalog cache + offline sale outbox
const Database = require("better-sqlite3");
const db = new Database(process.env.DB_PATH || "/opt/sureflow-relay/relay.db");

db.pragma("journal_mode = WAL");

db.exec("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, payload TEXT NOT NULL, cached_at TEXT NOT NULL)");
db.exec("CREATE TABLE IF NOT EXISTS pending_sales (transaction_id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0, synced_at TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT)");
db.exec("CREATE TABLE IF NOT EXISTS local_stock (sku TEXT PRIMARY KEY, delta INTEGER NOT NULL DEFAULT 0)");

module.exports = {
  // ---- catalog cache ----
  saveCatalog(payload) {
    db.prepare("INSERT INTO cache (key,payload,cached_at) VALUES ('catalog',?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, cached_at=excluded.cached_at")
      .run(JSON.stringify(payload), payload.cached_at || new Date().toISOString());
  },
  getCatalog() {
    const row = db.prepare("SELECT payload, cached_at FROM cache WHERE key='catalog'").get();
    if (!row) return null;
    const parsed = JSON.parse(row.payload);
    parsed.cached_at = row.cached_at;
    return parsed;
  },

  // ---- offline sale outbox ----
  queueSale(sale) {
    db.prepare("INSERT OR IGNORE INTO pending_sales (transaction_id,payload,created_at) VALUES (?,?,?)")
      .run(sale.transaction_id, JSON.stringify(sale), new Date().toISOString());
    const bump = db.prepare("INSERT INTO local_stock (sku,delta) VALUES (?,?) ON CONFLICT(sku) DO UPDATE SET delta = delta + excluded.delta");
    for (const it of sale.items || []) if (it.sku) bump.run(it.sku, Number(it.qty || 0));
  },
  pendingSales(limit = 50) {
    return db.prepare("SELECT transaction_id,payload,attempts,last_error,created_at FROM pending_sales WHERE synced=0 ORDER BY created_at LIMIT ?")
      .all(limit).map((r) => ({ ...r, sale: JSON.parse(r.payload) }));
  },
  pendingCount() {
    return db.prepare("SELECT COUNT(*) c FROM pending_sales WHERE synced=0").get().c;
  },
  markSynced(ids) {
    const stmt = db.prepare("UPDATE pending_sales SET synced=1, synced_at=? WHERE transaction_id=?");
    const now = new Date().toISOString();
    for (const id of ids) stmt.run(now, id);
  },
  markFailed(id, error) {
    db.prepare("UPDATE pending_sales SET attempts = attempts + 1, last_error = ? WHERE transaction_id = ?").run(String(error).slice(0, 500), id);
  },
  localStockDelta(sku) {
    const row = db.prepare("SELECT delta FROM local_stock WHERE sku=?").get(sku);
    return row ? row.delta : 0;
  },
};
`;

export const RELAY_SYNC_CODE = `// sync.js — talks to the cloud relaySync endpoint
const store = require("./db");

const CLOUD_URL = process.env.CLOUD_SYNC_URL;   // relaySync function endpoint
const STORE_ID  = process.env.STORE_ID;
const API_KEY   = process.env.CLOUD_API_KEY;    // per-store key from the Command Center

let online = false;
let lastSyncAt = null;
let consecutiveFailures = 0;

async function callCloud(payload) {
  const res = await fetch(CLOUD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id: STORE_ID, api_key: API_KEY, ...payload }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

// Pull the catalog down and overwrite the local cache (cloud always wins).
async function pullCatalog() {
  const data = await callCloud({ action: "pull" });
  store.saveCatalog(data);
  return data.records_pulled || 0;
}

// Push queued offline sales up, oldest first. Idempotent on transaction_id.
async function pushSales() {
  const rows = store.pendingSales(50);
  if (rows.length === 0) return 0;
  const data = await callCloud({ action: "push", sales: rows.map((r) => r.sale) });
  const done = [...(data.accepted || []), ...(data.duplicates || [])];
  store.markSynced(done);
  for (const f of data.failures || []) store.markFailed(f.transaction_id, f.error);
  return done.length;
}

async function syncOnce() {
  try {
    await pullCatalog();
    await pushSales();
    online = true;
    consecutiveFailures = 0;
    lastSyncAt = new Date().toISOString();
    return { ok: true, last_sync_at: lastSyncAt };
  } catch (e) {
    consecutiveFailures++;
    if (consecutiveFailures >= 2) online = false;  // two strikes = offline mode
    console.error("[sync] failed:", e.message);
    return { ok: false, error: e.message };
  }
}

function connectivity() {
  const cat = store.getCatalog();
  const ageMs = cat ? Date.now() - new Date(cat.cached_at).getTime() : null;
  return {
    online,
    last_sync_at: lastSyncAt,
    pending_count: store.pendingCount(),
    catalog_cached_at: cat ? cat.cached_at : null,
    catalog_stale: ageMs === null ? true : ageMs > 24 * 60 * 60 * 1000, // 24h stale limit
  };
}

// Catalog pull every 5 minutes, outbox push attempt every 30 seconds.
function start() {
  syncOnce();
  setInterval(() => pullCatalog().catch(() => {}), 5 * 60 * 1000);
  setInterval(() => syncOnce(), 30 * 1000);
}

module.exports = { start, syncOnce, connectivity };
`;

export const RELAY_API_CODE = `// api.js — endpoints the POS terminals call (mount into server.js)
const express = require("express");
const store = require("./db");
const sync = require("./sync");
const printer = require("./printer");

const router = express.Router();

// ---- printing (raw ESC/POS straight to the register's Epson on port 9100) ----

// Print a receipt. Body is the receipt payload from the POS; set open_drawer:true
// on cash sales to fire the drawer kick with the same command.
router.post("/print", async (req, res) => {
  try {
    await printer.printReceipt(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Pop the cash drawer on its own (cash pickups, no-sales, till checkout).
router.post("/drawer", async (req, res) => {
  try {
    await printer.openDrawer((req.body || {}).printer_ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Diagnostic test print used by the Infrastructure Command Center.
router.post("/print-test", async (req, res) => {
  try {
    await printer.testPrint((req.body || {}).printer_ip);
    res.json({ ok: true, printers: printer.printers });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Cached catalog: products, operators, registers, settings, discounts, function keys.
router.get("/catalog", (req, res) => {
  const cat = store.getCatalog();
  if (!cat) return res.status(503).json({ error: "Catalog not cached yet — relay has never reached the cloud." });
  // Reflect locally-sold units so cashiers see realistic stock while offline.
  const products = (cat.products || []).map((p) => ({
    ...p,
    stock_qty: Number(p.stock_qty || 0) - store.localStockDelta(p.sku),
  }));
  res.json({ ...cat, products });
});

// Terminals poll this to decide what tender/features to allow.
router.get("/connectivity", (req, res) => res.json(sync.connectivity()));

// Completed sale from a terminal. Cash/check only when offline.
router.post("/sales", (req, res) => {
  const sale = req.body || {};
  if (!sale.transaction_id) return res.status(400).json({ error: "transaction_id required" });
  const conn = sync.connectivity();
  if (!conn.online && !["cash", "check"].includes(sale.payment_method)) {
    return res.status(409).json({ error: "Only cash and check tender are permitted while offline." });
  }
  store.queueSale(sale);
  res.json({ ok: true, transaction_id: sale.transaction_id, queued: true, pending_count: store.pendingCount() });
});

// Unsynced sales, for the store's own reconciliation.
router.get("/pending", (req, res) => res.json({ sales: store.pendingSales(200), count: store.pendingCount() }));

// Force an immediate catalog pull + outbox push.
router.post("/sync", async (req, res) => res.json(await sync.syncOnce()));

module.exports = router;
`;

export const RELAY_SERVER_PHASE1_CODE = `// server.js — SureFlow Local Relay (Phase 1: hardware bridge + offline sales)
const express = require("express");
const net = require("net");
const os = require("os");
const { execSync, exec } = require("child_process");
const api = require("./api");
const sync = require("./sync");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").filter(Boolean);

function checkPrinter(ip) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(1500);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
    sock.connect(9100, ip);
  });
}

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

// Polled by the cloud Infrastructure Command Center every 30s.
app.get("/status", async (req, res) => {
  const printers = await Promise.all(PRINTER_IPS.map(async (ip) => ({
    ip,
    model: "Epson TM-H6000IV",
    reachable: await checkPrinter(ip),
    paper_status: "ok",
    last_used: null,
  })));
  res.json({
    store_id: process.env.STORE_ID,
    vm_stats: vmStats(),
    printers,
    registers: [],
    sync: sync.connectivity(),
  });
});

app.post("/proxmox/reboot", (req, res) => {
  res.json({ ok: true, message: "Reboot scheduled" });
  setTimeout(() => exec("sudo /sbin/reboot"), 1000);
});

app.use("/api", api);

// One-time terminal provisioning. Set KIOSK_ACCESS_TOKEN in .env once, then point
// every terminal's kiosk URL at /kiosk — the relay hands the cloud session token to
// the browser so no one has to paste it per register. Keep .env root-only (chmod 600).
app.get("/kiosk", (req, res) => {
  const t = process.env.KIOSK_ACCESS_TOKEN;
  if (!t) return res.status(503).send("KIOSK_ACCESS_TOKEN is not set in the relay .env");
  res.redirect("/?access_token=" + encodeURIComponent(t));
});

// Serve the POS build so terminals load locally: put the built files in ./pos-dist
app.use("/", express.static(__dirname + "/pos-dist"));

// SPA fallback — the POS is a single-page app, so client routes like /login and /pos
// must return index.html instead of 404. Must come AFTER /api and /status.
// Express 5 rejects "*" as a route path — use app.use, which matches every path.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api") || req.path === "/status") return next();
  res.sendFile(__dirname + "/pos-dist/index.html", (err) => err && next());
});

sync.start();
app.listen(process.env.PORT || 3000, () =>
  console.log("SureFlow relay (phase 1) for store " + process.env.STORE_ID + " listening"));
`;