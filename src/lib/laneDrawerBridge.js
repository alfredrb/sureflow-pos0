// Lane USB cash drawer bridge — RESERVED.
//
// A native USB cash drawer plugs into the lane terminal and has no LAN address,
// so the relay cannot open a socket to it. Same problem the USB printer, USB pole
// and USB pinpad already have, and the same fix: publish the drawer's character
// device as a TCP port on the lane's own IP, and the relay's existing net.Socket
// write lands on the drawer unchanged.
//
// This module is DOCUMENTED AND GENERATED BUT NOT BAKED INTO THE DEFAULT IMAGE.
// The fleet runs SDL drawers on the printer's DK port; there is no reason to ship
// a service for hardware no lane has. When a USB drawer is actually deployed:
// enable it on the register, then add these steps to the next image build.
//
// Two device shapes exist and the bridge command differs between them:
//   serial (ttyUSB*/ttyACM*) — socat straight to the character device, like the
//     printer bridge. This is the easy case.
//   hidraw — a raw HID drawer has no tty. socat CAN open /dev/hidraw* but the
//     drawer must accept its open command as a plain output report; if it needs a
//     report ID prefix, that byte belongs in the model's HardwareLibrary profile,
//     not in this bridge.

import { DRAWER_BRIDGE_PORT } from "@/lib/drawerProfiles";

export { DRAWER_BRIDGE_PORT };

export const DRAWER_BRIDGE_PACKAGES = ["socat", "usbutils"];

export const DRAWER_BRIDGE_UDEV_RULES = `# /etc/udev/rules.d/62-sureflow-drawer.rules
# Stable name for the lane's USB cash drawer. Replace idVendor/idProduct with the
# values 'lsusb' reports on the lane — the pairs below are placeholders, because
# no USB drawer is deployed in the fleet yet.
#
# Serial-style drawer (shows up as ttyUSB* or ttyACM*):
SUBSYSTEM=="tty", ATTRS{idVendor}=="0000", ATTRS{idProduct}=="0000", SYMLINK+="sureflow-drawer", MODE="0660", GROUP="dialout"

# Raw HID drawer (shows up only under /dev/hidraw*). The group must match the
# group socat runs as, or the bridge starts and every write fails with EACCES.
KERNEL=="hidraw*", ATTRS{idVendor}=="0000", ATTRS{idProduct}=="0000", SYMLINK+="sureflow-drawer", MODE="0660", GROUP="plugdev"
`;

// Bidirectional by default like the printer bridge. A drawer kick needs no reply,
// but a drawer-status read (open/closed sense line, on models that expose one)
// does — and one-way plumbing that "works" until status is added is a trap.
export const DRAWER_BRIDGE_SOCAT_COMMAND =
  `/usr/bin/socat -d -d TCP-LISTEN:${DRAWER_BRIDGE_PORT},reuseaddr,fork,keepalive ` +
  `OPEN:/dev/sureflow-drawer,nonblock,raw,echo=0`;

export const DRAWER_BRIDGE_SYSTEMD_UNIT = `# /etc/systemd/system/sureflow-drawer-bridge.service
# RESERVED — do not enable on a lane whose drawer is on the printer's DK port.
# Publishes the lane's USB cash drawer on tcp/${DRAWER_BRIDGE_PORT} so the relay reaches it at
# the LANE's IP. Restart=always keeps the port available across drawer swaps.
[Unit]
Description=SureFlow lane USB cash drawer bridge (USB drawer to TCP ${DRAWER_BRIDGE_PORT})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${DRAWER_BRIDGE_SOCAT_COMMAND}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

export const DRAWER_BRIDGE_BUILD_STEPS = `# RESERVED — only run these once a USB drawer is actually fitted to a lane.
# Run inside the diskless image chroot, in sureflow-build-image.
DEBIAN_FRONTEND=noninteractive apt-get install -y ${DRAWER_BRIDGE_PACKAGES.join(" ")}

# Drop 62-sureflow-drawer.rules and the unit written above, then enable it.
systemctl enable sureflow-drawer-bridge.service

# The kiosk user needs the device's group for local diagnostics.
usermod -aG dialout,plugdev sureflow
`;

export const DRAWER_BRIDGE_VALIDATION_STEPS = [
  {
    step: "Establish which kind of USB drawer this is",
    detail:
      "On the booted lane run lsusb, then ls -l /dev/serial/by-id/ and ls -l /dev/hidraw*. A drawer that presents a " +
      "tty is the simple case. A drawer that appears only as hidraw needs its open command sent as an output report — " +
      "confirm that before ordering a fleet's worth of them.",
  },
  {
    step: "Fix the udev rule to the real IDs",
    detail:
      "62-sureflow-drawer.rules ships with 0000:0000 placeholders on purpose. Put the real idVendor/idProduct in, then " +
      "udevadm control --reload && udevadm trigger, and confirm /dev/sureflow-drawer exists.",
  },
  {
    step: "Open the drawer straight at the device first",
    detail:
      "printf '\\x1b\\x70\\x00\\x19\\xfa' | sudo tee /dev/sureflow-drawer > /dev/null. If the drawer pops, the USB path " +
      "is good and this model accepts the standard ESC p pulse. If it does not, the model needs its own open command — " +
      "record it in the drawer's HardwareLibrary profile, not in code.",
  },
  {
    step: "Confirm the bridge is listening",
    detail:
      `systemctl status sureflow-drawer-bridge and ss -lntp | grep ${DRAWER_BRIDGE_PORT}. The port must be bound on ` +
      "0.0.0.0 so the relay can reach it across the lane VLAN.",
  },
  {
    step: "Point the register at the lane",
    detail:
      "On Registers → Cash Drawer Connection choose 'USB drawer — direct at the lane' and leave Drawer Bridge IP blank " +
      `so it defaults to the lane's own IP, or set it explicitly. The port stays ${DRAWER_BRIDGE_PORT}.`,
  },
  {
    step: "Prove the kick through the relay, then prove the fallback",
    detail:
      "Fire a No Sale from the POS — the drawer must pop through the relay. Then set the transport back to Printer DK " +
      "and confirm the SDL drawer still pops, so a single lane can be rolled back without touching any other register.",
  },
];