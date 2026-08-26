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

// Best-guess vsd node name — CONFIRM on the first live lane (pole plugged in,
// vsd running): ls -l /dev/ttyVSP* /dev/tgcs* ; journalctl -u vsd
export const VSP_POLE_DEV = "/dev/ttyVSP0";

// Hand-written VSDConfig.xml — the GUI VSDConfigTool needs GTK, which we skip.
// Only the Line Display port is populated; everything else stays at installed
// defaults. Chapter 4 of the vendor guide explicitly sanctions copying this file
// between systems, which is exactly what baking it into the image does.
export const VSD_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<VCP>
	<Ports_Configuration>
		<MSR_USB PID="" Serial_Number="" VID=""></MSR_USB>
		<LD_USB PID="4524" Serial_Number="" VID="0f66">ttyVSP0</LD_USB>
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
export const VSP_DISCOVERY_COMMANDS = `# Derive vsd's /dev node naming and the <LD_USB> port token from the binaries:
strings /opt/tgcs/vsp/bin/vsd | grep -iE '/dev/|tty|vsp|pts' | sort -u
strings /opt/tgcs/vsp/bin/VSDConfigTool 2>/dev/null | grep -iE 'tty|COM|port' | sort -u

# Then on the FIRST LIVE LANE with the pole plugged in and vsd running:
ls -l /dev/ttyVSP* /dev/tgcs* 2>/dev/null
sudo journalctl -u vsd --no-pager -n 40

# Smoke test once the node exists (Reset, home, text):
printf '\\x1f\\x10\\x00SUREFLOW POS OK' | sudo tee ${VSP_POLE_DEV} >/dev/null

# If the node name differs, correct VSP_POLE_DEV / VSDConfig.xml and rebuild.
`;

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
  "The TCx 2x20 USB pole (0f66:4524) speaks the IBM/ADX (Logic Controls) command set — Reset 1F, Display Position 10 nn, DC1 11 — never ESC/POS. Every 1B-prefixed byte is a null command it silently ignores, which is why the earlier ESC/POS and raw-hidraw attempts drew nothing.",
  "Reset (1F) is the clear-and-home command. 0C (form feed) is not in this command set, which is why earlier clear attempts failed.",
  "The .deb installs with dpkg --force-depends: libgtk-3-0 is needed only by the GUI VSDConfigTool, which we replace with a hand-written VSDConfig.xml — sanctioned by Chapter 4 of the vendor guide.",
  "DKMS is disabled at install. The packaged modules (aipdcs3/4, aipeccd) target integrated Toshiba PCI peripherals absent on generic lanes; the USB pole needs no kernel module at all, so a skipped build is harmless by design.",
  "vsd is baked into every lane image so one shared root serves the whole fleet. On a lane with no Toshiba pole it runs idle and its udev rules match nothing.",
  "The exact /dev node vsd creates and the <LD_USB> port token are a best guess (ttyVSP0) until confirmed on the first live lane. The serial bridge's ExecStartPre links whatever node exists onto /dev/sureflow-pole, so only this one constant changes if the name differs.",
];