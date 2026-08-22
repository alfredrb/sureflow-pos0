// Physical keyboard layout model for the visual remapper.
//
// Three layers, kept deliberately separate:
//   scancode  — what the hardware sends (captured once per model with evtest)
//   keycode   — what hwdb remaps it to, and what the browser delivers as e.code
//   function  — which FunctionKey.key_number the POS runs for that keycode
//
// The remapper only ever changes the third layer plus the keycode assignment;
// scancodes belong to the hardware and are captured, never invented.

import {
  KEYBOARD_MODEL_4820,
  VENDOR_ID_4820,
  PRODUCT_ID_4820,
  SPARE_SLOT_ID_4820,
  build4820DefaultSlots,
} from "@/lib/keyboard4820";

export const DEFAULT_KEYBOARD_MODEL = "IBM 3AA01194300";

// Physical layout families. Each one owns its own keycap set and slot structure,
// so adding a model never disturbs a model already deployed on lanes.
export const MODEL_TYPE_3AA = "ibm_3aa01194300";
export const MODEL_TYPE_4820 = "ibm_4820_surepoint";

export const MODEL_TYPES = [
  { value: MODEL_TYPE_3AA, label: "IBM 3AA01194300", model: DEFAULT_KEYBOARD_MODEL, vendor_id: "", product_id: "", ctrl_override: true },
  { value: MODEL_TYPE_4820, label: "IBM 4820 SurePoint", model: KEYBOARD_MODEL_4820, vendor_id: VENDOR_ID_4820, product_id: PRODUCT_ID_4820, ctrl_override: false },
  { value: "custom", label: "Custom", model: "", vendor_id: "", product_id: "", ctrl_override: true },
];

export const modelTypeConfig = (t) => MODEL_TYPES.find((m) => m.value === t) || MODEL_TYPES[0];

// Default slot set for a layout family.
export function buildSlotsForModel(modelType) {
  return modelType === MODEL_TYPE_4820 ? build4820DefaultSlots() : buildDefaultSlots();
}

// Swapping the model type rebuilds the slot structure, but any scancode the
// technician already captured for a slot with the same id is carried across so a
// mis-click never loses calibration work.
export function switchModelSlots(modelType, existingSlots = []) {
  const prev = {};
  existingSlots.forEach((s) => { prev[s.slot_id] = s; });
  return buildSlotsForModel(modelType).map((s) => {
    const old = prev[s.slot_id];
    if (!old) return s;
    return { ...s, scancode: old.scancode || s.scancode, keycode: s.locked ? s.keycode : old.keycode || s.keycode, function_key_number: old.function_key_number ?? null };
  });
}

// The 4x4 function-key block as it ships on the lane keyboards. Cap labels mirror
// the physical keycaps so a technician can match the screen to the hardware.
// Scancodes start blank — the model must be calibrated before the map is real.
const CAPS = [
  ["VENDOR COUPON", "QTY", "PS MERC RETURN", "ITEM INQUIRY"],
  ["STORE PAY", "SHOP CARD", "PRICE OVERRIDE", "ITEM INQUIRY 2"],
  ["CHECK", "CREDIT DEBIT EBT", "TRANS DISC", "VOID"],
  ["CASH", "TOTAL", "ACTION CODE", "ABORT TRANS."],
];

// F9 (Action Code) and F10 (Ctrl+Action Code, silent robbery alarm) are reserved.
// The POS depends on both, so their slots are locked in the editor.
export const RESERVED_KEYCODES = ["f9", "f10"];

export const KEYCODE_OPTIONS = [...Array.from({ length: 16 }, (_, i) => `f${i + 1}`), "backspace", "enter"];

// The blank keycap directly under CTRL on the numeric pad. Mapped to backspace so
// it deletes the last digit on every POS pinpad.
const NUMPAD_CLEAR_CAP = "CLEAR (UNDER CTRL)";

// The double-height cap below CLEAR — the pad's ENTER key, used to submit pinpads.
const NUMPAD_ENTER_CAP = "ENTER (DOUBLE KEY)";

// S1 / S2 system keys. Under 4690 the OS used Ctrl+S1 / Ctrl+S2 for system-mode
// functions — that behavior was software, not firmware, so on our lanes they are
// two ordinary free keys with their own scancodes (see the ANPOS PS/2 table in
// IBM GC30-3623-10 ch. 8). Mapped here like any other key; unassigned by default.
const SYSTEM_KEYS = [
  { slot_id: "s1", col: 1, cap_label: "S1" },
  { slot_id: "s2", col: 2, cap_label: "S2" },
];

// Older saved layouts predate the S1/S2 slots — append them on load so the
// editor always shows them without disturbing the technician's existing map.
// The 4820 is exempt: its S1/S2 live inside the 4x4 grid, so it must never grow
// a row-6 strip.
export function ensureSystemSlots(slots = [], modelType = MODEL_TYPE_3AA) {
  if (modelType === MODEL_TYPE_4820) return slots;
  const missing = SYSTEM_KEYS.filter((k) => !slots.some((s) => s.slot_id === k.slot_id));
  if (!missing.length) return slots;
  return [
    ...slots,
    ...missing.map((k) => ({
      slot_id: k.slot_id,
      row: 6,
      col: k.col,
      cap_label: k.cap_label,
      scancode: "",
      keycode: "",
      function_key_number: null,
      locked: false,
    })),
  ];
}

export function buildDefaultSlots() {
  const slots = [];
  CAPS.forEach((row, r) => {
    row.forEach((cap, c) => {
      const isActionCode = cap === "ACTION CODE";
      slots.push({
        slot_id: `r${r + 1}c${c + 1}`,
        row: r + 1,
        col: c + 1,
        cap_label: cap,
        scancode: isActionCode ? "70045" : "",
        keycode: isActionCode ? "f9" : "",
        function_key_number: null,
        locked: isActionCode,
      });
    });
  });
  slots.push({
    slot_id: "np1",
    row: 5,
    col: 1,
    cap_label: NUMPAD_CLEAR_CAP,
    scancode: "",
    keycode: "backspace",
    function_key_number: null,
    locked: false,
  });
  slots.push({
    slot_id: "np2",
    row: 5,
    col: 2,
    cap_label: NUMPAD_ENTER_CAP,
    scancode: "",
    keycode: "enter",
    function_key_number: null,
    locked: false,
  });
  return ensureSystemSlots(slots);
}

export const isCalibrated = (slots = []) => slots.some((s) => s.scancode);

export const SPARE_SLOT_ID = SPARE_SLOT_ID_4820;

// showkey --scancodes prints hex with a 0x prefix (0x3b); evtest prints the bare
// HID value (70045). hwdb wants the bare hex either way, so prefixes are stripped
// and the digits lowercased as the technician types. Extended keys come out of
// showkey as a multi-byte sequence ("0xe0 0x4d") — the bytes are joined into the
// single hwdb code (e04d).
// An all-zero capture (0x00 0x00, or a longer run of them) means no scancode
// reached the console driver at all — it is discarded rather than written into the
// map, where a zero code would match no key and fail silently.
export const normalizeScancode = (v = "") => {
  const code = String(v).trim().split(/[\s,]+/).filter(Boolean)
    .map((b) => b.replace(/^0x/i, "").toLowerCase()).join("");
  return /^0+$/.test(code) ? "" : code;
};

// Which keycodes are already taken by another slot — prevents two physical keys
// firing the same POS action by accident.
export function duplicateKeycodes(slots = []) {
  const seen = {};
  slots.forEach((s) => {
    if (!s.keycode) return;
    seen[s.keycode] = (seen[s.keycode] || 0) + 1;
  });
  return Object.keys(seen).filter((k) => seen[k] > 1);
}

// The hwdb map baked into the read-only NFS image. This is the same file the PXE
// bootstrap emits — saving a layout here replaces the hardcoded fallback with the
// technician's captured map.
export function buildHwdbMap(layout) {
  const model = layout?.keyboard_model || DEFAULT_KEYBOARD_MODEL;
  // The spare 70042 slot only reaches the map once a technician assigns it a
  // keycode, so an unmapped ghost code can never fire anything.
  const mapped = (layout?.slots || []).filter((s) => s.scancode && s.keycode);
  const vendor = (layout?.vendor_id || "").trim().toUpperCase();
  const product = (layout?.product_id || "").trim().toUpperCase();
  const match = vendor && product ? `evdev:input:b0003v${vendor}p${product}*` : `evdev:input:b0003v04B3p3025*`;
  const lines = [
    `# /etc/udev/hwdb.d/70-sureflow-pos-keyboard.hwdb`,
    `# ${model} — generated by the visual key remapper`,
    `# Function-key block and numeric pad only. The USB-HID MSR types its track`,
    `# data as ordinary digits — never remap a digit scancode here.`,
    match,
  ];
  if (!mapped.length) {
    lines.push(` # No scancodes captured yet — run the calibration steps first.`);
  }
  mapped.forEach((s) => {
    lines.push(` KEYBOARD_KEY_${s.scancode}=${s.keycode}   # ${s.cap_label}`);
  });
  if (layout?.ctrl_override !== false) {
    lines.push(
      `# The override strip stays Ctrl so Ctrl+Action Code (F10) keeps firing the`,
      `# silent robbery alarm. Never reassign F9 or F10.`,
      ` KEYBOARD_KEY_70029=leftctrl`,
    );
  } else {
    lines.push(
      `# Ctrl override disabled for this model — 70029 is a normal keycap here and`,
      `# must not become a Ctrl modifier.`,
    );
  }
  lines.push(
    ``,
    `# apply inside the image with:`,
    `#   systemd-hwdb update && udevadm trigger`,
  );
  return lines.join("\n");
}

export const CALIBRATION_COMMANDS = [
  "# On a lane — press each function key in turn and note the scancode it reports\nsudo evtest",
  "# Apply the saved map after installing it into the image\nsudo systemd-hwdb update && sudo udevadm trigger",
];