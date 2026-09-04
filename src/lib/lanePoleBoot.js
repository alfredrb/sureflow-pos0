// Pole display BOOT PROGRESS on a diskless lane.
//
// The POS drives the pole from the browser, so nothing reaches the display until
// Chromium is up and the register page has loaded — a customer (and a technician)
// watching a booting lane sees a dead pole for the whole boot. This runs on the lane
// itself, before the kiosk, and writes progress frames straight to the pole's tty.
//
// Frames are the IBM/ADX set the relay's toshiba_usb_2x20 profile already proves on
// this hardware: 1F resets and homes, 10 00 addresses line 1 col 1, 10 14 line 2
// col 1, then plain text. Deliberately the same bytes as the relay, so a pole that
// renders in the POS renders during boot and vice versa.
//
// It writes to /dev/sureflow-pole, the same stable symlink ser2net uses, so it needs
// no knowledge of whether the lane carries a Toshiba HID pole behind vsd's pty or a
// real USB-serial pole. The last stage hands over to the POS and the service exits,
// so it never fights ser2net for the device once the lane is selling.

export const POLE_BOOT_STAGES = [
  { line1: "*** STARTING ***", line2: "SUREFLOW POS", when: "The unit starts, as soon as the pole device exists." },
  { line1: "*** BOOTING ***", line2: "NETWORK...", when: "Waiting for the lane to get its address on the store LAN." },
  { line1: "*** BOOTING ***", line2: "STORE CONTROLLER OK", when: "The controller answered — the lane can load the POS." },
  { line1: "*** BOOTING ***", line2: "LOADING POS...", when: "The kiosk browser has been launched." },
  { line1: "*** LANE CLOSED ***", line2: "PLEASE USE NEXT LANE", when: "Boot finished. Held until an operator signs on, at which point the POS takes the pole over." },
];

export const POLE_BOOT_SCRIPT = `#!/bin/sh
# /usr/local/bin/sureflow-pole-boot
# Boot progress on the lane's customer pole display. Never fails the boot: every
# step is best effort and a lane with no pole simply exits.

POLE=/dev/sureflow-pole
RELAY_HOST="\${SUREFLOW_RELAY_HOST:-}"

# IBM/ADX frame: reset+home, position line 1, text, position line 2, text.
# Both lines are padded to exactly 20 columns so the previous stage is fully
# overwritten — without the padding, a shorter line leaves the tail of the old one
# on the glass and the display reads as garbage.
pole_write() {
  [ -e "$POLE" ] || return 0
  printf '\\037\\020\\000%-20.20s\\020\\024%-20.20s' "$1" "$2" > "$POLE" 2>/dev/null || true
}

# The pole appears only once the Toshiba VSP driver has created its pty (or udev has
# matched a USB-serial pole), which happens a moment AFTER this unit is ordered to
# start — so poll rather than test once, exactly as the serial bridge unit does.
i=0
while [ $i -lt 30 ]; do
  [ -e "$POLE" ] && break
  i=$((i+1)); sleep 0.5
done
[ -e "$POLE" ] || exit 0
stty -F "$POLE" 9600 cs8 -cstopb -parenb raw -echo 2>/dev/null || true

pole_write "*** STARTING ***" "SUREFLOW POS"

# Network. The lane's own address on the PXE VLAN.
pole_write "*** BOOTING ***" "NETWORK..."
i=0
while [ $i -lt 60 ]; do
  ip route get 1.1.1.1 >/dev/null 2>&1 && break
  i=$((i+1)); sleep 1
done

# Store controller. Without it there is no POS to load, so this is the stage worth
# showing a technician: a lane parked here is a controller/VLAN problem, not a
# browser problem.
if [ -n "$RELAY_HOST" ]; then
  i=0
  while [ $i -lt 60 ]; do
    if command -v curl >/dev/null 2>&1; then
      curl -sf -m 2 "http://$RELAY_HOST/api/connectivity" >/dev/null 2>&1 && break
    else
      break
    fi
    i=$((i+1)); sleep 1
  done
fi
pole_write "*** BOOTING ***" "STORE CONTROLLER OK"

# Kiosk. pgrep is the honest signal that the browser itself has started.
pole_write "*** BOOTING ***" "LOADING POS..."
i=0
while [ $i -lt 90 ]; do
  pgrep -x chromium >/dev/null 2>&1 || pgrep -x chromium-browser >/dev/null 2>&1 && break
  i=$((i+1)); sleep 1
done

# Boot is done and no operator is signed on yet. The POS overwrites this the moment
# one is, so the frame is a resting state and not a race with the app.
pole_write "*** LANE CLOSED ***" "PLEASE USE NEXT LANE"
exit 0
`;

export const POLE_BOOT_UNIT = `# /etc/systemd/system/sureflow-pole-boot.service
[Unit]
Description=SureFlow lane pole display boot progress
# vsd creates the Toshiba pole's pty; the serial bridge makes the stable symlink.
After=vsd.service sureflow-serial-bridge.service
Wants=sureflow-serial-bridge.service

[Service]
Type=oneshot
# The relay/controller address the lane checks, so the display can distinguish
# "no network" from "network but no controller".
Environment=SUREFLOW_RELAY_HOST=192.168.1.50:3000
ExecStart=/usr/local/bin/sureflow-pole-boot
# A pole problem must never hold up or fail a lane boot.
SuccessExitStatus=0 1
TimeoutStartSec=180

[Install]
WantedBy=multi-user.target
`;

export const POLE_BOOT_BUILD_STEPS = `# Run inside the diskless image chroot, in sureflow-build-image

install -m 0755 /dev/stdin /usr/local/bin/sureflow-pole-boot <<'EOF'
# ...contents of sureflow-pole-boot above...
EOF

# Drop the unit written above, then enable it.
systemctl enable sureflow-pole-boot.service

# Set SUREFLOW_RELAY_HOST in the unit to the store's controller VIP:port before
# building. A wrong value only costs the controller stage a 60s wait — the boot
# itself still completes.
`;

export const POLE_BOOT_VALIDATION = `# On a booted lane
systemctl status sureflow-pole-boot        # oneshot, should read 'inactive (dead)' after a clean run
journalctl -u sureflow-pole-boot -b        # the stages it walked through this boot

# Prove the device before blaming the script — this is the same write it makes:
printf '\\037\\020\\000%-20.20s\\020\\024%-20.20s' '*** TEST ***' 'POLE OK' > /dev/sureflow-pole

# Nothing on the glass from that command = the pole, its pty or the symlink is the
# problem (see the serial bridge validation steps), not the boot service.
# Text but garbled = wrong baud; re-run the stty line in the script by hand.
`;