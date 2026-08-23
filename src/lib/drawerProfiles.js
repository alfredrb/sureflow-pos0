// Cash drawer transports and open-command profiles.
//
// Today every drawer in the fleet is a Toshiba/IBM SDL drawer hanging off the
// receipt printer's DK (RJ11) port: the POS sends ESC p to the printer and the
// printer's own controller fires the 24V solenoid pulse. That path is
// transport-agnostic (Ethernet printer or USB-bridged printer, it makes no
// difference) which is why it needs no configuration at all.
//
// usb_direct exists so the fleet has a built-in escape hatch if the SDL variant
// of that drawer is ever discontinued — one branded drawer model gets swapped for
// its USB sibling instead of the whole fleet moving to off-brand RJ11 drawers.
// It is RESERVED: nothing selects it until USB hardware is actually deployed, and
// selecting it changes nothing for any other register.

export const DRAWER_TRANSPORTS = [
  {
    value: "printer_dk",
    label: "Printer DK port (RJ11 / SDL)",
    reserved: false,
    hint:
      "Today's fleet standard. The drawer hangs off the receipt printer's DK port and is fired by ESC p sent to Printer IP on port 9100. Nothing else to configure.",
  },
  {
    value: "usb_direct",
    label: "USB drawer — direct at the lane (reserved)",
    reserved: true,
    hint:
      "Reserved for a future USB drawer. The drawer plugs into the lane terminal, the lane's drawer bridge publishes it on a TCP port, and the relay sends that model's own open command instead of ESC p.",
  },
];

// Fixed TCP port the lane's drawer bridge publishes on. Sits alongside the
// existing lane bridges (9100 printer, 9101 pole, 12000 pinpad).
export const DRAWER_BRIDGE_PORT = 9102;

export function drawerTransportLabel(value) {
  return DRAWER_TRANSPORTS.find((t) => t.value === (value || "printer_dk"))?.label || value || "—";
}

export function isReservedDrawerTransport(value) {
  return !!DRAWER_TRANSPORTS.find((t) => t.value === value)?.reserved;
}

// Fallback open command used when a drawer model has no HardwareLibrary profile
// yet. ESC p 0 25 250 is the near-universal drawer pulse — many native USB
// drawers accept it verbatim, which makes it a safe default rather than a guess
// that silently does nothing.
export const DEFAULT_DRAWER_OPEN_HEX = "1B 70 00 19 FA";

// Reads the open command out of a HardwareLibrary cash_drawer profile. The
// profile stores JSON ({"open":"1B 70 00 19 FA"}) so a new drawer model is a
// profile entry rather than a code change — the same pattern as pinpad_commands.
export function drawerOpenHex(profile) {
  if (!profile?.open_command) return DEFAULT_DRAWER_OPEN_HEX;
  try {
    const parsed = JSON.parse(profile.open_command);
    return parsed.open || parsed.open_hex || DEFAULT_DRAWER_OPEN_HEX;
  } catch {
    // A profile may also hold the raw hex string with no JSON wrapper.
    return profile.open_command.trim() || DEFAULT_DRAWER_OPEN_HEX;
  }
}