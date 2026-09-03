// Customer-facing Ingenico pinpad command profiles.
//
// The POS never speaks Ingenico's protocol itself — it names a PROFILE and the
// relay's pinpad module looks up the byte sequences for that model. Adding a new
// pad (Lane/7000) is therefore a profile entry plus a relay profile block, with
// no change to the POS flows below.

export const PINPAD_PROFILES = {
  isc250: {
    key: "isc250",
    label: "Ingenico iSC Touch 250",
    vendor: "Ingenico",
    supported: true,
    transport: "tcp",
    // A USB iSC250 is driven over the lane's ser2net bridge: its USB-CDC framing is
    // byte-identical to its Ethernet framing, so the relay sends the SAME frames to
    // lane_ip:12000 and the bridge hands them to the pad. No relay or POS change.
    transports: ["tcp", "lane_serial_bridge"],
    port: 12000,
    // Which customer-facing flows this pad can serve.
    capabilities: ["display", "cart_mirror", "signature", "numeric_entry", "rating", "confirm"],
    // Bench-verified on RBA Retail Base 08.5016 (unit serial 80770133).
    firmware_verified: "08.5016",
    framing: "08 STX <data> CR ETX LRC — the 08 prefix is OUTSIDE the LRC, which covers data+CR+ETX",
    notes:
      "Ethernet or USB — identical frames either way. For a USB pad, the lane's HID bridge publishes it as " +
      "lane_ip:12000, so set the pinpad IP to the LANE's own LAN IP. VERIFIED FRAMING: host frames must carry the " +
      "0x08 prefix AND the CR before ETX — omitting either gets a NAK or silence. The pad replies SOH+ACK / SOH+NAK " +
      "at the link layer and sends data as RS+STX <FS-separated fields> ETX LRC; the host MUST ACK inbound packets " +
      "or the pad retries. 'LANE CLOSE' (screen 24.0) is the pad's normal idle screen, not a fault. The 08.0 health " +
      "check is confirmed working; the display/signature/entry/rating tags still need the RBA Programmer's Guide for " +
      "08.5016. Set the pad's COM setting to the interface in use (2-6-3-4 on the pad, then Enter, then +).",
  },
  lane_7000: {
    key: "lane_7000",
    label: "Ingenico Lane/7000",
    vendor: "Ingenico",
    // Reserved: the Tetra platform routes display and signature primitives through
    // Ingenico's Terminal API rather than raw device commands, so the relay profile
    // for it is written when the first Lane/7000 lands in the estate.
    supported: false,
    transport: "tcp",
    port: 12000,
    capabilities: ["display", "cart_mirror", "signature", "numeric_entry", "rating", "confirm"],
    notes:
      "Newer Tetra platform (5\" colour touchscreen, PoE, HTML5 UI). Profile reserved — enable it once the " +
      "Terminal API command block is added to the relay pinpad module. Until then lanes set to this model skip pinpad prompts.",
  },
};

export const PINPAD_MODEL_OPTIONS = [
  { value: "", label: "No pinpad on this lane" },
  ...Object.values(PINPAD_PROFILES).map((p) => ({
    value: p.key,
    label: p.supported ? p.label : `${p.label} (planned)`,
  })),
];

export function pinpadProfile(model) {
  return PINPAD_PROFILES[model] || null;
}

export function pinpadLabel(model) {
  return pinpadProfile(model)?.label || "—";
}

// A lane can drive its pad only when the model is configured, has an address, and
// its profile is actually implemented in the relay module.
export function pinpadReady(context) {
  const p = pinpadProfile(context?.pinpad_model);
  return !!(p && p.supported && context?.pinpad_ip);
}

// Whether this pad model can be driven over the lane's USB serial bridge.
export function pinpadSupportsLaneBridge(model) {
  return !!pinpadProfile(model)?.transports?.includes("lane_serial_bridge");
}

export function pinpadSupports(context, capability) {
  const p = pinpadProfile(context?.pinpad_model);
  return !!(p && p.supported && p.capabilities.includes(capability));
}