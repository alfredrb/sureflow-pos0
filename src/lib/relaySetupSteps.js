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
      "Create these three files in /opt/sureflow-relay alongside server.js, then replace server.js with the Phase 1 version below.",
      "db.js holds the SQLite schema (catalog cache, pending_sales outbox, local stock movements). sync.js talks to the cloud. api.js exposes the endpoints the terminals call.",
      "Sales are queued locally with a store-prefixed transaction ID and pushed to the cloud every 30 seconds; the catalog is pulled down every 5 minutes.",
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
    label: "Phase 1 — Configure the cloud sync credentials",
    instructions: [
      "In the Infrastructure Command Center, click 'Generate Key' in this store's Cloud Sync card. The key is shown once — copy it immediately.",
      "Get the sync endpoint URL from the Base44 dashboard under Code → Functions → relaySync.",
      "Add both to /opt/sureflow-relay/.env, then restart the relay: sudo systemctl restart sureflow-relay",
    ],
    commands: [
      "CLOUD_SYNC_URL=https://<your-app-domain>/api/apps/<app-id>/functions/relaySync",
      "CLOUD_API_KEY=<paste the generated per-store key>",
      "DB_PATH=/opt/sureflow-relay/relay.db",
    ],
    postInstructions: [
      "Verify the first sync landed: curl http://<vm-ip>:3000/api/connectivity — you should see online: true and a catalog_cached_at timestamp. The Cloud Sync card in the portal will turn green.",
    ],
  },
  {
    step_id: "serve_pos_locally",
    label: "Phase 1 — Serve the POS from the relay and point terminals at it",
    instructions: [
      "Build the POS front end and copy the output into /opt/sureflow-relay/pos-dist — server.js serves it statically, so terminals load the app even with no internet.",
      "On each IBM SurePOS 700, set the browser's home page / kiosk URL to http://<relay-ip>:3000 instead of the cloud URL.",
      "Terminals poll /api/connectivity: when offline they show an amber 'Offline — Cash Only' banner, block card, gift card, store credit, rewards, returns, exchanges, loyalty, and tax-exempt, and warn at login if the cached catalog is more than 24 hours old.",
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