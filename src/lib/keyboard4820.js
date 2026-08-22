// IBM 4820 SurePoint physical layout.
//
// Verified key-by-key on a live unit with evtest. Unlike the 3AA01194300, the
// 4820 has no separate S1/S2 strip — the two system keys sit in the 4x4 block:
// S1 is the ITEM INQUIRY cap (r1c4) and S2 is the ERROR CORRECT cap (r2c4).
// Cap labels follow the Walmart-customized keycaps on this fleet.

export const KEYBOARD_MODEL_4820 = "IBM 4820 SurePoint";
export const VENDOR_ID_4820 = "04B3";
export const PRODUCT_ID_4820 = "4673";

// [cap label, captured scancode, default keycode]
// Every slot ships with a distinct keycode so the generated hwdb map is complete
// the moment the layout is selected. F9 belongs to ACTION CODE and F10 to the
// Ctrl+Action Code alarm, so neither is handed to another cap.
const CAPS_4820 = [
  [["VENDOR COUPON", "70029", "f1"], ["QTY", "7003a", "f2"], ["PS MERC RETURN", "7003b", "f3"], ["ITEM INQUIRY (S1)", "7003c", "f4"]],
  [["Walmart Pay", "70047", "f5"], ["SHOP CARD", "7003d", "f6"], ["PRICE OVER", "7003e", "f7"], ["ERROR CORRECT (S2)", "7003f", "f8"]],
  [["CHECK", "7001f", "f11"], ["CREDIT DEBIT EBT", "70020", "f12"], ["TRANS DISC", "70021", "f13"], ["VOID ITEM", "70041", "f14"]],
  [["CASH", "7001e", "f15"], ["TOTAL", "70057", "f16"], ["ACTION CODE", "70044", "f9"], ["ABORT TRANS.", "70045", "f17"]],
];

// The stray scancode seen once during capture. Believed to be a slide-off ghost
// from the VOID cap, but kept as an editable slot: if it turns out to be a real
// key a technician can assign it, and while it stays unmapped the hwdb generator
// emits nothing for it — so it can never fire F9 and collide with ACTION CODE.
export const SPARE_SLOT_ID_4820 = "spare_70042";

export function build4820DefaultSlots() {
  const slots = [];
  CAPS_4820.forEach((row, r) => {
    row.forEach(([cap, scancode, keycode], c) => {
      const isActionCode = cap === "ACTION CODE";
      slots.push({
        slot_id: `r${r + 1}c${c + 1}`,
        row: r + 1,
        col: c + 1,
        cap_label: cap,
        scancode,
        // ACTION CODE reports F11 natively and must be remapped to f9, which is
        // what the POS Action Code dialog listens for.
        keycode,
        function_key_number: null,
        locked: isActionCode,
      });
    });
  });
  slots.push({
    slot_id: "np1",
    row: 5,
    col: 1,
    cap_label: "CLEAR (UNDER CTRL)",
    scancode: "7004c",
    keycode: "backspace",
    function_key_number: null,
    locked: false,
  });
  slots.push({
    slot_id: "np2",
    row: 5,
    col: 2,
    cap_label: "ENTER (DOUBLE KEY)",
    scancode: "70028",
    keycode: "enter",
    function_key_number: null,
    locked: false,
  });
  slots.push({
    slot_id: SPARE_SLOT_ID_4820,
    row: 7,
    col: 1,
    cap_label: "SPARE (70042)",
    scancode: "70042",
    keycode: "",
    function_key_number: null,
    locked: false,
  });
  return slots;
}