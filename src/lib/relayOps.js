// Phase 3 — relay hardening and operations.
// auth.js protects the relay's privileged routes with a per-store token, and the two
// shell scripts give each VM self-updating and local backup/restore.

export const RELAY_AUTH_CODE = `// auth.js — SureFlow Local Relay (Phase 3)
// Token gate for privileged relay routes (reboot, sync, printing diagnostics,
// backup, self-update). POS routes used by the registers stay open on the LAN so a
// terminal never needs a secret to ring a sale.
const TOKEN = process.env.RELAY_ACCESS_TOKEN || "";

function readToken(req) {
  const header = req.headers["x-relay-token"];
  if (header) return String(header);
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return req.query?.relay_token || "";
}

// Express middleware — mount on the routes that must be protected.
function requireRelayToken(req, res, next) {
  if (!TOKEN) {
    console.warn("[auth] RELAY_ACCESS_TOKEN is not set — privileged routes are OPEN");
    return next();
  }
  if (readToken(req) === TOKEN) return next();
  return res.status(401).json({ error: "Invalid or missing relay token" });
}

module.exports = { requireRelayToken, tokenConfigured: () => !!TOKEN };
`;

export const RELAY_SELF_UPDATE_SCRIPT = `#!/usr/bin/env bash
# sureflow-selfupdate.sh — runs ON the relay VM (systemd timer, nightly).
# Pulls the relay service files + POS build from the store's update source, applies
# them atomically, restarts the service and rolls back if the relay stops answering.
set -euo pipefail

RELAY_DIR=/opt/sureflow-relay
SRC="\${UPDATE_SOURCE:-}"            # rsync/ssh source, e.g. build@buildhost:/srv/sureflow/current
PORT="\${PORT:-3000}"
STAMP=\$(date +%Y%m%d-%H%M%S)

[ -n "\$SRC" ] || { echo "UPDATE_SOURCE is not set in \$RELAY_DIR/.env"; exit 2; }

echo "==> snapshotting current install"
sudo cp -a "\$RELAY_DIR" "\$RELAY_DIR.bak-\$STAMP"

echo "==> pulling update from \$SRC"
sudo rsync -a --delete \\
  --exclude '.env' --exclude 'relay.db' --exclude 'node_modules' --exclude '*.bak-*' \\
  "\$SRC/" "\$RELAY_DIR/"

echo "==> installing dependencies"
cd "\$RELAY_DIR" && sudo npm install --omit=dev

echo "==> restarting relay"
sudo systemctl restart sureflow-relay
sleep 5

CODE=\$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:\$PORT/api/connectivity" || echo 000)
if [ "\$CODE" != "200" ]; then
  echo "!! relay unhealthy after update (HTTP \$CODE) — rolling back"
  sudo rsync -a --delete "\$RELAY_DIR.bak-\$STAMP/" "\$RELAY_DIR/"
  sudo systemctl restart sureflow-relay
  exit 1
fi

echo "==> update ok, pruning old snapshots (keeping 3)"
ls -1dt "\$RELAY_DIR".bak-* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf
echo "relay updated at \$STAMP"
`;

export const RELAY_BACKUP_SCRIPT = `#!/usr/bin/env bash
# sureflow-backup.sh — runs ON the relay VM (systemd timer, hourly).
# Backs up the local SQLite database and .env so a dead VM can be rebuilt without
# losing queued offline sales. Restore mode reverses it.
set -euo pipefail

RELAY_DIR=/opt/sureflow-relay
BACKUP_DIR="\${BACKUP_DIR:-/var/backups/sureflow}"
DB="\${DB_PATH:-\$RELAY_DIR/relay.db}"
KEEP=48

mode="\${1:-backup}"
sudo mkdir -p "\$BACKUP_DIR"

if [ "\$mode" = "backup" ]; then
  STAMP=\$(date +%Y%m%d-%H%M%S)
  OUT="\$BACKUP_DIR/relay-\$STAMP"
  # sqlite3 .backup is safe on a live database; plain cp is not.
  if command -v sqlite3 >/dev/null; then
    sudo sqlite3 "\$DB" ".backup '\$OUT.db'"
  else
    sudo cp "\$DB" "\$OUT.db"
  fi
  sudo cp "\$RELAY_DIR/.env" "\$OUT.env"
  sudo chmod 600 "\$OUT.env"
  sudo gzip -f "\$OUT.db"
  ls -1t "\$BACKUP_DIR"/relay-*.db.gz | tail -n +\$((KEEP+1)) | xargs -r sudo rm -f
  echo "backup written: \$OUT.db.gz"
  exit 0
fi

if [ "\$mode" = "restore" ]; then
  FILE="\${2:-\$(ls -1t "\$BACKUP_DIR"/relay-*.db.gz | head -1)}"
  [ -n "\$FILE" ] || { echo "no backup found in \$BACKUP_DIR"; exit 2; }
  echo "restoring \$FILE"
  sudo systemctl stop sureflow-relay
  sudo cp "\$DB" "\$DB.pre-restore" 2>/dev/null || true
  sudo gunzip -c "\$FILE" | sudo tee "\$DB" > /dev/null
  sudo systemctl start sureflow-relay
  sleep 4
  curl -s http://localhost:\${PORT:-3000}/api/pending
  echo "restore complete — queued sales above will upload on the next sync"
  exit 0
fi

echo "usage: sureflow-backup.sh [backup|restore <file.db.gz>]"
exit 2
`;