// Assembles the relay repo's file set from this app's own module strings.
//
// Every .js entry below is already standalone CommonJS (require / module.exports) — the
// relay is not an ESM project and the box runs `node server.js` with no bundler — so
// publishing is a string-to-file extraction, not a rewrite. The BUILD stamps inside the
// modules are carried through untouched, which is what keeps /status honest about which
// build a store is running.

import { RELAY_SERVER_COMPLETE_CODE } from "@/lib/relayServerComplete";
import { RELAY_DB_CODE, RELAY_SYNC_CODE, RELAY_API_CODE } from "@/lib/relayServerPhase1";
import { RELAY_TELEMETRY_CODE } from "@/lib/relayTelemetry";
import { RELAY_AUTH_CODE, RELAY_SELF_UPDATE_SCRIPT, RELAY_BACKUP_SCRIPT } from "@/lib/relayOps";
import { RELAY_PRINTER_CODE } from "@/lib/relayPrinter";
import { RELAY_CHECK_READER_CODE } from "@/lib/relayCheckReader";
import { RELAY_PINPAD_CODE } from "@/lib/relayPinpad";
import { RELAY_POLE_CODE } from "@/lib/relayPoleDisplay";
import { RELAY_LANE_REBOOT_CODE } from "@/lib/relayLaneReboot";
import { RELAY_REPO_URL, RELAY_REPO_SSH, REPO_NAME } from "@/lib/relayRepoConfig";

// server.js requires exactly these, and a missing one kills the process on boot — the
// list is the deployment contract, so it is declared once and verified by the panel.
export const RELAY_MODULES = [
  { name: "server.js", code: RELAY_SERVER_COMPLETE_CODE, role: "Express app, mount order, boot" },
  { name: "api.js", code: RELAY_API_CODE, role: "POS routes: catalog, sales, print" },
  { name: "db.js", code: RELAY_DB_CODE, role: "SQLite catalog cache + offline outbox" },
  { name: "sync.js", code: RELAY_SYNC_CODE, role: "Cloud sync worker" },
  { name: "auth.js", code: RELAY_AUTH_CODE, role: "Relay token gate" },
  { name: "telemetry.js", code: RELAY_TELEMETRY_CODE, role: "Printer paper state + heartbeats" },
  { name: "printer.js", code: RELAY_PRINTER_CODE, role: "ESC/POS receipts + drawer kick" },
  { name: "checkReader.js", code: RELAY_CHECK_READER_CODE, role: "MICR read + endorsement" },
  { name: "pinpad.js", code: RELAY_PINPAD_CODE, role: "Ingenico customer pinpad" },
  { name: "poledisplay.js", code: RELAY_POLE_CODE, role: "Customer pole display" },
  { name: "laneReboot.js", code: RELAY_LANE_REBOOT_CODE, role: "Lane reboot queue" },
];

const PACKAGE_JSON = `{
  "name": "${REPO_NAME}",
  "version": "1.0.0",
  "private": true,
  "description": "SureFlow Local Relay - store controller application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "build": "./fetch-pos-dist.sh",
    "check": "node --check server.js"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.21.0"
  },
  "optionalDependencies": {
    "net-snmp": "^3.11.2"
  }
}
`;

// NO inline comments in the env file itself — a trailing "# ..." is parsed as part of
// the value and has already cost this fleet a NaN port and a broken indent. The
// explanations live in the README instead.
const ENV_EXAMPLE = `STORE_ID=
RELAY_API_KEY=
CLOUD_API_KEY=
CLOUD_SYNC_URL=
RELAY_ACCESS_TOKEN=
KIOSK_ACCESS_TOKEN=
PRINTER_IPS=
BIND_ADDRESS=
PORT=3000
LANE_MAINT_POLL_SECONDS=60
PRINTER_PORT=9100
RECEIPT_WIDTH=42
SLIP_WIDTH=40
SLIP_PAPER=4
ENDORSE_INDENT=6
PINPAD_PORT=12000
POLE_PORT=9100
POLE_BRIDGE_PORT=9101
POLE_IDLE_LINE_1=*** WELCOME ***
POLE_IDLE_LINE_2=
SNMP_COMMUNITY=public
DB_PATH=/srv/sureflow/relay/relay.db
BACKUP_DIR=/var/backups/sureflow
UPDATE_SOURCE=
`;

// Fetches the POS build into pos-dist so a store can serve the POS locally when the
// cloud is unreachable. A FETCH rather than committed build output: committing a built
// SPA on every publish would bloat the repo and make every diff unreadable.
//
// Missing or unreachable source is NOT fatal. The relay's express.static simply has
// nothing to serve and lanes keep booting the cloud POS, which is the normal path — a
// store must never fail to install because the fallback could not be downloaded.
const FETCH_POS_DIST = `#!/bin/bash
# fetch-pos-dist.sh — populate ./pos-dist with the POS build (local fallback).
# Run by 'npm run build', which the controller installer already calls.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HERE/pos-dist"
SRC="\${POS_DIST_URL:-}"

mkdir -p "$DEST"

if [ -z "$SRC" ]; then
  echo "pos-dist: POS_DIST_URL is not set — skipping the local POS fallback."
  echo "pos-dist: lanes will boot the cloud POS, which is the normal path."
  exit 0
fi

echo "pos-dist: fetching from $SRC"
TMP="$(mktemp -d)"
if ! curl -fsSL --max-time 180 "$SRC" -o "$TMP/pos-dist.tar.gz"; then
  echo "pos-dist: download FAILED — leaving the existing fallback in place." >&2
  rm -rf "$TMP"
  exit 0
fi

if tar tzf "$TMP/pos-dist.tar.gz" >/dev/null 2>&1; then
  rm -rf "$DEST"
  mkdir -p "$DEST"
  tar xzf "$TMP/pos-dist.tar.gz" -C "$DEST" --strip-components=1 2>/dev/null \\
    || tar xzf "$TMP/pos-dist.tar.gz" -C "$DEST"
  echo "pos-dist: installed $(find "$DEST" -type f | wc -l) files."
else
  echo "pos-dist: the download was not a gzipped tar — ignoring it." >&2
fi
rm -rf "$TMP"

if [ ! -f "$DEST/index.html" ]; then
  echo "pos-dist: no index.html present — the relay will report 'POS build not deployed'."
fi
exit 0
`;

const SYSTEMD_UNIT = `# sureflow-relay.service
# Reference copy. The controller installer writes its own unit pointing at the path it
# installed to; this is the hardened version to fall back on.
#
# StartLimitIntervalSec=0 is load-bearing: without it a process that crashes on startup
# restarts five times in ten seconds, systemd parks the unit in 'failed', and the store
# stays down until a human intervenes.
[Unit]
Description=SureFlow Local Relay
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=sureflow
WorkingDirectory=/srv/sureflow/relay
EnvironmentFile=/srv/sureflow/relay/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
TimeoutStopSec=20
KillMode=mixed
OOMPolicy=continue
OOMScoreAdjust=-500
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sureflow-relay

[Install]
WantedBy=multi-user.target
`;

const GITIGNORE = `node_modules/
pos-dist/
.env
relay.db
relay.db-wal
relay.db-shm
*.log
`;

// Lets the repo be pushed from a native WINDOWS box without corrupting the fleet.
// Git on Windows defaults to core.autocrlf=true, which would commit CRLF into the shell
// scripts — a controller then fails with "bad interpreter: /bin/bash^M" — and into the
// systemd unit and .env.example. eol=lf pins every text file to LF in the working tree
// as well as the index, so what a controller clones is byte-identical to a Linux push.
// The exec bit is not a line ending: Windows cannot store it, so it is pinned in the
// index instead (git update-index --chmod=+x, listed in the push steps).
const GITATTRIBUTES = `* text=auto eol=lf
*.sh text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.service text eol=lf
.env.example text eol=lf
*.png binary
*.gz binary
`;

const README = `# SureFlow Store Controller — Local Relay

The store-local relay the POS lanes talk to: receipt printing, cash drawer, cheque
station, pinpad, pole display, offline sales, and cloud sync.

## This repo is a deployment artifact, not the editing surface

The relay's source of truth is the **SureFlow admin app**. Relay code is authored there
and *published* into this repo, which is then tagged. Do not hand-edit files here — the
next publish overwrites them, and a technician reading the app's reference would be
reading something the fleet is not running.

Publish from: **Admin → Controller Updates → Relay Repo**.

## Install on a controller

Do not clone this by hand. The controller installer does it:

    tar xzf sureflow-controller-*.tar.gz
    cd sureflow-controller-*
    sudo ./install

The wizard clones this repo into /srv/sureflow/relay, runs npm install and npm run build,
writes .env, installs the systemd unit, and starts the relay.

## Private repo access from a store controller

The controller must clone with **no interactive auth**. Use a read-only deploy key:

    # on the controller, as root
    ssh-keygen -t ed25519 -C "sfc-<store>-a" -f /root/.ssh/id_ed25519 -N ""
    cat /root/.ssh/id_ed25519.pub

Add that public key to this repo under **Settings → Deploy keys** (read-only, one key per
controller so a single box can be revoked without touching the fleet), then confirm:

    ssh -T git@github.com
    git clone ${RELAY_REPO_SSH} /tmp/relay-clone-test

HTTPS clone URL (needs a PAT instead of a key): ${RELAY_REPO_URL}

## Releases

Stores are pinned to **tags**, never a moving branch — two stores updating on different
nights must land on identical code. Tags are named relay-MAJOR.MINOR.PATCH.

## Environment

Copy .env.example to .env and fill it in. The installer does this for you.

**Never put an inline comment in .env.** A trailing "# ..." is parsed as part of the
value; that is how this fleet got a NaN port and a broken endorsement indent.

| Variable | Purpose |
| --- | --- |
| STORE_ID | Store number this relay serves |
| RELAY_API_KEY / CLOUD_API_KEY | Per-store cloud sync key from the Relay Ops card |
| CLOUD_SYNC_URL | Cloud base URL for sync |
| RELAY_ACCESS_TOKEN | Gates the privileged routes; blank leaves them OPEN |
| KIOSK_ACCESS_TOKEN | Hands a cloud session to a booting lane at /kiosk |
| PRINTER_IPS | Comma-separated printer addresses; first is the default |
| BIND_ADDRESS | Backend-VLAN address (or VIP) the relay binds |
| PORT | 3000 |
| POS_DIST_URL | Optional. Tarball of the POS build for the local fallback |

## Files

${RELAY_MODULES.map((m) => `- \`${m.name}\` — ${m.role}`).join("\n")}
- \`fetch-pos-dist.sh\` — populates pos-dist for the local POS fallback
- \`sureflow-backup.sh\` / \`sureflow-selfupdate.sh\` — ops scripts on systemd timers
- \`sureflow-relay.service\` — reference hardened unit

## Health

    curl -s http://localhost:3000/status
    node --check server.js
    journalctl -u sureflow-relay -n 40 --no-pager

The store's relay_url in the Infrastructure Command Center must be the **backend**
address on port 3000 — a relay URL on the isolated PXE VLAN always reads as unreachable.
`;

/** Every file the repo contains, as tar entries. */
export function buildRepoFiles() {
  const entries = RELAY_MODULES.map((m) => ({ name: m.name, body: m.code }));
  return [
    ...entries,
    { name: "package.json", body: PACKAGE_JSON },
    { name: ".env.example", body: ENV_EXAMPLE },
    { name: ".gitignore", body: GITIGNORE },
    { name: ".gitattributes", body: GITATTRIBUTES },
    { name: "README.md", body: README },
    { name: "fetch-pos-dist.sh", body: FETCH_POS_DIST, mode: 0o755 },
    { name: "sureflow-backup.sh", body: RELAY_BACKUP_SCRIPT, mode: 0o755 },
    { name: "sureflow-selfupdate.sh", body: RELAY_SELF_UPDATE_SCRIPT, mode: 0o755 },
    { name: "sureflow-relay.service", body: SYSTEMD_UNIT },
  ];
}