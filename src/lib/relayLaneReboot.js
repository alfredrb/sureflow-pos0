// Lane reboot — relay module + routes (lane-reboot-build 1).
//
// The POS runs as a Chromium kiosk inside the lane's diskless image, and a browser
// can never reboot its own machine. The relay can: it already runs privileged on the
// store network, so it reboots the lane over SSH as the 'sureflow' user (which the
// image gives NOPASSWD sudo).
//
// Target resolution, in order:
//   1. lane_ip in the request body        — the admin portal rebooting a named lane
//   2. the caller's own address (req.ip)  — a lane rebooting ITSELF from the POS
// So the on-lane POS does not need to know its own IP for this to work.

export const RELAY_LANE_REBOOT_CODE = `// laneReboot.js — SureFlow Local Relay
// Reboots a diskless lane terminal over SSH. lane-reboot-build 1
const { execFile } = require("child_process");

const SSH_USER = process.env.LANE_SSH_USER || "sureflow";
const SSH_KEY  = process.env.LANE_SSH_KEY  || "/opt/sureflow-relay/.ssh/lane_id_ed25519";

// Only ever accept a bare IPv4 address as a target — this string is handed to ssh.
function normalizeIp(value) {
  if (!value) return "";
  // Express reports IPv4 callers as ::ffff:10.0.40.21 behind the IPv6 stack.
  const clean = String(value).replace(/^::ffff:/, "").trim();
  return /^\\d{1,3}(\\.\\d{1,3}){3}$/.test(clean) ? clean : "";
}

function rebootLane(laneIp) {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", SSH_KEY,
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=no",
      "-o", "UserKnownHostsFile=/dev/null",
      "-o", "ConnectTimeout=5",
      \`\${SSH_USER}@\${laneIp}\`,
      "sudo systemctl reboot",
    ];
    // The lane drops the connection as it goes down, so ssh exiting 255 mid-reboot
    // is a SUCCESS here — only a connect/auth failure is a real error.
    execFile("ssh", args, { timeout: 15000 }, (err, stdout, stderr) => {
      const out = \`\${stdout || ""}\${stderr || ""}\`;
      if (!err) return resolve({ ok: true, detail: "reboot issued" });
      if (/closed by remote host|Connection to .* closed|Broken pipe/i.test(out)) {
        return resolve({ ok: true, detail: "reboot issued (lane dropped the connection)" });
      }
      reject(new Error(out.trim() || err.message));
    });
  });
}

module.exports = { rebootLane, normalizeIp };
`;

export const RELAY_LANE_REBOOT_ROUTES_CODE = `// server.js (patch) — lane reboot route.
// Mount with the other privileged /ops routes, BEHIND requireRelayToken, and always
// ABOVE the SPA catch-all.
const { rebootLane, normalizeIp } = require("./laneReboot");
console.log("lane-reboot-build 1");

app.post("/lane/reboot", requireRelayToken, async (req, res) => {
  // An explicit lane_ip is the admin portal targeting a named lane; with no body the
  // caller IS the lane (the POS kiosk rebooting itself).
  const target = normalizeIp(req.body?.lane_ip) || normalizeIp(req.ip || req.socket?.remoteAddress);
  if (!target) return res.status(400).json({ error: "No valid lane IP to reboot" });
  console.log(\`[lane-reboot] \${req.body?.register_id || "unknown register"} -> \${target} (by \${req.body?.requested_by || "unknown"})\`);
  try {
    const result = await rebootLane(target);
    res.json({ ...result, lane_ip: target });
  } catch (e) {
    console.error("[lane-reboot] failed:", e.message);
    res.status(502).json({ error: \`Could not reboot \${target}: \${e.message}\` });
  }
});
`;

export const RELAY_LANE_REBOOT_KEY_SETUP = `# One-time: give the relay a key it can use to reboot the lanes.
# Run ON THE RELAY. The lane image already grants 'sureflow' NOPASSWD sudo and reads
# authorized keys from /etc/ssh/authorized_keys/%u, so the public key goes there.

sudo -u sureflow mkdir -p /opt/sureflow-relay/.ssh
sudo -u sureflow ssh-keygen -t ed25519 -N '' -C sureflow-relay \\
  -f /opt/sureflow-relay/.ssh/lane_id_ed25519
sudo chmod 600 /opt/sureflow-relay/.ssh/lane_id_ed25519
cat /opt/sureflow-relay/.ssh/lane_id_ed25519.pub

# Then ON THE PXE CONTROLLER, add that public key to the diskless image so EVERY
# lane trusts the relay (one edit covers the whole fleet):
sudo mkdir -p /srv/nfs/sureflow-legacy/etc/ssh/authorized_keys
sudo tee -a /srv/nfs/sureflow-legacy/etc/ssh/authorized_keys/sureflow <<'KEY'
<paste the relay's lane_id_ed25519.pub line here>
KEY
sudo chmod 644 /srv/nfs/sureflow-legacy/etc/ssh/authorized_keys/sureflow

# Prove it from the relay (should print the lane's hostname, no password prompt):
ssh -i /opt/sureflow-relay/.ssh/lane_id_ed25519 -o BatchMode=yes sureflow@<lane-ip> hostname
`;

export const RELAY_LANE_REBOOT_ENV = `# /opt/sureflow-relay/.env — lane reboot
LANE_SSH_USER=sureflow
LANE_SSH_KEY=/opt/sureflow-relay/.ssh/lane_id_ed25519
`;