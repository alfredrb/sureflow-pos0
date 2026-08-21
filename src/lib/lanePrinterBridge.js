// Lane USB printer bridge — single-cable lane (lab prototype).
//
// The Epson TM-H6000IV with a UB-U06 USB interface board has no LAN address on
// that interface, so the relay cannot open a socket to it. socat fixes that at the
// lane: it publishes the USB printer device as TCP 9100 on the lane's own IP, and
// the relay's existing net.Socket write lands on the printer unchanged.
//
// Nothing in the relay or the POS changes — the relay already targets
// printer_ip:9100. Only the register's printer_ip value changes to the LANE's IP.
//
// CRITICAL: socat must stay BIDIRECTIONAL (its default). ESC/POS realtime status
// queries (DLE EOT) and the cheque-station MICR read both need the printer's reply
// to travel back up the same socket. A one-way pipe would print fine and then
// silently break paper status and cheque reading.

// Fixed TCP port. 9100 is what the relay already uses for printing, so a bridged
// lane needs no relay configuration at all.
export const PRINTER_BRIDGE_PORT = 9100;

// socat + the usblp kernel module (which creates /dev/usb/lp0). usblp is
// blacklisted in some minimal Debian roots, so the image build forces it on.
export const PRINTER_BRIDGE_PACKAGES = ["socat", "usbutils"];

export const PRINTER_BRIDGE_UDEV_RULES = `# /etc/udev/rules.d/61-sureflow-printer.rules
# Stable name for the lane's USB receipt printer. /dev/usb/lp0 is assigned in
# enumeration order, so a lane with any other USB printer-class device could take
# lp0 instead — the bridge is keyed on this symlink, never on the lp number.
#
# 04b8 is Epson. Confirm idProduct with 'lsusb' on the lane; the UB-U06 in a
# TM-H6000IV commonly reports 0202, but it varies by firmware revision.
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", ATTRS{bInterfaceClass}=="07", SYMLINK+="sureflow-printer", MODE="0660", GROUP="lp"

# usblp binds printer-class interfaces and exposes them as /dev/usb/lp*.
SUBSYSTEM=="usbmisc", KERNEL=="lp[0-9]*", SYMLINK+="sureflow-printer", MODE="0660", GROUP="lp"
`;

// socat: raw TCP in, raw character device out, both directions.
//   reuseaddr  — the port rebinds immediately after a relay socket closes
//   fork       — each relay connection gets its own child, so a hung socket
//                cannot wedge the lane's printing for the rest of the shift
//   nonblock,raw,echo=0 — no line discipline, no echo: ESC/POS is binary and any
//                cooked-mode translation (CR/LF, ^Z) corrupts receipts
export const PRINTER_BRIDGE_SOCAT_COMMAND =
  `/usr/bin/socat -d -d TCP-LISTEN:${PRINTER_BRIDGE_PORT},reuseaddr,fork,keepalive ` +
  `OPEN:/dev/sureflow-printer,nonblock,raw,echo=0`;

export const PRINTER_BRIDGE_SYSTEMD_UNIT = `# /etc/systemd/system/sureflow-printer-bridge.service
# Publishes the lane's USB printer on tcp/${PRINTER_BRIDGE_PORT} so the relay reaches it at the
# LANE's IP. Restart=always keeps the port available when the printer is powered
# off, unplugged, or swapped mid-shift.
[Unit]
Description=SureFlow lane USB printer bridge (USB printer to TCP ${PRINTER_BRIDGE_PORT})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${PRINTER_BRIDGE_SOCAT_COMMAND}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

export const PRINTER_BRIDGE_BUILD_STEPS = `# Run inside the diskless image chroot, in sureflow-build-image
DEBIAN_FRONTEND=noninteractive apt-get install -y ${PRINTER_BRIDGE_PACKAGES.join(" ")}

# usblp creates /dev/usb/lp0 for the UB-U06. Minimal roots blacklist it in favour
# of CUPS' libusb backend, so force it back on — without this there is no device
# for socat to open and the bridge restarts forever.
echo usblp > /etc/modules-load.d/sureflow-usblp.conf
rm -f /etc/modprobe.d/*usblp*blacklist* 2>/dev/null || true

# Drop 61-sureflow-printer.rules and the unit written above, then enable it.
systemctl enable sureflow-printer-bridge.service

# The kiosk user needs the lp group for local diagnostics (cat > /dev/sureflow-printer).
usermod -aG lp sureflow
`;

export const PRINTER_BRIDGE_VALIDATION_STEPS = [
  {
    step: "Confirm the USB board is seen",
    detail:
      "On the booted lane run lsusb — the printer must appear as an Epson device (idVendor 04b8). If it does not, " +
      "the UB-U06 is not seated in the expansion slot or the printer is powered off. Note the idProduct and correct " +
      "61-sureflow-printer.rules if it differs from the rule.",
  },
  {
    step: "Confirm the character device exists",
    detail:
      "ls -l /dev/usb/lp0 /dev/sureflow-printer. No lp0 means usblp did not bind — check lsmod | grep usblp and that " +
      "nothing else (CUPS' libusb backend) has claimed the interface.",
  },
  {
    step: "Print straight at the device, before involving the bridge",
    detail:
      "printf 'BRIDGE TEST\\n\\n\\n' | sudo tee /dev/sureflow-printer > /dev/null. Paper moves = the USB path is good " +
      "and any remaining fault is the bridge or the network, which halves the search space.",
  },
  {
    step: "Confirm the bridge is listening",
    detail:
      `systemctl status sureflow-printer-bridge and ss -lntp | grep ${PRINTER_BRIDGE_PORT}. The port must be bound on ` +
      "0.0.0.0 so the relay can reach it across the lane VLAN — a bridge bound to 127.0.0.1 is invisible to the relay.",
  },
  {
    step: "Point the register at the lane",
    detail:
      "On Registers → Printer Transport choose 'USB — bridged at the lane' and set Printer IP to the LANE's own LAN IP. " +
      "Leave the printer's embedded Ethernet IP in the Fallback field so it can be flipped back instantly.",
  },
  {
    step: "Prove printing and the drawer kick through the relay",
    detail:
      "Use the register's Test Print button. A receipt plus a drawer kick proves the whole path: the drawer kick is " +
      "ESC p, handled by the printer's own controller, so it is transport-agnostic and needs no bridge-specific work.",
  },
  {
    step: "Prove the RETURN direction — this is the one that catches a bad bridge",
    detail:
      "Paper status uses an ESC/POS realtime query (DLE EOT) and only works if the printer's reply travels back up the " +
      "socket. From the relay VM: printf '\\x10\\x04\\x01' | nc -w2 <lane_ip> " + PRINTER_BRIDGE_PORT + " | od -c — one " +
      "status byte must come back. Silence means socat is not bidirectional (or the device opened read-only), and the " +
      "Infrastructure Command Center will show the printer as unreachable even though receipts print fine.",
  },
  {
    step: "Prove the cheque station still reads",
    detail:
      "The MICR read holds the socket open for the printer's E-13B response, so it exercises the same return path as " +
      "paper status. Take a cheque tender on the lane — if printing works but MICR times out, suspect the return " +
      "direction, not the cheque module.",
  },
  {
    step: "Prove the Ethernet fallback is live at the same time",
    detail:
      "With the bridge running, print from the relay to the printer's OWN Ethernet IP. Both interfaces are served " +
      "concurrently by the printer, so both must work — that concurrency is what makes the config-flip recovery real.",
  },
];

// The three lane bridges share one uplink cable. Documented together so a
// technician sees the whole port map at a glance.
export const LANE_BRIDGE_PORT_MAP = [
  { port: 9100, device: "USB receipt printer (UB-U06)", service: "sureflow-printer-bridge", transport: "socat" },
  { port: 9101, device: "USB pole display", service: "sureflow-serial-bridge", transport: "ser2net" },
  { port: 12000, device: "USB pinpad (Ingenico iSC250)", service: "sureflow-serial-bridge", transport: "ser2net" },
];