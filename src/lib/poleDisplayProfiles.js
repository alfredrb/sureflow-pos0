// Customer-facing pole display (line display) command profiles.
//
// Same pattern as the pinpad: the POS names a PROFILE and the relay's pole
// display module speaks that model's byte sequences. Adding a new pole is a
// profile entry plus a relay profile block — the POS flows never change.

export const POLE_DISPLAY_PROFILES = {
  epson_dmd110: {
    key: "epson_dmd110",
    label: "Epson DM-D110",
    vendor: "Epson",
    supported: true,
    // The DM-D110 hangs off the receipt printer's DM-D port, so the relay
    // reaches it THROUGH the printer on port 9100 (ESC = peripheral select).
    transport: "printer_passthrough",
    port: 9100,
    columns: 20,
    rows: 2,
    notes:
      "2×20 VFD on the TM printer's DM-D (modular) port. No network address of its own — the relay selects it " +
      "with ESC = 2 through the printer, writes both lines, then reselects the printer so receipts keep working. " +
      "Leave the pole IP blank; the lane's printer IP carries the traffic.",
  },
  logic_ld9900: {
    key: "logic_ld9900",
    label: "Logic Controls LD9900",
    vendor: "Logic Controls",
    // Reserved: speaks the LCI command set over RS-232, so it needs a
    // serial-device server and its own relay profile block before lanes can use it.
    supported: false,
    transport: "tcp",
    port: 9100,
    columns: 20,
    rows: 2,
    notes:
      "2×20 VFD, LCI command set over RS-232. Profile reserved — attach it through a serial-device server, give it " +
      "an IP, and enable the profile block in the relay pole module. Until then lanes set to this model skip display updates.",
  },
};

export const POLE_MODEL_OPTIONS = [
  { value: "", label: "No pole display on this lane" },
  ...Object.values(POLE_DISPLAY_PROFILES).map((p) => ({
    value: p.key,
    label: p.supported ? p.label : `${p.label} (planned)`,
  })),
];

export function poleProfile(model) {
  return POLE_DISPLAY_PROFILES[model] || null;
}

export function poleLabel(model) {
  return poleProfile(model)?.label || "—";
}

// A lane can drive its pole when the model's profile is implemented and the relay
// has an address to write to — the pole's own IP, or the printer for pass-through
// models (blank printer IP falls back to the relay's default printer, like receipts).
export function poleReady(context) {
  const p = poleProfile(context?.pole_display_model);
  if (!p || !p.supported) return false;
  return !!(context?.pole_display_ip || p.transport === "printer_passthrough");
}