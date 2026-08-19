// Keeps the store's Local Relay VM service alive: a hardened systemd unit plus a
// watchdog timer that restarts the relay if it stops answering /status.
// Consumed by RelaySetupGuide through the shared SetupStepDetail renderer.

const HARDENED_UNIT = `# /etc/systemd/system/sureflow-relay.service
[Unit]
Description=SureFlow Local Relay
After=network-online.target
Wants=network-online.target
# Never let a crash loop put the service into a permanent 'failed' state.
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=/opt/sureflow-relay
EnvironmentFile=/opt/sureflow-relay/.env
ExecStart=/usr/bin/node server.js
# Restart on ANY exit, including a clean exit 0, after a short backoff.
Restart=always
RestartSec=3
# A wedged (running but unresponsive) process is killed rather than left hanging.
TimeoutStopSec=20
KillMode=mixed
# Survive an OOM sweep on a small VM — the relay is the store's sales path.
OOMPolicy=continue
OOMScoreAdjust=-500
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sureflow-relay

[Install]
WantedBy=multi-user.target
`;

const WATCHDOG_SCRIPT = `#!/bin/bash
# /usr/local/sbin/sureflow-relay-watchdog
# Restarts the relay if it is running but no longer answering HTTP. Restart=always
# only catches a process that EXITS — this catches one that is wedged.
set -u
PORT="\${PORT:-3000}"
URL="http://127.0.0.1:\${PORT}/status"

if curl -fsS --max-time 5 "\$URL" > /dev/null 2>&1; then
  exit 0
fi

logger -t sureflow-watchdog "relay did not answer \$URL — restarting service"
systemctl restart sureflow-relay
`;

const WATCHDOG_SERVICE = `# /etc/systemd/system/sureflow-relay-watchdog.service
# The job the timer runs. It has NO [Install] section and NO [Timer] section —
# a .service and a .timer are two separate files and must never be combined.
[Unit]
Description=SureFlow relay health watchdog
After=sureflow-relay.service

[Service]
Type=oneshot
EnvironmentFile=/opt/sureflow-relay/.env
ExecStart=/usr/local/sbin/sureflow-relay-watchdog
`;

const WATCHDOG_TIMER = `# /etc/systemd/system/sureflow-relay-watchdog.timer
# The schedule. Same base name as the .service above, which is how systemd pairs them.
[Unit]
Description=Run the SureFlow relay watchdog every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s
Unit=sureflow-relay-watchdog.service

[Install]
WantedBy=timers.target
`;

export const RELAY_SERVICE_HARDENING_STEP = {
  step_id: "relay_service_stability",
  label: "Troubleshooting — The relay stops on its own and needs a manual restart",
  instructions: [
    "SYMPTOM: the relay runs fine for a while, then the Command Center reports it unreachable and terminals lose the local catalog until you run systemctl restart sureflow-relay by hand.",
    "CAUSE 1 (most common) — systemd's start-limit tripped. The original unit has Restart=always but no RestartSec, so a process that crashes on startup restarts instantly, five times inside ten seconds, and systemd then refuses to try again and parks the unit in 'failed'. It stays dead until a human intervenes — exactly the behaviour you are seeing. The fix is RestartSec=3 plus StartLimitIntervalSec=0.",
    "CAUSE 2 — the process is being killed, not crashing. On a 2 GB VM the kernel OOM killer will pick node if better-sqlite3 has grown its cache or a large sync batch spiked memory. journalctl shows 'Killed process ... (node)' rather than a JavaScript stack.",
    "CAUSE 3 — an unhandled promise rejection. Node exits on an unhandled rejection, and a printer socket that errors after its request has already been answered is the usual source. The log shows a bare 'ERR_UNHANDLED_REJECTION' with no route context.",
    "CAUSE 4 — the process is alive but wedged: systemd still reports 'active (running)' while curl to /status times out. Restart=always cannot help here because nothing ever exits. The watchdog timer below covers this case.",
    "Run the diagnosis commands in order first — they tell you which of the four you have before you change anything.",
    "Then install the hardened unit, and add the watchdog timer if you saw cause 4.",
  ],
  commands: [
    "# --- DIAGNOSE ---",
    "systemctl status sureflow-relay --no-pager   # 'failed' + 'start request repeated too quickly' = CAUSE 1",
    "sudo journalctl -u sureflow-relay -n 80 --no-pager   # read the exit reason just before it went down",
    "sudo journalctl -u sureflow-relay --since '24 hours ago' | grep -Ei 'oom|killed|out of memory'   # CAUSE 2",
    "sudo journalctl -u sureflow-relay --since '24 hours ago' | grep -Ei 'unhandled|ERR_UNHANDLED'    # CAUSE 3",
    "systemctl show sureflow-relay -p NRestarts   # how many times it has bounced since boot",
    "# --- INSTALL THE HARDENED UNIT ---",
    "sudo cp /etc/systemd/system/sureflow-relay.service /root/sureflow-relay.service.bak",
    "sudo nano /etc/systemd/system/sureflow-relay.service   # replace with the unit below",
    "sudo systemctl daemon-reload && sudo systemctl restart sureflow-relay",
    "systemctl show sureflow-relay -p Restart -p RestartSec -p StartLimitIntervalSec   # confirm always / 3s / 0",
    "# --- OPTIONAL WATCHDOG (for a wedged process) ---",
    "# THREE separate files. Do not paste the .service and .timer into one file.",
    "sudo nano /usr/local/sbin/sureflow-relay-watchdog   # paste FILE 2 below, then Ctrl+O Enter Ctrl+X",
    "sudo chmod 755 /usr/local/sbin/sureflow-relay-watchdog",
    "sudo /usr/local/sbin/sureflow-relay-watchdog && echo 'script ok'   # must print 'script ok' before continuing",
    "sudo tee /etc/systemd/system/sureflow-relay-watchdog.service > /dev/null <<'EOF'\n[Unit]\nDescription=SureFlow relay health watchdog\nAfter=sureflow-relay.service\n\n[Service]\nType=oneshot\nEnvironmentFile=/opt/sureflow-relay/.env\nExecStart=/usr/local/sbin/sureflow-relay-watchdog\nEOF",
    "sudo tee /etc/systemd/system/sureflow-relay-watchdog.timer > /dev/null <<'EOF'\n[Unit]\nDescription=Run the SureFlow relay watchdog every minute\n\n[Timer]\nOnBootSec=2min\nOnUnitActiveSec=1min\nAccuracySec=10s\nUnit=sureflow-relay-watchdog.service\n\n[Install]\nWantedBy=timers.target\nEOF",
    "sudo systemd-analyze verify /etc/systemd/system/sureflow-relay-watchdog.timer   # silence = both units are valid",
    "sudo systemctl daemon-reload && sudo systemctl enable --now sureflow-relay-watchdog.timer",
    "systemctl list-timers sureflow-relay-watchdog --no-pager   # confirm it is scheduled",
  ],
  postInstructions: [
    "PROVE THE FIX: kill the relay and watch it come back on its own — sudo pkill -f 'node server.js' then sleep 5 && systemctl is-active sureflow-relay (expect 'active'). Repeat the kill five times quickly; with StartLimitIntervalSec=0 it must still recover instead of landing in 'failed'.",
    "CAUSE 2 confirmed (OOM): raise the VM to 4 GB in Proxmox, or cap node's heap by adding Environment=NODE_OPTIONS=--max-old-space-size=512 to the unit's [Service] section.",
    "CAUSE 3 confirmed (unhandled rejection): the hardened unit restarts it in 3 seconds so the store keeps selling, but capture the stack so it can be fixed properly — sudo journalctl -u sureflow-relay -n 100 --no-pager > /tmp/relay-crash.txt — and send me that file.",
    "Watchdog firing repeatedly (grep sureflow-watchdog in journalctl) means the process wedges rather than crashes — that is a real bug to chase, not something to leave the timer papering over.",
    "'Job failed. See journalctl -xe' when enabling the timer, and list-timers shows '0 timers listed' — the timer unit itself is invalid. Almost always the .service and .timer got pasted into ONE file: a file containing both [Service] and [Timer] is not a valid unit of either type. Use the two tee commands above (they write each file separately) and re-run: sudo systemctl daemon-reload && sudo systemctl enable --now sureflow-relay-watchdog.timer",
    "Diagnose an enable failure precisely with: sudo systemd-analyze verify /etc/systemd/system/sureflow-relay-watchdog.timer and sudo journalctl -u sureflow-relay-watchdog.timer -n 20 --no-pager",
    "'Failed to enable: Unit file is masked / No such file' — the filename is wrong. Both files must sit in /etc/systemd/system with the exact same base name: sureflow-relay-watchdog.service and sureflow-relay-watchdog.timer. Check with: ls -l /etc/systemd/system/sureflow-relay-watchdog.*",
    "The watchdog is optional. If the timer will not cooperate, skip it — the hardened unit alone fixes the failure you were actually hitting.",
    "Still dying with no message at all? Check the whole VM did not reboot: uptime and last reboot. A Proxmox host restart with 'Start at boot' unset on the VM looks identical to a relay crash from the portal's side.",
    "Keep an eye on it from the cloud: the relayHealthWatch backend function records unreachable relays, so the store card history shows whether the gaps have actually stopped after this change.",
  ],
  codeFiles: [
    { name: "sureflow-relay.service (hardened)", code: HARDENED_UNIT },
    { name: "sureflow-relay-watchdog (shell script)", code: WATCHDOG_SCRIPT },
    { name: "sureflow-relay-watchdog.service", code: WATCHDOG_SERVICE },
    { name: "sureflow-relay-watchdog.timer", code: WATCHDOG_TIMER },
  ],
};