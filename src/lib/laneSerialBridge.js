// Lane serial bridge (Option A).
//
// USB-attached customer peripherals — the Ingenico iSC250 pinpad and USB pole
// displays — have no LAN address of their own, so the relay cannot open a socket
// to them. The bridge fixes that at the lane instead of at the relay: ser2net
// exposes each USB serial device as a TCP port on the lane's own IP, and the
// relay's existing net.Socket write lands on the device unchanged.
//
// Nothing in the relay or the POS changes. The register's pinpad_ip /
// pole_display_ip simply point at the LANE's LAN IP instead of a peripheral IP.

// Fixed TCP ports the bridge publishes on every lane. These match the ports the
// relay pinpad/pole modules already use, so no relay config changes either.
export const BRIDGE_PORTS = {
  pinpad: 12000,
  pole: 9101,
};

// Stable udev symlinks. USB serial devices come up as ttyUSB0/ttyUSB1 in
// enumeration order, which changes between boots and between hardware revisions —
// so the bridge is keyed on a symlink, never on the raw ttyUSB number.
export const BRIDGE_PACKAGES = ["ser2net", "udev", "usbutils", "setserial"];

export const BRIDGE_UDEV_RULES = `# /etc/udev/rules.d/60-sureflow-serial.rules
# Stable names for lane-attached USB serial peripherals. Replace the idVendor /
# idProduct pairs with the values 'lsusb' reports on the lane — the ones below are
# the common USB-serial bridge chips found inside these devices.

# Ingenico iSC250 (USB-CDC / ACM). Some firmware presents as ttyACM instead of ttyUSB.
SUBSYSTEM=="tty", ATTRS{idVendor}=="0b00", SYMLINK+="sureflow-pinpad", MODE="0660", GROUP="dialout"

# USB pole display (Prolific PL2303 / FTDI / CH341 inside the pole's USB port).
SUBSYSTEM=="tty", ATTRS{idVendor}=="067b", ATTRS{idProduct}=="2303", SYMLINK+="sureflow-pole", MODE="0660", GROUP="dialout"
SUBSYSTEM=="tty", ATTRS{idVendor}=="0403", SYMLINK+="sureflow-pole", MODE="0660", GROUP="dialout"
SUBSYSTEM=="tty", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", SYMLINK+="sureflow-pole", MODE="0660", GROUP="dialout"

# The Toshiba TCx 2x20 pole (0f66:4524) is deliberately ABSENT here — it is a
# HID-class device, not USB-serial, so no tty rule can ever match it. The Toshiba
# VSP driver (vsd, baked into the image) claims it and, with the baked Line Display
# assignment, presents a real pty at /dev/ttyS20 that translates IBM/ADX frames.
# The bridge unit's ExecStartPre points sureflow-pole at that node.
`;

// ser2net 4.x YAML. Each connection is raw TCP in, raw serial out — no telnet
// negotiation, because the relay writes binary frames (STX/ETX/LRC, ESC codes)
// that telnet IAC escaping would corrupt.
export const BRIDGE_SER2NET_CONFIG = `# /etc/ser2net.yaml
%YAML 1.1
---
define: &pinpaddev /dev/sureflow-pinpad
define: &poledev   /dev/sureflow-pole

# Ingenico iSC250 pinpad — the relay's pinpad module connects here.
connection: &pinpad
  accepter: tcp,${BRIDGE_PORTS.pinpad}
  enable: on
  options:
    kickolduser: true
    telnet-brk-on-sync: false
  connector: serialdev,*pinpaddev,115200n81,local,nobreak

# USB pole display — the relay's pole module connects here when the lane's pole
# profile uses the lane_serial_bridge transport.
connection: &pole
  accepter: tcp,${BRIDGE_PORTS.pole}
  enable: on
  options:
    kickolduser: true
  connector: serialdev,*poledev,9600n81,local,nobreak
`;

// ser2net must not die when a peripheral is unplugged or a lane boots with no pad
// fitted — Restart=always keeps the port available for whatever is plugged in next.
export const BRIDGE_SYSTEMD_UNIT = `# /etc/systemd/system/sureflow-serial-bridge.service
[Unit]
Description=SureFlow lane serial bridge (USB peripherals to TCP)
After=network-online.target vsd.service
Wants=network-online.target

[Service]
Type=simple
# Toshiba VSP branch: a Toshiba TCx USB pole is a HID device no udev tty rule can
# match, so vsd turns it into a real pty. The image's baked VSDConfig.xml assigns
# that pole to /dev/ttyS20 (the full path the VSP tool itself writes — a bare
# 'ttyVSP0' token leaves vsd with no pty and the pole dark), so point the pole
# symlink there. 9600 8N1 matches the pole connector line in ser2net.yaml.
#
# The WAIT LOOP is load-bearing, not defensive padding. After=vsd.service only
# orders service START — vsd forks, enumerates USB and creates the pty a moment
# later, so a bare [ -e /dev/ttyS20 ] test loses the race, exits 1, and the pole
# symlink is never made. ser2net then answers on 9101 but fails every write with
# "Device open failure", which looks exactly like a dead pole. Poll for up to 15s
# instead. The leading '-' still lets a lane with no Toshiba pole boot normally.
ExecStartPre=-/bin/sh -c 'for i in $(seq 1 30); do [ -e /dev/ttyS20 ] && break; sleep 0.5; done; [ -e /dev/ttyS20 ] || exit 0; ln -sf /dev/ttyS20 /dev/sureflow-pole; stty -F /dev/ttyS20 9600 cs8 -cstopb -parenb raw -echo'
ExecStart=/usr/sbin/ser2net -n -c /etc/ser2net.yaml
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

// Baked into the read-only diskless image at build time, inside the chroot.
export const BRIDGE_BUILD_STEPS = `# Run inside the diskless image chroot, in sureflow-build-image
DEBIAN_FRONTEND=noninteractive apt-get install -y ${BRIDGE_PACKAGES.join(" ")}

# Drop the udev rules, ser2net config and unit written above, then enable it.
systemctl enable sureflow-serial-bridge.service

# The kiosk user needs the serial group for local diagnostics (evtest, od -c).
usermod -aG dialout sureflow
`;

export const BRIDGE_VALIDATION_STEPS = [
  {
    step: "Confirm the device is a serial device",
    detail:
      "On the booted lane run lsusb and then ls -l /dev/serial/by-id/. A USB pinpad or pole that presents as a " +
      "serial device (ttyUSB* or ttyACM*) can be bridged directly. If it only appears under /dev/hidraw*, it is a " +
      "raw HID device that ser2net cannot bridge — the Toshiba TCx 2x20 pole is exactly this case, and the Toshiba " +
      "VSP driver (vsd) is what turns it into a serial tty the bridge can then publish.",
  },
  {
    step: "Verify the stable symlinks",
    detail:
      "ls -l /dev/sureflow-pinpad /dev/sureflow-pole. If a symlink is missing, take the idVendor/idProduct from " +
      "lsusb and correct 60-sureflow-serial.rules, then udevadm control --reload && udevadm trigger.",
  },
  {
    step: "Confirm the bridge is listening",
    detail:
      `systemctl status sureflow-serial-bridge and ss -lntp | grep -E '${BRIDGE_PORTS.pinpad}|${BRIDGE_PORTS.pole}'. ` +
      "Both ports must be bound on 0.0.0.0 so the relay can reach them across the lane VLAN.",
  },
  {
    step: "Point the register at the lane",
    detail:
      "On Registers → Pinpad / Pole Display set the IP to the LANE's own LAN IP (not a peripheral IP, not the " +
      "printer). The relay then opens lane_ip:port and the bridge hands the bytes to the USB device.",
  },
  {
    step: "Prove the path end to end",
    detail:
      "From the relay VM: printf '' | nc -w2 <lane_ip> " + BRIDGE_PORTS.pinpad + " must connect. Then run a test " +
      "prompt from the POS. Watch the lane with journalctl -u sureflow-serial-bridge -f to see the connection open.",
  },
  {
    step: "Check the baud rate",
    detail:
      "The pinpad runs 115200 8N1; most 2×20 poles run 9600 8N1. A wrong baud produces garbage on the display " +
      "rather than silence — if the pole shows random glyphs, correct the connector line in /etc/ser2net.yaml.",
  },
];