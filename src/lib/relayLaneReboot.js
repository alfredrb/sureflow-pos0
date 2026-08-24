// Lane reboot — relay module + routes (lane-reboot-build 2).
//
// WHY THIS IS A QUEUE AND NOT AN SSH CALL
// The lanes live on the isolated PXE VLAN (10.0.40.x) and reach the relay on the
// backend VLAN through the controller, which NATs them. Two consequences that kill
// every inbound design:
//   * the relay CANNOT open a connection to 10.0.40.x — no SSH, no HTTP, nothing;
//   * the relay sees the CONTROLLER's address as the source of every lane request,
//     so /api/whoami can never report a lane's real IP and lane_ip is meaningless.
// Outbound (lane -> relay) always works, since that is how the lane loads the POS.
//
// So the relay never reaches out. It holds a queue of pending reboots keyed by
// REGISTER ID — the one identity the lane knows for certain, from its kernel command
// line — and the lane's own agent polls for it and reboots itself.

export const RELAY_LANE_REBOOT_CODE = `// laneReboot.js — SureFlow Local Relay
// Pending-reboot queue for the diskless lanes. lane-reboot-build 2
//
// In-memory on purpose: a queued reboot must NOT survive a relay restart, or a lane
// could pick up a stale command hours later and reboot in the middle of a sale.
const pending = new Map();   // register_id -> { requested_at, requested_by }
const TTL_MS = 2 * 60 * 1000; // a reboot not collected within 2 minutes is abandoned

// Seen-lane register. Every agent poll stamps its register_id here, which is the ONLY
// way the relay learns a lane is alive — it cannot probe the PXE VLAN inbound, and the
// source IP on a lane request is the controller's, not the lane's. In memory on purpose:
// after a relay restart "seen" should mean "has polled since the relay came up", not a
// stale claim about a lane that may have been switched off hours ago.
const seen = new Map();      // register_id -> { last_seen, polls }

function normalizeRegister(value) {
  return String(value || "").trim().toUpperCase();
}

function queueReboot(registerId, requestedBy) {
  const id = normalizeRegister(registerId);
  if (!id) throw new Error("register_id is required");
  pending.set(id, { requested_at: Date.now(), requested_by: requestedBy || "unknown" });
  return { ok: true, register_id: id };
}

// Called by the lane agent. Consumes the command so it only ever fires once.
function claimReboot(registerId) {
  const id = normalizeRegister(registerId);
  if (id) {
    // The poll itself is the heartbeat, so no extra call from the lane is needed.
    const prev = seen.get(id);
    seen.set(id, { last_seen: Date.now(), polls: (prev?.polls || 0) + 1 });
  }
  const entry = pending.get(id);
  if (!entry) return { reboot: false };
  pending.delete(id);
  if (Date.now() - entry.requested_at > TTL_MS) {
    return { reboot: false, expired: true };
  }
  return { reboot: true, requested_by: entry.requested_by };
}

function listPending() {
  const now = Date.now();
  return [...pending.entries()]
    .filter(([, v]) => now - v.requested_at <= TTL_MS)
    .map(([register_id, v]) => ({ register_id, ...v }));
}

// Every lane that has ever polled since the relay started, newest first, with how long
// ago it last checked in. A lane that has stopped polling is either powered off, still
// booting, or running a root without the agent.
function listSeen() {
  const now = Date.now();
  return [...seen.entries()]
    .map(([register_id, v]) => ({
      register_id,
      last_seen: new Date(v.last_seen).toISOString(),
      seconds_ago: Math.round((now - v.last_seen) / 1000),
      polls: v.polls,
      reboot_pending: pending.has(register_id),
    }))
    .sort((a, b) => a.seconds_ago - b.seconds_ago);
}

module.exports = { queueReboot, claimReboot, listPending, listSeen };
`;

export const RELAY_LANE_REBOOT_ROUTES_CODE = `// server.js (patch) — lane reboot queue.
// Mount ABOVE the SPA catch-all. The POS-facing claim route stays OPEN on the LAN
// (a lane has no token), while queuing a reboot is token-gated.
const { queueReboot, claimReboot, listPending, listSeen } = require("./laneReboot");
console.log("lane-reboot-build 3");

// Admin portal / POS asks for a lane to reboot. Identified by REGISTER ID, never by
// IP — the relay cannot see or reach a lane's real address across the PXE VLAN.
app.post("/lane/reboot", requireRelayToken, (req, res) => {
  try {
    const out = queueReboot(req.body?.register_id, req.body?.requested_by);
    console.log(\`[lane-reboot] queued \${out.register_id} (by \${req.body?.requested_by || "unknown"})\`);
    res.json({ ...out, queued: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// The lane's own agent polls this. Open — it only ever returns that lane's own flag,
// and the reboot is consumed on read.
app.get("/lane/reboot-pending", (req, res) => {
  res.json(claimReboot(req.query?.register_id));
});

// Visibility for the Infrastructure Command Center.
app.get("/lane/reboot-queue", requireRelayToken, (req, res) => {
  res.json({ pending: listPending() });
});

// Which lanes have checked in, and how long ago. This is what the controller console
// menu's Lanes table reads for "booted?" — built from agent polls, because the relay has
// no inbound path to a lane to ask directly.
app.get("/lane/seen", requireRelayToken, (req, res) => {
  res.json({ lanes: listSeen(), relay_started_at: new Date(Date.now() - process.uptime() * 1000).toISOString() });
});
`;

export const LANE_REBOOT_AGENT_CODE = `#!/usr/bin/env node
// /usr/local/bin/sureflow-lane-agent — runs ON THE LANE, inside the diskless image.
// lane-agent-build 1
//
// Two jobs, both of which avoid any inbound connection to the lane:
//   1. Listens on 127.0.0.1:3099 so the POS in the kiosk browser can reboot THIS
//      lane instantly. Loopback only — nothing off-box can reach it.
//   2. Polls the relay for a queued reboot from the admin portal. Outbound only, so
//      it works straight through the controller's NAT.
const http = require("http");
const { execFile } = require("child_process");

// The kernel command line is the lane's authoritative identity — the same values the
// PXE entry set. Never trust an IP here; the relay sees the controller's, not ours.
const cmdline = require("fs").readFileSync("/proc/cmdline", "utf8");
const arg = (k) => (cmdline.match(new RegExp(\`sureflow\\\\.\${k}=(\\\\S+)\`)) || [])[1] || "";
const REGISTER_ID = arg("register_id");
const RELAY = (arg("relay") || "").replace(/\\/$/, "");
const POLL_MS = 10000;

function reboot(reason) {
  console.log(\`[lane-agent] rebooting: \${reason}\`);
  execFile("sudo", ["systemctl", "reboot"], (err) => {
    if (err) console.error("[lane-agent] reboot failed:", err.message);
  });
}

// 1. Loopback endpoint for the POS.
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
    if (req.method === "POST" && req.url === "/reboot") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, register_id: REGISTER_ID }));
      // Answer first, then go down, so the POS gets its confirmation.
      return setTimeout(() => reboot("POS request"), 500);
    }
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, register_id: REGISTER_ID, relay: RELAY }));
    }
    res.writeHead(404);
    res.end();
  })
  .listen(3099, "127.0.0.1", () => console.log(\`[lane-agent] listening on 127.0.0.1:3099 as \${REGISTER_ID}\`));

// 2. Outbound poll for an admin-queued reboot.
async function poll() {
  if (!RELAY || !REGISTER_ID) return;
  try {
    const r = await fetch(\`\${RELAY}/lane/reboot-pending?register_id=\${encodeURIComponent(REGISTER_ID)}\`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await r.json();
    if (data.reboot) reboot(\`queued by \${data.requested_by || "admin"}\`);
  } catch {
    // Relay unreachable is normal and harmless — try again on the next tick.
  }
}
setInterval(poll, POLL_MS);
poll();
`;

export const LANE_REBOOT_AGENT_UNIT = `# /etc/systemd/system/sureflow-lane-agent.service (inside the diskless image)
[Unit]
Description=SureFlow Lane Agent (reboot control)
After=network-online.target
Wants=network-online.target

[Service]
# Runs as the same unprivileged user as the kiosk; the image grants it NOPASSWD sudo.
User=sureflow
ExecStart=/usr/bin/node /usr/local/bin/sureflow-lane-agent
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
`;

export const LANE_REBOOT_AGENT_BUILD_STEPS = `# Install the lane agent into the diskless image (run on the PXE CONTROLLER).
# Node is needed inside the image — it is a ~30MB addition to the root.

# Set ROOT and PROVE it before chrooting. An unset ROOT makes the next command
# collapse to "chroot apt-get ...", which fails with the confusing
# "cannot change root directory to 'apt-get'". ROOT also does NOT survive a new
# shell or a sudo -i, so re-run this line in every session.
ROOT=/srv/nfs/sureflow-legacy
ls -d "$ROOT" || { echo "ROOT is wrong or unset — stop here"; }

sudo chroot "$ROOT" /bin/bash -eux <<'CHROOT'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends nodejs
  node --version   # must be >= 18 for the built-in fetch the agent uses
CHROOT

# Paste the agent and its unit in (see the two blocks above), then:
sudo chmod +x "$ROOT/usr/local/bin/sureflow-lane-agent"
sudo chroot "$ROOT" systemctl enable sureflow-lane-agent

# Republish the boot files so the lanes pick up the new root.
sudo cp "$ROOT"/boot/vmlinuz-*    /srv/tftp/debian-legacy/vmlinuz
sudo cp "$ROOT"/boot/initrd.img-* /srv/tftp/debian-legacy/initrd.img
`;

export const LANE_REBOOT_VERIFY = `# FIRST, ON THE RELAY — load the token into your shell.
# It lives in the .env that systemd reads; a login shell does NOT have it, so every
# curl below would send an empty header and come back
# {"error":"Invalid or missing relay token"} even though the relay is perfectly fine.
export RELAY_ACCESS_TOKEN=$(grep -E '^RELAY_ACCESS_TOKEN=' /opt/sureflow-relay/.env | cut -d= -f2-)
echo "\${RELAY_ACCESS_TOKEN:?token not found in .env}"

# ON THE LANE — is the agent up and does it know who it is?
systemctl status sureflow-lane-agent --no-pager
curl -s http://127.0.0.1:3099/health
# expect: {"ok":true,"register_id":"REG-005","relay":"http://10.0.25.100:3000"}
# An empty register_id means the PXE APPEND line lost sureflow.register_id — fix the
# boot entry, because the whole queue is keyed on it.

# ON THE LANE — prove the outbound path to the relay works (this direction always does)
curl -s "$(grep -o 'sureflow.relay=[^ ]*' /proc/cmdline | cut -d= -f2-)/lane/reboot-pending?register_id=REG-005"
# expect: {"reboot":false}

# ON THE RELAY — queue a reboot and watch the lane collect it within ~10s
curl -s -X POST http://localhost:3000/lane/reboot \\
  -H 'Content-Type: application/json' \\
  -H "X-Relay-Token: $RELAY_ACCESS_TOKEN" \\
  -d '{"register_id":"REG-005","requested_by":"curl"}'
curl -s -H "X-Relay-Token: $RELAY_ACCESS_TOKEN" http://localhost:3000/lane/reboot-queue

# NOTE: do NOT try to reach the lane from the relay — it cannot work by design.
#   ssh sureflow@10.0.40.21   -> times out, the controller does not route inbound
#   /api/whoami from a lane   -> reports the CONTROLLER's IP, never the lane's
`;