// Per-lane persistent browser profile.
//
// THE PROBLEM THIS SOLVES: the POS is a cloud app behind the platform login, and a lane is
// unattended hardware. The lane root is read-only NFS with a tmpfs /home/sureflow, so
// Chromium's whole profile — cookies and the platform session with it — was discarded at
// every power-off and the lane came back to the platform login screen instead of the POS.
//
// So one directory, and only one, is made persistent: Chromium's profile, kept on the
// controller's existing writable overlay export under this lane's hostname. A technician
// signs the lane in ONCE at install and it stays signed in across reboots. Everything else
// about the lane stays stateless, which is the diskless resilience property worth keeping.
//
// Deliberately NOT the whole home directory: ~/.Xauthority and Chromium's crash state must
// stay throwaway, or a lane that died mid-session comes back with a poisoned profile and
// no way to clear it from the read-only root.

export const LANE_STATE_EXPORT = "/srv/sureflow/overlay";
export const LANE_STATE_MOUNT = "/mnt/lane-state";

export const LANE_PROFILE_SCRIPT = `#!/bin/bash
# /usr/local/bin/sureflow-lane-profile (inside the lane image)
# Mounts this lane's persistent Chromium profile over the tmpfs home before the kiosk
# starts. Best effort by design: a lane that cannot reach the state export still opens the
# POS, it just asks for the platform login again — a stateless lane beats a dead lane.
set -uo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

PROFILE_DIR=/home/sureflow/.config/chromium
MOUNT=${LANE_STATE_MOUNT}
EXPORT_PATH=${LANE_STATE_EXPORT}

# The state server is the box already serving this lane's root — read it off the kernel
# command line rather than guessing, and fall back to the default gateway (the controller
# is both on the PXE VLAN).
SRV=\$(sed -n 's/.*nfsroot=\\([0-9.]*\\):.*/\\1/p' /proc/cmdline | head -1)
[ -n "\$SRV" ] || SRV=\$(ip -o -4 route show default | awk '{print \$3; exit}')
[ -n "\$SRV" ] || { echo "No state server found — running with a throwaway profile."; exit 0; }

LANE=\$(hostname)

install -d -m 755 "\$MOUNT"
if ! mountpoint -q "\$MOUNT"; then
  # soft + a short timeo so a controller that is down costs seconds, not a hung boot.
  mount -t nfs -o rw,nolock,soft,timeo=50,retrans=2 "\$SRV:\$EXPORT_PATH" "\$MOUNT" 2>/dev/null || {
    echo "Could not mount \$SRV:\$EXPORT_PATH — running with a throwaway profile."; exit 0; }
fi

mkdir -p "\$MOUNT/\$LANE/chromium" 2>/dev/null || {
  echo "State export is not writable — running with a throwaway profile."; exit 0; }
chown -R sureflow:sureflow "\$MOUNT/\$LANE" 2>/dev/null || true

install -d -o sureflow -g sureflow -m 755 /home/sureflow/.config "\$PROFILE_DIR"
mount --bind "\$MOUNT/\$LANE/chromium" "\$PROFILE_DIR" || {
  echo "Bind mount failed — running with a throwaway profile."; exit 0; }

# A profile left behind by a lane that lost power mid-session makes Chromium open a
# restore prompt on a screen nobody is standing at. Clear just those markers.
rm -f "\$PROFILE_DIR/SingletonLock" "\$PROFILE_DIR/SingletonCookie" "\$PROFILE_DIR/SingletonSocket" 2>/dev/null
echo "Persistent profile mounted from \$SRV:\$EXPORT_PATH/\$LANE/chromium"
exit 0
`;

export const LANE_PROFILE_UNIT = `# /etc/systemd/system/sureflow-lane-profile.service
# Runs BEFORE the kiosk so Chromium starts on the persistent profile. Never Requires= from
# the kiosk unit: a lane with no reachable state export must still open the POS.
[Unit]
Description=SureFlow lane persistent browser profile
After=network-online.target
Wants=network-online.target
Before=sureflow-kiosk.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/sureflow-lane-profile

[Install]
WantedBy=multi-user.target
`;

export const LANE_PROFILE_NOTES = [
  "A lane keeps its platform login across reboots because Chromium's profile is bind-mounted from the controller's writable overlay export, under the lane's own hostname. Sign the lane in once at install and it stays signed in.",
  "Only the browser profile is persistent. The rest of the lane — /tmp, /var/log, the Xorg auth file — stays tmpfs and is discarded at power-off, so the diskless property still holds and a corrupted session cannot survive a reboot.",
  "Best effort on purpose: if the state export is unreachable the lane still boots the POS, it just asks for the platform login again. A missing profile must never be the reason a lane is dead.",
  "Per-lane directories mean two lanes never share a session, so a signed-in lane cannot be impersonated by re-imaging another terminal on the same VLAN.",
  "To force a lane back to a clean session, remove /srv/sureflow/overlay/<hostname>/chromium on the controller and reboot the lane.",
];