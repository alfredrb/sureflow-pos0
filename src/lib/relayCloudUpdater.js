// Relay-side updater for cloud-pushed releases.
//
// DIRECTION MATTERS: the cloud can never open a connection to a store controller —
// it is a private LAN address behind the store's router. So the controller PULLS.
// On its normal outbound sync it now also receives `pending_update`, but the cloud
// only hands that down once the nightly maintenance sweep has folded it into
// TONIGHT's plan. That is what guarantees a push never lands mid-day.
//
// The updater never trusts itself: it stages the checkout beside the live copy,
// swaps atomically, restarts, and only commits if /api/health answers. A failed
// health gate restores the previous copy from disk, so a rollback is a symlink
// flip and a restart — seconds, not a site visit.

export const UPDATER_GIT_SETUP = `# One-time, per controller. The repo is the source of truth for BOTH the relay app
# and the diskless lane image build, so one ref pins the whole store.
sudo install -d -o sureflow -g sureflow /opt/sureflow
sudo -u sureflow git clone --no-checkout git@github.com:<org>/sureflow-controller.git /opt/sureflow/repo

# Deploy key: read-only, per store. A store can never push code back up.
sudo -u sureflow ssh-keygen -t ed25519 -N "" -f /home/sureflow/.ssh/id_ed25519
cat /home/sureflow/.ssh/id_ed25519.pub    # add to the repo as a READ-ONLY deploy key

# The live app is a symlink. Swapping the symlink IS the deploy, and pointing it
# back IS the rollback.
sudo -u sureflow git -C /opt/sureflow/repo fetch --tags --prune
sudo -u sureflow git -C /opt/sureflow/repo worktree add /opt/sureflow/releases/initial <current-tag>
sudo ln -sfn /opt/sureflow/releases/initial /opt/sureflow-relay
echo "<current-tag>" | sudo -u sureflow tee /opt/sureflow/current_ref`;

export const UPDATER_CODE = `#!/usr/bin/env node
// /opt/sureflow/bin/sureflow-updater  — cloud-pushed release applier
// updater-build 1
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLOUD    = process.env.CLOUD_URL;              // Base44 functions base URL
const STORE_ID = process.env.STORE_ID;
const API_KEY  = process.env.CLOUD_API_KEY;
const REPO     = '/opt/sureflow/repo';
const RELEASES = '/opt/sureflow/releases';
const LIVE     = '/opt/sureflow-relay';              // symlink -> a release dir
const REF_FILE = '/opt/sureflow/current_ref';
const NFS_ROOT = '/srv/nfs/lane-root';               // symlink -> a built root
const HEALTH   = 'http://localhost:3000/api/health';
const GATE_MS  = 90000;

const sh = (cmd) => execSync(cmd, { stdio: 'pipe' }).toString().trim();
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function cloud(action, extra) {
  const res = await fetch(CLOUD + '/relaySync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store_id: STORE_ID, api_key: API_KEY, action, ...extra }),
  });
  return res.json();
}

const report = (assignment_id, result, extra = {}) =>
  cloud('update_result', { assignment_id, result, ...extra });

async function healthy() {
  const deadline = Date.now() + GATE_MS;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(HEALTH);
      if (r.ok) return true;
    } catch (_e) { /* still booting */ }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

(async () => {
  const pull = await cloud('pull', {});
  const job = pull && pull.pending_update;
  if (!job) { log('no pending update'); return; }

  const ref = job.git_ref;
  const prevRef = fs.existsSync(REF_FILE) ? fs.readFileSync(REF_FILE, 'utf8').trim() : '';
  const prevLive = fs.existsSync(LIVE) ? fs.realpathSync(LIVE) : '';
  const prevRoot = fs.existsSync(NFS_ROOT) ? fs.realpathSync(NFS_ROOT) : '';
  if (ref === prevRef) { log('already on', ref); return report(job.assignment_id, 'applied', { current_ref: ref, previous_ref: prevRef }); }

  log('applying', ref, 'over', prevRef || '(unknown)');
  await report(job.assignment_id, 'in_progress');

  const stage = path.join(RELEASES, ref.replace(/[^\\w.-]/g, '_'));
  try {
    // ---- 1. Stage the checkout BESIDE the live copy. Nothing live is touched yet.
    sh('git -C ' + REPO + ' fetch --tags --prune');
    if (fs.existsSync(stage)) sh('rm -rf ' + stage);
    sh('git -C ' + REPO + ' worktree add --detach ' + stage + ' ' + ref);
    if (fs.existsSync(path.join(stage, 'package.json'))) {
      sh('cd ' + stage + ' && npm ci --omit=dev');
    }
    // Carry the store's own .env across — it is machine config, not code.
    sh('cp -a ' + prevLive + '/.env ' + stage + '/.env');

    // ---- 2. Rebuild the diskless lane root from the SAME ref, into a new dir.
    // The lanes are still running off the old root at this point; they only move
    // when the maintenance window reboots them.
    let newRoot = '';
    if (job.include_lane_image) {
      newRoot = '/srv/nfs/roots/' + ref.replace(/[^\\w.-]/g, '_');
      sh(stage + '/image/build-lane-root.sh ' + newRoot);
      sh('exportfs -ra');
    }

    // ---- 3. Atomic swap + restart.
    sh('ln -sfn ' + stage + ' ' + LIVE);
    if (newRoot) sh('ln -sfn ' + newRoot + ' ' + NFS_ROOT);
    sh('systemctl restart sureflow-relay');

    // ---- 4. Health gate. This is the only thing that decides commit vs rollback.
    if (await healthy()) {
      fs.writeFileSync(REF_FILE, ref + '\\n');
      log('applied', ref);
      await report(job.assignment_id, 'applied', { current_ref: ref, previous_ref: prevRef });
    } else {
      throw new Error('health gate failed after restart');
    }
  } catch (e) {
    // ---- Rollback. The previous release dir and root were never deleted, so this
    // is a symlink flip: the store is back on known-good code in seconds.
    log('FAILED:', e.message, '- rolling back to', prevRef || '(previous)');
    try {
      if (prevLive) sh('ln -sfn ' + prevLive + ' ' + LIVE);
      if (prevRoot) { sh('ln -sfn ' + prevRoot + ' ' + NFS_ROOT); sh('exportfs -ra'); }
      sh('systemctl restart sureflow-relay');
    } catch (e2) { log('rollback error:', e2.message); }
    const back = await healthy();
    await report(job.assignment_id, back ? 'rolled_back' : 'failed', {
      current_ref: prevRef,
      error: e.message + (back ? '' : ' (rollback did NOT come up healthy — controller needs hands)'),
    });
  }

  // Keep the last few releases so a rollback target always exists on disk.
  try { sh("cd " + RELEASES + " && ls -1dt */ | tail -n +4 | xargs -r rm -rf && git -C " + REPO + " worktree prune"); } catch (_e) {}
})();`;

export const UPDATER_UNIT = `# /etc/systemd/system/sureflow-updater.service
[Unit]
Description=SureFlow cloud-pushed controller update
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/opt/sureflow-relay/.env
ExecStart=/usr/bin/node /opt/sureflow/bin/sureflow-updater

# ---
# /etc/systemd/system/sureflow-updater.timer
[Unit]
Description=Poll the cloud for a pushed controller update

[Timer]
# Inside the maintenance window only. The cloud also refuses to hand the job down
# outside the window, so this is belt and braces, not the only guard.
OnCalendar=*-*-* 00:25:00
OnCalendar=*-*-* 00:55:00
Persistent=false

[Install]
WantedBy=timers.target`;

export const UPDATER_HA_NOTES = `# HA store — the pair must NOT update together, or a bad ref takes the store down.
# Rolling order, run from the secondary:
#
#   1. secondary: sureflow-updater            (VIP is still on the primary, store unaffected)
#   2. secondary: health gate passes          (a failure here rolls back and stops — store never noticed)
#   3. primary:   systemctl stop keepalived   (VIP floats to the freshly updated secondary)
#   4. primary:   sureflow-updater
#   5. primary:   systemctl start keepalived  (VIP returns once DRBD reads UpToDate on both)
#
# If step 2 rolls back, STOP. Do not fail over onto code that just failed its gate.`;

export const UPDATER_VERIFY = `# Which ref is this store on?
cat /opt/sureflow/current_ref
readlink -f /opt/sureflow-relay
readlink -f /srv/nfs/lane-root

# Dry-run the updater by hand (it is idempotent — same ref = no-op)
sudo systemctl start sureflow-updater
journalctl -u sureflow-updater -n 40 --no-pager

# Rollback targets still on disk (keep at least one)
ls -1dt /opt/sureflow/releases/*/

# Manual rollback, if the automatic one could not finish
sudo ln -sfn /opt/sureflow/releases/<previous> /opt/sureflow-relay
sudo systemctl restart sureflow-relay && curl -s localhost:3000/api/health`;

export const UPDATER_STEPS = [
  {
    title: "Clone the repo and make the live app a symlink",
    detail:
      "The deploy is a symlink flip, which is what makes the rollback instant. Use a read-only deploy key per store so a controller can never push code back up.",
  },
  {
    title: "Install the updater and its timer",
    detail:
      "The timer fires inside the maintenance window. It polls the cloud outbound — nothing opens a connection into the store.",
  },
  {
    title: "Author and release from Controller Updates",
    detail:
      "Pin a tag or commit SHA, not a branch: a branch moves, so two stores updating on different nights would land on different code.",
  },
  {
    title: "Wait for the store's window",
    detail:
      "The cloud only hands the job down once the nightly sweep folded it into tonight's plan. A store with no enabled window is never pushed to.",
  },
  {
    title: "Confirm the ref and the health gate",
    detail:
      "Applied means /api/health answered after the restart. Rolled back means it did not, and the controller restored the previous ref by itself and raised an alert.",
  },
];