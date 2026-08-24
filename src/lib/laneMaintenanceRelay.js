// Nightly maintenance — relay side (lane-maintenance-build 1).
//
// The cloud only PLANS. It cannot reach the store LAN, and the relay cannot reach the
// lanes on the PXE VLAN either. So the chain is entirely outbound at every hop:
//
//   cloud plans tasks  ->  relay claims them (outbound HTTPS)
//                      ->  relay queues a local reboot per lane
//                      ->  lane agent polls and reboots itself (outbound HTTP)
//                      ->  relay reports results back to the cloud
//
// A diskless lane's reboot IS its update — it remounts the shared NFS root, so a new
// image on the controller is picked up with no per-lane work.

export const RELAY_LANE_MAINTENANCE_CODE = `// laneMaintenance.js — SureFlow Local Relay
// Claims tonight's maintenance tasks from the cloud and carries them out locally.
// lane-maintenance-build 1
const { queueReboot } = require("./laneReboot");

const CLOUD_URL = process.env.CLOUD_URL;         // https://<app>/functions/laneMaintenanceQueue
const STORE_ID  = process.env.STORE_ID;
const API_KEY   = process.env.CLOUD_API_KEY;

async function callCloud(payload) {
  const r = await fetch(CLOUD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ store_id: STORE_ID, api_key: API_KEY, ...payload }),
    signal: AbortSignal.timeout(15000),
  });
  return r.json();
}

async function runMaintenance() {
  if (!CLOUD_URL || !STORE_ID || !API_KEY) {
    console.log("[maintenance] not configured — CLOUD_URL, STORE_ID and CLOUD_API_KEY are all required");
    return { ok: false };
  }

  const claim = await callCloud({ action: "claim" });
  const tasks = claim.tasks || [];
  if (tasks.length === 0) return { ok: true, tasks: 0 };

  const results = [];
  for (const t of tasks) {
    try {
      if (t.task_type === "lane_reboot") {
        // Queued, not pushed: the lane's own agent collects this within ~10s. The
        // relay cannot open a connection to a lane by design.
        queueReboot(t.register_id, "nightly maintenance");
        results.push({ id: t.id, status: "completed", detail: "Reboot queued for lane pickup" });
        console.log(\`[maintenance] queued reboot for \${t.register_id}\`);
      } else {
        // The controller update is deliberately NOT automated here. Reporting it as
        // skipped keeps the record honest instead of claiming work nobody did.
        results.push({
          id: t.id,
          status: "skipped",
          detail: "Controller update is a supervised step — run sureflow-controller-update on the box",
        });
      }
    } catch (e) {
      results.push({ id: t.id, status: "failed", detail: e.message });
    }
  }

  await callCloud({ action: "report", results });
  return { ok: true, tasks: tasks.length };
}

module.exports = { runMaintenance };
`;

export const RELAY_LANE_MAINTENANCE_ROUTES_CODE = `// server.js (patch) — nightly maintenance poller.
// Mount ABOVE the SPA catch-all.
const { runMaintenance } = require("./laneMaintenance");
console.log("lane-maintenance-build 1");

// Polled on a timer. Five minutes is frequent enough for staggered batches that are
// released minutes apart, and cheap enough to leave running all day.
setInterval(() => {
  runMaintenance().catch((e) => console.error("[maintenance]", e.message));
}, 5 * 60 * 1000);

// Manual trigger for technicians — token-gated like every other admin route.
app.post("/lane/maintenance/run", requireRelayToken, async (req, res) => {
  try {
    res.json(await runMaintenance());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
`;

export const RELAY_LANE_MAINTENANCE_ENV = `# /opt/sureflow-relay/.env — add if not already present.
# NO inline comments on these lines. A trailing "# ..." is parsed as part of the
# value, which has already cost us a debugging session on this file.
CLOUD_URL=https://<your-app-host>/functions/laneMaintenanceQueue
STORE_ID=001
CLOUD_API_KEY=sfr_001_<paste from the Infrastructure Command Center>
`;

export const RELAY_LANE_MAINTENANCE_VERIFY = `# Load the relay token first — a login shell does NOT have the systemd environment,
# so without this every curl returns {"error":"Invalid or missing relay token"}.
export RELAY_ACCESS_TOKEN=$(grep -E '^RELAY_ACCESS_TOKEN=' /opt/sureflow-relay/.env | cut -d= -f2-)
echo "\${RELAY_ACCESS_TOKEN:?token not found in .env}"

# 1. Nothing planned yet -> an empty claim is the correct, healthy answer.
curl -s -X POST http://localhost:3000/lane/maintenance/run \\
  -H "X-Relay-Token: $RELAY_ACCESS_TOKEN"
# expect: {"ok":true,"tasks":0}

# 2. Turn the window on for this store in the Infrastructure Command Center, then
#    force a planning pass from the cloud (Run Now on the maintenance card).

# 3. Claim it and watch the reboots queue locally.
curl -s -X POST http://localhost:3000/lane/maintenance/run \\
  -H "X-Relay-Token: $RELAY_ACCESS_TOKEN"
curl -s -H "X-Relay-Token: $RELAY_ACCESS_TOKEN" http://localhost:3000/lane/reboot-queue

# 4. On a LANE — the agent collects it within ~10 seconds.
journalctl -u sureflow-lane-agent -n 20 --no-pager
# expect: [lane-agent] rebooting: queued by nightly maintenance

# A lane with a parked sale or an operator still clocked in is planned as DEFERRED and
# never appears in the queue. That is the safety rule working, not a fault.
`;

export const LANE_MAINTENANCE_STEPS = [
  {
    step: "Enable the window per store",
    detail:
      "Off by default so no lane is ever rebooted by surprise. Set the batch size and the gap between batches on the store's maintenance card in the Infrastructure Command Center.",
  },
  {
    step: "Deploy the relay module",
    detail:
      "Drop laneMaintenance.js into /opt/sureflow-relay, add the routes patch to server.js, add the three .env values, then restart: sudo systemctl restart sureflow-relay.",
  },
  {
    step: "Confirm the lane agent is present",
    detail:
      "The reboot itself is carried out by sureflow-lane-agent inside the diskless image. If a lane has no agent, its task will be claimed and queued but nothing will ever collect it.",
  },
  {
    step: "Plan runs at 00:20, retry at 00:50",
    detail:
      "The first pass plans the store and defers busy lanes. The retry pass gives deferred lanes one more chance, then leaves anything still busy alone rather than forcing it down.",
  },
  {
    step: "Controller update stays supervised",
    detail:
      "The planner queues the step and records whether the store is HA (rolling update via failover) or standalone, but the relay reports it as skipped until a technician runs it. Nothing pretends to have updated a controller on its own.",
  },
];