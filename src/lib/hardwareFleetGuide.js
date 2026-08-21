// Fleet hardware guide — the physical build sheet for a SureFlow lane: which
// terminal generations exist, how each peripheral attaches, and how the POS
// reaches it. Rendered by HardwareFleetGuide via the shared SetupStepDetail.
//
// Design rule this guide encodes: the terminal is stateless. Every peripheral is
// reached either through the store relay (network printer) or through a stable
// /dev symlink created by a udev rule from the Hardware Driver Library. Nothing
// is configured on the terminal itself.

const POLE_SERIAL_RULES = `# /etc/udev/rules.d/72-sureflow-pole-serial.rules
# IBM 2x20 VFD pole on the SurePOS powered-serial block. The connector is RJ45 but
# the channel is IBM powered RS-485 (differential, half duplex) — it is NOT Ethernet
# and NOT RS-232. Do not patch it into a switch: the power pins will damage the port.
SUBSYSTEM=="tty", KERNEL=="ttyS0", SYMLINK+="sureflow-linedisplay", MODE="0660", GROUP="dialout"

# --- init (once at boot) ---
# /usr/local/bin/sureflow-linedisplay-init
#   RS-485 is half duplex: the driver must not echo, and nothing else may share the
#   bus while the POS is writing. crtscts OFF — there are no hardware flow lines.
#   stty -F /dev/sureflow-linedisplay 9600 cs8 -cstopb -parenb -crtscts raw -echo
`;

const POLE_USB_RULES = `# /etc/udev/rules.d/72-sureflow-pole-usb.rules
# Toshiba pole on the 24V powered-USB block. It enumerates as a USB-CDC serial
# device (ttyACM*), so it lands on the SAME symlink as the legacy serial pole and
# the POS code path is identical. Replace the IDs with the values lsusb reports.
SUBSYSTEM=="tty", ATTRS{idVendor}=="0fce", ATTRS{idProduct}=="a001", \\
  SYMLINK+="sureflow-linedisplay", MODE="0660", GROUP="dialout"

# Fallback while identifying a new pole: claim the first CDC device.
# SUBSYSTEM=="tty", KERNEL=="ttyACM0", SYMLINK+="sureflow-linedisplay", MODE="0660", GROUP="dialout"
`;

const CHROMIUM_SERIAL_POLICY = `// /etc/chromium/policies/managed/sureflow-serial.json  (inside the NFS image)
// The POS is a web app, so it drives the pole through Chromium's Web Serial API.
// In kiosk mode there is nobody to answer a device-permission prompt, so the
// relay origin is pre-granted here. Without this file navigator.serial resolves
// to an empty port list and the pole stays dark with no visible error.
{
  "SerialAllowAllDevicesForUrls": ["http://10.0.40.10:3000/*"],
  "DefaultSerialGuardSetting": 3
}
`;

// Vendor service documentation for the fleet. Kept here so a technician chasing a
// port, connector or quirk has the authoritative manual to hand instead of
// somebody's recollection of it.
export const HARDWARE_DOC_REFERENCES = [
  {
    label: "IBM SurePOS 700 Series — Hardware Service Guide (SA27-4329-04, 2007)",
    covers: "746/786 board layout, powered-serial and powered-USB blocks, FRU removal, POST and error codes.",
    url: "https://sharktastica.co.uk/resources/docs/pdf/IBM_SA27-4329-04_SurePOS-700x_2007_IBM.pdf",
  },
  {
    label: "IBM 4900-7x3/x84 — Service Guide (1R1003844, 2014)",
    covers: "Later IBM-branded 4900 terminal generation — cabling, powered ports and serviceable parts.",
    url: "https://sharktastica.co.uk/resources/docs/pdf/IBM_1R1003844-7x3-x84_4900-7x3-x84-v69_2014_dokumen-tips.pdf",
  },
  {
    label: "Toshiba 4900-xx5 — Service Guide (1R1003844-xx5, 2014)",
    covers: "Post-acquisition Toshiba 4900 revision. Use this for the Toshiba-badged units and the 24V powered-USB pole.",
    url: "https://sharktastica.co.uk/resources/docs/pdf/Toshiba_1R1003844-xx5_4900-xx5_2014_manualzz.pdf",
  },
  {
    label: "IBM SurePOS 700 Series — user manual mirror",
    covers: "Operator-level reference for the same terminal family.",
    url: "https://www.manualslib.com/manual/1923709/Ibm-Surepos-700-Series.html",
  },
  {
    label: "IBM 4800-C41 — manual",
    covers: "Compact terminal variant occasionally found in older lanes.",
    url: "https://www.manualslib.com/manual/377421/Ibm-4800-C41.html",
  },
];

export const HARDWARE_FLEET_STEPS = [
  {
    step_id: "hw_terminals",
    label: "Terminals — SurePOS 746 and 786",
    instructions: [
      "Two terminal generations run the same read-only NFS image; the register's boot_profile decides which one it mounts. Nothing about a lane's identity lives on the terminal.",
      "746 (legacy profile): VGA output, no reliable KMS. Needs nomodeset and the fbdev X driver, plus i8042.nomux=1 or the keyboard controller drops the internal MSR wedge.",
      "786 (modern profile): DisplayPort with working Intel modesetting — the i915 driver and no video boot args.",
      "Both keep the IBM powered-serial block (9A/9B/4A/5A) and the 24V powered-USB block, so either pole generation physically fits either terminal.",
      "Displays stay IBM SurePoint on both generations — the panel is USB touch and is calibrated once per panel revision, never per terminal.",
    ],
    commands: [
      "# Confirm which video path a lane actually took\nglxinfo -B 2>/dev/null | head -5; cat /proc/cmdline",
      "# 746 only — verify the MSR wedge survived the keyboard controller\nsudo dmesg | grep -i i8042",
    ],
  },
  {
    step_id: "hw_keyboard",
    label: "Keyboard — IBM 3AA01194300 (USB HID via monitor hub)",
    instructions: [
      "The POS keyboard reaches the terminal as a plain USB HID device through the SurePoint monitor's built-in hub — not the legacy PS/2 wedge.",
      "Its non-standard scancodes are remapped at the Debian hwdb layer, never in the kernel: the Action Code key becomes F9 and Ctrl+Action Code becomes F10.",
      "F9 opens the Action Code dialog; F10 fires the silent robbery alarm, so the F10 mapping must never be reassigned.",
      "Action codes are dispatched from an app-side numeric buffer, so every code also works from the on-screen trigger button — a lane with a dead keyboard still functions on touch alone.",
    ],
    commands: [
      "# Identify the keyboard and watch raw scancodes\nlsusb | grep -i ibm\nsudo evtest   # press the Action Code key and note the code",
      "# Apply the hwdb map generated per register on the Registers page\nsudo systemd-hwdb update && sudo udevadm trigger",
    ],
  },
  {
    step_id: "hw_pole_ibm",
    label: "Pole display A — IBM 2x20 VFD (RJ45 powered RS-485)",
    instructions: [
      "The RJ45 jack on this pole carries IBM powered RS-485, not Ethernet and not RS-232. Never patch it into a network switch — the power pins will damage the switch port.",
      "RS-485 is a differential, half-duplex bus, so three things matter: the pole is write-only from the POS (nothing is read back), the port must run with no hardware flow control and no echo, and only one device may sit on the bus per lane. A second device on the same run garbles both.",
      "Because it is half duplex, a failed write is silent — there is no reply to check. Always prove the pole with the shell write below before blaming the POS.",
      "It talks 9600 8N1 with the standard 2x20 VFD escape sequences, so no kernel driver is needed beyond 8250 — the RS-485 transceiver is in the terminal's powered-serial block and needs no configuration.",
      "The udev rule below lands it on /dev/sureflow-linedisplay — the single device node the POS writes to regardless of pole generation.",
      "Fits both the 746 and the 786, since both keep the powered-serial block.",
    ],
    commands: [
      "sudo stty -F /dev/sureflow-linedisplay 9600 cs8 -cstopb -parenb -crtscts raw -echo",
      "# Prove the pole is alive before involving the POS\nprintf 'SUREFLOW POLE OK' | sudo tee /dev/sureflow-linedisplay",
    ],
    codeFiles: [{ name: "72-sureflow-pole-serial.rules", code: POLE_SERIAL_RULES }],
  },
  {
    step_id: "hw_pole_toshiba",
    label: "Pole display B — Toshiba VFD (24V powered USB)",
    instructions: [
      "This pole draws power and data from the dedicated 24V powered-USB block — not a standard 12V USB-A port, which cannot supply enough current.",
      "It enumerates as a USB-CDC serial device, so usbserial and cdc_acm must be loaded. Toshiba kept the VFD command set compatible with the legacy pole.",
      "Its udev rule creates the SAME /dev/sureflow-linedisplay symlink, so the application code is identical for both pole generations — only the rule differs.",
      "A mixed fleet is fine: the image can load 8250, usbserial and cdc_acm together, and only the rule matching the attached hardware fires, so exactly one symlink is created per terminal.",
    ],
    commands: [
      "lsusb   # note the pole's idVendor:idProduct and paste them into the rule",
      "ls -l /dev/sureflow-linedisplay   # must resolve to a ttyACM* node",
      "printf 'SUREFLOW POLE OK' | sudo tee /dev/sureflow-linedisplay",
    ],
    codeFiles: [{ name: "72-sureflow-pole-usb.rules", code: POLE_USB_RULES }],
  },
  {
    step_id: "hw_pole_data_path",
    label: "How pole data gets from the POS to the glass",
    instructions: [
      "The pole is the one peripheral the relay cannot proxy: it is wired to the terminal, and the relay is a different machine. So the browser drives it directly through Chromium's Web Serial API.",
      "One code path covers both pole generations because each lands on /dev/sureflow-linedisplay — the POS opens the port once at 9600 baud and writes two 20-character lines.",
      "Kiosk mode cannot answer a device-permission prompt, so the Chromium managed policy below pre-grants serial access to the relay origin. Without it the port list comes back empty and the pole stays dark with no error.",
      "The pole re-renders on every cart change — scan, void, quantity change, tender — and on sale completion.",
      "Idle (logged out) shows the store welcome; logged in with no sale shows the register number and READY; during a sale it shows the item and price, then the running total; at tender it shows change due, then THANK YOU.",
      "The pole is cosmetic by design: if the port fails to open, the POS logs it and keeps selling. A dark pole must never block a lane.",
    ],
    commands: [
      "# Verify Chromium sees the port at all (run in the kiosk devtools console)\nnavigator.serial.getPorts().then(p => console.log(p.length))",
      "# The policy is only read at browser start — restart the kiosk after installing it\nsudo systemctl restart sureflow-kiosk",
    ],
    codeFiles: [{ name: "sureflow-serial.json", code: CHROMIUM_SERIAL_POLICY }],
  },
  {
    step_id: "hw_printer_drawer",
    label: "Printer and cash drawer — network ESC/POS through the relay",
    instructions: [
      "The receipt printer stays on the LAN with a static IP and is driven as raw ESC/POS on TCP 9100 by the store relay — the browser cannot write raw bytes to a USB printer, so network printing is required, not merely preferred.",
      "A powered-USB adapter card is fine as long as it supplies 24V power ONLY and the printer keeps its Ethernet interface for data. Confirm this before buying: a power-and-data card removes the network path and breaks printing entirely.",
      "The relay polls each printer over SNMP for paper, cover and error state, which is what feeds the printer health cards in the Infrastructure Command Center.",
      "The cash drawer hangs off the printer's DK port and is opened by the ESC/POS kick command, so it needs no driver and no separate address. Some drawers are wired to pin 5 instead of pin 2 — if it never opens, that is the first thing to check.",
      "Set each lane's printer IP on the register's hardware profile; a blank value falls back to the first printer in the relay's PRINTER_IPS list.",
    ],
    commands: [
      "# Reachability and the raw print port\nping -c2 192.168.1.60 && nc -vz 192.168.1.60 9100",
      "# SNMP telemetry the relay reads\nsnmpget -v2c -c public 192.168.1.60 1.3.6.1.2.1.25.3.5.1.1.1",
      "# Drawer kick straight from the shell (bypasses the POS entirely)\nprintf '\\x1b\\x70\\x00\\x32\\x64' | nc 192.168.1.60 9100",
    ],
  },
  {
    step_id: "hw_validate_lane",
    label: "Validate a fully built lane",
    instructions: [
      "Work the register's hardware profile first — the Registers page audit panel flags any lane missing its MAC, models, printer IP or VLANs, and the PXE generator needs all of it.",
      "Boot the lane and confirm it lands on the POS login with its own register pre-selected, no picker and no console prompt.",
      "Scan an item (proves the scanner map), watch the pole update (proves the serial path), print a receipt and pop the drawer (proves the relay printer path), then press the Action Code key (proves the hwdb map).",
      "Finally pull the lane's power mid-sale. It must boot straight back into the same register with nothing to repair — that is the acceptance test for the whole diskless design.",
    ],
    commands: [
      "cat /run/sureflow.env               # identity the lane received from PXE",
      "ls -l /dev/sureflow-linedisplay     # pole symlink present",
      "journalctl -u sureflow-kiosk -n 30  # kiosk started cleanly, no restart loop",
    ],
  },
];