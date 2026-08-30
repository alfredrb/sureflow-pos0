// Toshiba Virtual Serial Port (VSP) driver integration for the TCx 2x20 USB
// pole display (0f66:4524).
//
// The display is a HID-class device with proprietary report framing — raw hidraw
// writes never render. The vendor's vsd daemon owns the device via libusb, speaks
// that framing, and presents a virtual serial tty. Applications then write the
// plain IBM/ADX (Logic Controls) command set to the tty: Reset 1F, Display
// Position 10 nn (00h top-left, 14h bottom-left), DC1 11, CP437 text — NOT ESC/POS.
//
// On the lane, ser2net publishes the vsd tty on lane_ip:9101 exactly like any
// other USB pole, so the relay's toshiba_usb_2x20 profile needs no transport
// knowledge beyond "write to the lane's IP".

// Where the image builder expects the vendor .deb on the controller.
export const VSP_DEB_PATH = "/srv/sureflow/vendor/toshiba-vsp-linux.deb";

// CONFIRMED WORKING on a live lane: once the pole is assigned a Line Display port
// of /dev/ttyS20, vsd owns a real pty there and TRANSLATES IBM/ADX frames written
// to it into the pole's USB HID reports — text renders. The earlier /dev/tgcsld0
// node is only a passthrough symlink onto hidraw and is NOT the path to use.
export const VSP_POLE_DEV = "/dev/ttyS20";

// Hand-written VSDConfig.xml — the GUI VSDConfigTool needs GTK (and a display,
// so it cannot be driven over plain SSH at all). Only the Line Display port is
// populated; everything else stays at installed defaults. Chapter 4 of the vendor
// guide explicitly sanctions copying this file between systems, which is exactly
// what baking it into the image does — that is what removes the per-lane GUI step.
//
// The <LD_USB> port token below is the value the GUI itself wrote on a live lane
// where the pole then rendered: the FULL device path /dev/ttyS20, not a bare
// "ttyVSP0". A bare/incorrect token leaves vsd with no pty, so the lane's serial
// bridge finds nothing to publish and the pole stays dark.
export const VSD_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<VCP>
	<Ports_Configuration>
		<MSR_USB PID="" Serial_Number="" VID=""></MSR_USB>
		<LD_USB PID="4524" Serial_Number="" VID="0f66">/dev/ttyS20</LD_USB>
		<CD_USB PID="" Serial_Number="" VID=""></CD_USB>
		<CD_PCI></CD_PCI>
		<PRINTER_USB PID="" Serial_Number="" VID=""></PRINTER_USB>
	</Ports_Configuration>
	<Logging_Configuration>
		<Log_Level>Error</Log_Level>
		<Module_VSP_Service>1</Module_VSP_Service>
		<Module_Line_Display>1</Module_Line_Display>
		<Module_MSR>0</Module_MSR>
		<Module_Cash_Drawer>0</Module_Cash_Drawer>
		<Module_Printer>0</Module_Printer>
	</Logging_Configuration>
</VCP>
`;

// Run on the CONTROLLER (where the .deb and vsd binary already live) to derive
// the node-naming scheme before the first lane test.
export const VSP_VERIFY_COMMANDS = `# Verify the pole on a lane built from the current image. The Line Display port is
# already baked in (/opt/tgcs/vsp/VSDConfig.xml), so NO GUI step is needed.

# 1. Confirm vsd honoured the baked assignment and created the pty:
sudo grep LD_USB /opt/tgcs/vsp/VSDConfig.xml
ls -l ${VSP_POLE_DEV}
sudo journalctl -u vsd --no-pager -n 40

# 2. Line discipline must match the bridge's 9600 8N1:
sudo stty -F ${VSP_POLE_DEV} 9600 cs8 -cstopb -parenb raw -echo

# 3. Smoke test straight at the tty (Reset, home, text):
printf '\\x1f\\x10\\x00SUREFLOW POS OK' | sudo tee ${VSP_POLE_DEV} >/dev/null

# 4. Confirm the bridge picked it up and is listening on the lane's own IP:
ls -l /dev/sureflow-pole
ss -lntp | grep 9101

# If the GUI is ever needed (it requires GTK + a display, so plain SSH fails with
# "cannot open display"), forward X or borrow the lane's own screen:
#   ssh -X sureflow@<lane_ip> ; sudo -E /opt/tgcs/vsp/bin/VSDConfigTool
#   sudo DISPLAY=:0 XAUTHORITY=/home/sureflow/.Xauthority /opt/tgcs/vsp/bin/VSDConfigTool
`;

// Older name kept so any existing import keeps resolving.
export const VSP_DISCOVERY_COMMANDS = VSP_VERIFY_COMMANDS;

// Installed into every lane image. --force-depends skips libgtk-3-0 (needed only
// by the GUI configurator we replace with the XML above); DKMS is disabled because
// the packaged modules target integrated Toshiba PCI peripherals that generic
// lanes do not have — the USB pole path is pure userspace libusb.
export const VSP_INSTALL_STEPS = `# Toshiba VSP driver — the USB 2x20 pole display's transport layer.
# Baked into EVERY lane image: on a lane with no Toshiba pole, vsd simply runs
# idle (~5 MB, negligible CPU) and its udev rules match nothing.
export DEBIAN_FRONTEND=noninteractive
# Keep DKMS from building vendor kernel modules we never load.
echo 'DKMS_DISABLED=1' > /etc/default/tgcs-vsp
dpkg --force-depends -i /tmp/toshiba-vsp-linux.deb || true
dpkg --configure --force-depends -a || true
# Hand-written config (no GTK config tool in the image).
install -D -m 644 /tmp/VSDConfig.xml /opt/tgcs/vsp/VSDConfig.xml
systemctl enable vsd || true
`;

export const VSP_INTEGRATION_NOTES = [
  "PROVEN WORKING ON A LIVE LANE: with the pole assigned a Line Display port of /dev/ttyS20, vsd owns a real pty there and TRANSLATES IBM/ADX frames written to it into the pole's USB HID reports — text renders. This supersedes the earlier finding: what failed before was the port token, not the driver.",
  "The port token must be the FULL path (/dev/ttyS20), which is what the VSP config tool itself writes: <LD_USB PID=\"4524\" Serial_Number=\"\" VID=\"0f66\">/dev/ttyS20</LD_USB>. A bare token such as 'ttyVSP0' leaves vsd with no pty at all, the serial bridge then has nothing to publish, and the pole stays dark — which is exactly how this looked like a driver limitation.",
  "That exact line is now BAKED into the image's VSDConfig.xml, so a freshly built lane comes up with the pole already assigned and there is no per-lane GUI step. The GUI is only a fallback, and it needs GTK plus a display — over plain SSH it fails with 'cannot open display', so use ssh -X with sudo -E, or borrow the lane's own screen with DISPLAY=:0.",
  "/dev/tgcsld0 is NOT the path to use: it is only a passthrough symlink onto the raw HID device (hidraw0), and writing frames there renders nothing. Always drive the vsd pty at /dev/ttyS20.",
  "vsd stays baked into every lane image. On a lane with no VSP peripheral it runs idle and harmless (~7 MB) and its udev rules match nothing, so one shared root serves the whole fleet.",
  "The TCx 2x20 USB pole (0f66:4524) speaks the IBM/ADX (Logic Controls) command set — Reset 1F, Display Position 10 nn (00h line 1, 14h line 2), DC1 11 — never ESC/POS.",
  "The pty runs 9600 8N1, matching the lane bridge's pole connector line. A wrong baud renders garbage glyphs rather than nothing, which is the quick way to tell a line-discipline fault from a missing assignment.",
  "Reset (1F) is the clear-and-home command. 0C (form feed) is not in this command set, which is why earlier clear attempts failed.",
  "The .deb installs with dpkg --force-depends: libgtk-3-0 is needed only by the GUI VSDConfigTool, which we replace with a hand-written VSDConfig.xml — sanctioned by Chapter 4 of the vendor guide.",
  "DKMS is disabled at install. The packaged modules (aipdcs3/4, aipeccd) target integrated Toshiba PCI peripherals absent on generic lanes; the USB pole needs no kernel module at all, so a skipped build is harmless by design.",
  "vsd is baked into every lane image so one shared root serves the whole fleet. On a lane with no VSP peripheral it runs idle and its udev rules match nothing.",
];