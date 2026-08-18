import {
  RELAY_DB_CODE,
  RELAY_SYNC_CODE,
  RELAY_API_CODE,
  RELAY_SERVER_PHASE1_CODE,
} from "@/lib/relayServerPhase1";

// Detailed per-step instructions for spinning up a store's Local Relay VM.
// step_ids must stay stable — completion state in StoreRelaySetup is keyed on them.

export const RELAY_SERVER_CODE = `// server.js — SureFlow Local Relay
const express = require("express");
const net = require("net");
const os = require("os");
const { execSync, exec } = require("child_process");

const app = express();
app.use(express.json());

// CORS so the cloud portal can poll this relay from the browser
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").filter(Boolean);

// TCP probe on port 9100 (ESC/POS raw print port)
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

app.get("/status", async (req, res) => {
  const printers = await Promise.all(PRINTER_IPS.map(async (ip) => ({
    ip,
    model: "Epson TM-H6000IV",
    reachable: await checkPrinter(ip),
    paper_status: "ok", // extend with SNMP polling for real paper level
    last_used: null,
  })));
  res.json({
    store_id: process.env.STORE_ID,
    vm_stats: vmStats(),
    printers,
    registers: [], // populate from your terminal heartbeats if tracked locally
  });
});

app.post("/proxmox/reboot", (req, res) => {
  res.json({ ok: true, message: "Reboot scheduled" });
  setTimeout(() => exec("sudo /sbin/reboot"), 1000);
});

app.listen(process.env.PORT || 3000, () =>
  console.log("SureFlow relay for store " + process.env.STORE_ID + " listening"));
`;

export const SETUP_STEP_DETAILS = [
  {
    step_id: "provision_vm",
    label: "Provision a lightweight Linux VM on the store's Proxmox host",
    instructions: [
      "In the Proxmox web UI, click Create VM and install Debian 12 (netinst ISO is fine).",
      "Recommended sizing: 2 vCPU, 2 GB RAM, 20 GB disk — the relay is very lightweight.",
      "Assign a STATIC IP on the store LAN (e.g. 192.168.1.50) via the router's DHCP reservation or /etc/network/interfaces. The cloud portal must always find the relay at the same address.",
      "Enable 'Start at boot' in the VM's Options tab so the relay survives host reboots.",
    ],
    commands: [],
  },
  {
    step_id: "install_node",
    label: "Install Node.js LTS on the relay VM",
    instructions: ["SSH into the VM and install Node.js LTS plus git:"],
    commands: [
      "sudo apt update && sudo apt install -y curl git",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt install -y nodejs",
      "node -v   # should print v20.x",
    ],
  },
  {
    step_id: "deploy_relay",
    label: "Clone / deploy the SureFlow relay service",
    instructions: [
      "Create the service directory and initialize the project:",
    ],
    commands: [
      "sudo mkdir -p /opt/sureflow-relay && sudo chown $USER /opt/sureflow-relay",
      "cd /opt/sureflow-relay && npm init -y && npm install express",
    ],
    postInstructions: [
      "Then create /opt/sureflow-relay/server.js with the starter relay code below. It exposes GET /status (VM stats + printer health) and POST /proxmox/reboot — exactly what the Command Center polls.",
    ],
    code: RELAY_SERVER_CODE,
  },
  {
    step_id: "configure_store",
    label: "Configure store ID and relay URL",
    instructions: [
      "Create /opt/sureflow-relay/.env with this store's identifiers. STORE_ID must match the store number in the cloud portal exactly.",
    ],
    commands: [
      "STORE_ID=001",
      "PORT=3000",
      "PRINTER_IPS=192.168.1.60,192.168.1.61",
    ],
    postInstructions: [
      "The relay URL you'll register in the portal is http://<vm-static-ip>:<PORT> (e.g. http://192.168.1.50:3000).",
    ],
  },
  {
    step_id: "configure_printers",
    label: "Configure Epson printer IP addresses",
    instructions: [
      "On each Epson TM-H6000IV, print the network settings sheet (hold the Feed button on power-up) to find its NIC's current IP.",
      "Use Epson's TMNet WebConfig (browse to the printer's IP) to assign each printer a static IP on the store LAN.",
      "Add every printer IP to the PRINTER_IPS list in the relay's .env, comma-separated, then restart the relay.",
      "The relay probes TCP port 9100 (ESC/POS raw printing) to report reachability.",
    ],
    commands: [],
  },
  {
    step_id: "enable_service",
    label: "Enable the relay as a system service (auto-start on boot)",
    instructions: ["Create a systemd unit so the relay auto-starts and restarts on failure:"],
    commands: [
      "sudo tee /etc/systemd/system/sureflow-relay.service > /dev/null <<'EOF'\n[Unit]\nDescription=SureFlow Local Relay\nAfter=network.target\n\n[Service]\nWorkingDirectory=/opt/sureflow-relay\nEnvironmentFile=/opt/sureflow-relay/.env\nExecStart=/usr/bin/node server.js\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\nEOF",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable --now sureflow-relay",
      "systemctl status sureflow-relay   # should show 'active (running)'",
    ],
  },
  {
    step_id: "test_connectivity",
    label: "Test connectivity from the cloud portal",
    instructions: [
      "From another machine on the store LAN, verify the relay answers: curl http://<vm-ip>:3000/status",
      "In the Infrastructure Command Center, set this store's Relay URL (pencil icon next to 'Relay URL') to http://<vm-ip>:3000.",
      "Click 'Poll Now' — the store card should switch to 'Relay Online' and the VM Health and Network Printers panels will populate live.",
      "Note: the browser must be able to reach the relay's address, so monitoring works from machines on the store network or over a VPN/tunnel to it.",
    ],
    commands: [],
  },
];

// ---- Phase 1: local catalog cache + offline sale capture ----
SETUP_STEP_DETAILS.push(
  {
    step_id: "install_sqlite",
    label: "Phase 1 — Install the local database for offline operation",
    instructions: [
      "The relay keeps a local SQLite copy of this store's catalog plus a queue of sales made while the internet is down.",
    ],
    commands: ["cd /opt/sureflow-relay && npm install better-sqlite3"],
  },
  {
    step_id: "deploy_sync_engine",
    label: "Phase 1 — Deploy the catalog cache, sale outbox, and sync worker",
    instructions: [
      "The original server.js from the deploy step only has /status and /proxmox/reboot. Offline selling and Force Sync need three new files plus a replacement server.js — do all four, in this order, in /opt/sureflow-relay.",
      "FILE 1 — db.js: the SQLite layer. Creates the catalog cache table, the pending_sales outbox, and the local stock-movement log, and exposes queueSale / pendingSales / getCatalog helpers.",
      "FILE 2 — sync.js: the cloud worker. Reads CLOUD_SYNC_URL and CLOUD_API_KEY from .env, pulls the catalog every 5 minutes, pushes the outbox every 30 seconds, and tracks online/offline state. Requires db.js.",
      "FILE 3 — api.js: the Express router the terminals and the portal call — GET /api/catalog, GET /api/connectivity, POST /api/sales, GET /api/pending, POST /api/sync. Requires db.js and sync.js.",
      "FILE 4 — server.js (Phase 1): replaces the original file. Keeps /status and /proxmox/reboot, mounts the router at /api, starts the sync worker, and serves the local POS build from ./pos-dist.",
      "Sales are queued locally with a store-prefixed transaction ID so the cloud can de-duplicate them on upload.",
    ],
    commands: [
      "cd /opt/sureflow-relay",
      "cp server.js server.js.phase0.bak   # keep a copy of the original before replacing it",
      "nano db.js      # paste FILE 1 below, then Ctrl+O Enter Ctrl+X",
      "nano sync.js    # paste FILE 2",
      "nano api.js     # paste FILE 3",
      "nano server.js  # replace the whole file with FILE 4",
      "sudo systemctl restart sureflow-relay",
      "ls -1 db.js sync.js api.js server.js   # all four must exist",
    ],
    postInstructions: [
      "Restart is required — systemd runs the file that was loaded at start, so the new routes do not exist until the service restarts.",
      "If the service will not come back up, the paste is almost always the cause: sudo journalctl -u sureflow-relay -n 30 --no-pager",
    ],
    codeFiles: [
      { name: "db.js", code: RELAY_DB_CODE },
      { name: "sync.js", code: RELAY_SYNC_CODE },
      { name: "api.js", code: RELAY_API_CODE },
      { name: "server.js (Phase 1)", code: RELAY_SERVER_PHASE1_CODE },
    ],
  },
  {
    step_id: "configure_cloud_sync",
    label: "Phase 1 — Configure the cloud sync API key (connect an existing relay)",
    instructions: [
      "STEP 1 — Generate the key: in the Infrastructure Command Center, expand this store's card and click 'Generate Key' in the Cloud Sync panel. The key looks like sfr_001_a1b2c3... and is displayed ONLY once — copy it before leaving the page. Regenerating instantly revokes the old key, so the relay stops syncing until you paste the new one.",
      "STEP 2 — Build the sync endpoint URL yourself — there is nothing to copy in the dashboard. Take the address you use to open the published app and append /functions/relaySync. Both forms are confirmed working: the default Base44 address (e.g. https://sure-flow-pos.base44.app/functions/relaySync) and a custom domain mapped to the app (e.g. https://pos.128k.moe/functions/relaySync). No trailing slash, and it must be https.",
      "STEP 3 — Add three variables to the relay's .env (append them to the file you already created; do not remove STORE_ID, PORT, or PRINTER_IPS). Each variable goes on its OWN line with no commas, no quotes, and no spaces around the = sign — pasting all three on one comma-separated line is the most common cause of a failed first sync.",
      "STORE_ID must exactly match the store number the key was generated for — the endpoint rejects a key used with the wrong store.",
      "STEP 4 — Restart the relay so it picks up the new environment, then confirm the first pull landed.",
    ],
    commands: [
      "sudo tee -a /opt/sureflow-relay/.env > /dev/null <<'EOF'\nCLOUD_SYNC_URL=https://sure-flow-pos.base44.app/functions/relaySync\nCLOUD_API_KEY=sfr_001_<paste the generated per-store key>\nDB_PATH=/opt/sureflow-relay/relay.db\nEOF",
      "sudo systemctl restart sureflow-relay",
      "curl -s http://localhost:3000/api/connectivity   # expect online:true + catalog_cached_at",
      "curl -s -X POST http://localhost:3000/api/sync    # force an immediate sync",
    ],
    postInstructions: [
      "How the key is used: the relay sends { store_id, api_key, action } in the JSON body of every call — 'pull' every 5 minutes to refresh the local catalog cache, 'push' every 30 seconds to upload queued offline sales. There is no header auth; the key IS the identity, so keep .env readable only by root (sudo chmod 600 /opt/sureflow-relay/.env).",
      "Test the key by hand from the relay VM (a valid key returns ok:true with the product list; a bad key returns 401):",
      "curl -s -X POST \"$CLOUD_SYNC_URL\" -H 'Content-Type: application/json' -d '{\"store_id\":\"001\",\"api_key\":\"sfr_001_...\",\"action\":\"pull\"}'",
      "Opening the endpoint in a browser returns an error — that is normal, it only accepts POST. A 404 means the URL is wrong (check for a typo or a trailing slash); a 401 means the key or STORE_ID does not match; a 403 means backend functions are not enabled on the plan.",
      "Force Sync in the portal says 'Sync Endpoint Missing' (404)? The relay is answering but is still running the original server.js from the deploy step — it has no /api/sync route. Complete the Phase 1 step above (db.js, sync.js, api.js and the Phase 1 server.js) and restart the service.",
      "Force Sync says 'Relay Unreachable'? Your browser cannot reach the relay's LAN address — you must be on the store network or a VPN into it, the service must be running, and the relay must send the CORS headers included in the code above.",
      "Any other sync failure: read the relay's own log for the exact reason — sudo journalctl -u sureflow-relay -n 50 --no-pager. Verify the .env parsed correctly with: cat /opt/sureflow-relay/.env",
      "Confirm it in the portal: the store's Cloud Sync card turns green and shows the last pull/push time, and every sync is recorded in the sync log. If it stays red — check that STORE_ID matches the store number, that the key was not regenerated after you pasted it, and that the VM can reach the internet (curl -I https://google.com).",
      "Rotating the key: generate a new one, paste it into .env, restart the relay. Queued sales are never lost — they stay in the local outbox and upload once the new key authenticates.",
    ],
  },
  {
    step_id: "verify_api_sync",
    label: "Phase 1 — Verify the /api/sync route and force a first sync",
    instructions: [
      "This is the route the portal's Force Sync button calls. If it 404s, the Phase 1 files above are not deployed or the service was not restarted.",
      "Run these on the relay VM in order — each one should return JSON, not an HTML error page.",
    ],
    commands: [
      "curl -s http://localhost:3000/api/connectivity   # online:true once the key works",
      "curl -s -X POST http://localhost:3000/api/sync   # forces a pull + push, returns the sync result",
      "curl -s http://localhost:3000/api/catalog | head -c 300   # cached products (503 = never reached the cloud yet)",
      "curl -s http://localhost:3000/api/pending       # queued offline sales, count:0 on a fresh relay",
    ],
    postInstructions: [
      "Empty reply or 'connection refused' = the relay service is not running: sudo systemctl status sureflow-relay",
      "404 on /api/sync = server.js is still the Phase 0 version, or api.js is missing / failed to load. Re-check the previous step and restart.",
      "/api/connectivity returns online:false = the routes are fine but the cloud call is failing — verify CLOUD_SYNC_URL and CLOUD_API_KEY in .env and that the VM has internet.",
      "Once these pass, click Force Sync on the store card in the Infrastructure Command Center — it should report Sync Complete and the Cloud Sync panel will show the pull/push timestamps.",
    ],
  },
  {
    step_id: "serve_pos_locally",
    label: "Phase 2 — Serve the POS from the relay and point terminals at it",
    instructions: [
      "Build the POS front end and copy the output into /opt/sureflow-relay/pos-dist — server.js serves it statically, so terminals load the app even with no internet.",
      "On each IBM SurePOS 700, set the browser's home page / kiosk URL to http://<relay-ip>:3000 instead of the cloud URL. The POS auto-detects the relay at whatever origin served it — no extra configuration needed.",
      "Terminal still loading from the cloud URL? Point it at its relay by running this once in the browser console: localStorage.setItem('relay_base_url','http://<relay-ip>:3000') then reload.",
      "Live behavior: the POS polls /api/connectivity every 15 seconds. When the relay reports its cloud link is down it shows a red OFFLINE MODE banner with the number of sales waiting to upload, a stale-catalog warning if the cache is over 24 hours old, and a Retry Now button that forces a sync. Tender is limited to cash and check, and completed sales go to the relay outbox flagged as offline captures.",
      "If the cloud is unreachable at load time the POS falls back to the relay's cached catalog, function keys, and discounts, so cashiers can keep ringing.",
    ],
    commands: [],
  },
  {
    step_id: "verify_offline_failover",
    label: "Phase 1 — Verify offline failover end to end",
    instructions: [
      "Unplug the relay VM's internet (leave the store LAN up) and confirm a cash sale still completes and prints.",
      "Check the queue grew: curl http://<vm-ip>:3000/api/pending",
      "Restore internet. Within 60 seconds the sale should appear in the cloud Transactions list exactly once, flagged as an offline capture, with stock deducted.",
      "Push the same batch twice (POST /api/sync repeatedly) and confirm no duplicate transaction is created — the cloud endpoint is idempotent on transaction ID.",
    ],
    commands: [],
  }
);

export const DEFAULT_SETUP_STEPS = SETUP_STEP_DETAILS.map(({ step_id, label }) => ({ step_id, label }));