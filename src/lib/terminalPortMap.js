// Rear-panel port map per terminal model — the technician's "what plugs into what"
// reference. Rendered by TerminalPortMap as a labeled panel diagram plus a table.
//
// kind drives the swatch color in the diagram:
//   powered_serial | serial | powered_usb | usb | video | network | legacy

export const TERMINAL_PORT_MAPS = [
  {
    model: "IBM SurePOS 746",
    subtitle: "Legacy class — VGA video, fbdev, nomodeset",
    ports: [
      { id: "9A", label: "9A", kind: "powered_serial", volts: "12V", device: "IBM 2x20 pole display (RJ45)", node: "/dev/sureflow-linedisplay", note: "RJ45 connector but powered RS-232 — never patch into a switch." },
      { id: "9B", label: "9B", kind: "powered_serial", volts: "12V", device: "Spare powered serial", node: "—", note: "Second pole or powered scanner if 9A is taken." },
      { id: "4A", label: "4A", kind: "serial", volts: "—", device: "Integrated MSR wedge", node: "/dev/sureflow-msr", note: "Requires i8042.nomux=1 or the controller drops the wedge." },
      { id: "5A", label: "5A", kind: "serial", volts: "—", device: "RS-232 scanner (legacy)", node: "/dev/ttyS2", note: "Only for IBM RS-232 / OCIA scanners." },
      { id: "PUSB1", label: "24V USB", kind: "powered_usb", volts: "24V", device: "Receipt printer power (adapter card)", node: "—", note: "Power only — the printer keeps Ethernet for data." },
      { id: "PUSB2", label: "24V USB", kind: "powered_usb", volts: "24V", device: "Toshiba pole display (if fitted)", node: "/dev/sureflow-linedisplay", note: "Enumerates as ttyACM* — same symlink as the serial pole." },
      { id: "USB1", label: "USB", kind: "usb", volts: "5V", device: "SurePoint monitor hub (touch + keyboard)", node: "—", note: "Touch panel and the IBM 3AA01194300 keyboard both ride this hub." },
      { id: "USB2", label: "USB", kind: "usb", volts: "5V", device: "Zebra DS4308 scanner (USB HID)", node: "—", note: "Keyboard-wedge mode, no driver." },
      { id: "VGA", label: "VGA", kind: "video", volts: "—", device: "IBM SurePoint 4820 panel", node: "—", note: "No reliable KMS — boot with nomodeset + fbdev." },
      { id: "ETH", label: "LAN", kind: "network", volts: "—", device: "Lane switch port", node: "—", note: "Untagged VLAN 30 to PXE boot, VLAN 40 tagged for backend." },
    ],
  },
  {
    model: "IBM SurePOS 786",
    subtitle: "Modern class — DisplayPort, Intel modesetting",
    ports: [
      { id: "9A", label: "9A", kind: "powered_serial", volts: "12V", device: "IBM 2x20 pole display (RJ45)", node: "/dev/sureflow-linedisplay", note: "Same powered-serial block as the 746." },
      { id: "9B", label: "9B", kind: "powered_serial", volts: "12V", device: "Spare powered serial", node: "—", note: "Unused on most 786 lanes." },
      { id: "4A", label: "4A", kind: "serial", volts: "—", device: "Integrated MSR wedge", node: "/dev/sureflow-msr", note: "No nomux quirk needed on this generation." },
      { id: "PUSB1", label: "24V USB", kind: "powered_usb", volts: "24V", device: "Receipt printer power (adapter card)", node: "—", note: "Power only — data stays on Ethernet." },
      { id: "PUSB2", label: "24V USB", kind: "powered_usb", volts: "24V", device: "Toshiba pole display (typical)", node: "/dev/sureflow-linedisplay", note: "The usual pole choice on 786 lanes." },
      { id: "USB1", label: "USB", kind: "usb", volts: "5V", device: "SurePoint monitor hub (touch + keyboard)", node: "—", note: "Panel stays IBM SurePoint — no Elo touch driver anywhere." },
      { id: "USB2", label: "USB", kind: "usb", volts: "5V", device: "Zebra DS4308 scanner (USB HID)", node: "—", note: "Keyboard-wedge mode, no driver." },
      { id: "DP", label: "DP", kind: "video", volts: "—", device: "IBM SurePoint 4820 panel", node: "—", note: "i915 modesetting — no video boot args." },
      { id: "ETH", label: "LAN", kind: "network", volts: "—", device: "Lane switch port", node: "—", note: "Untagged VLAN 30 to PXE boot, VLAN 40 tagged for backend." },
    ],
  },
];

export const PORT_KINDS = {
  powered_serial: { label: "Powered serial", swatch: "bg-amber-100 border-amber-400 text-amber-800" },
  serial: { label: "RS-232 serial", swatch: "bg-orange-50 border-orange-300 text-orange-700" },
  powered_usb: { label: "Powered USB 24V", swatch: "bg-violet-100 border-violet-400 text-violet-800" },
  usb: { label: "Standard USB", swatch: "bg-blue-50 border-blue-300 text-blue-700" },
  video: { label: "Video", swatch: "bg-emerald-50 border-emerald-300 text-emerald-700" },
  network: { label: "Ethernet", swatch: "bg-slate-100 border-slate-400 text-slate-700" },
  legacy: { label: "Legacy PS/2", swatch: "bg-gray-100 border-gray-300 text-gray-600" },
};