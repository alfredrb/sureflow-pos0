// IBM 3AA01195500 — the full-alphanumeric 4690 keyboard used on customer-service
// registers. Unlike the 3AA01194300 fleet standard, this board carries a real QWERTY
// block, so text fields are typed natively and the on-screen soft keyboard is turned
// off per register (Register.soft_keyboard_disabled).
//
// The QWERTY, numeric and modifier keys are standard USB-HID and are deliberately NOT
// modelled here — they need no remapping. Only the two programmable areas are slots:
//
//   TOP STRIP  — the row of small caps above the number row (t1..t14)
//   AUX BLOCK  — the 4-wide cluster of yellow/white/blue caps between the QWERTY
//                block and the numeric pad (a1..a24)
//
// The printed legends on a salvaged board (LOAN, NO SALE, E-COMM, MAN. TAX …) come from
// whatever retail system it was harvested from and mean nothing to SureFlow. Slots are
// therefore labelled by POSITION, not by legend: the technician captures each key's
// scancode with evtest and prints a matching keycap label sheet.

export const KEYBOARD_MODEL_195500 = "IBM 3AA01195500";

// Captured at calibration time, exactly as the 4820 was. Left blank until a board is
// on hand — an invented vendor/product would emit an hwdb match that binds nothing.
export const VENDOR_ID_195500 = "";
export const PRODUCT_ID_195500 = "";

const TOP_STRIP_KEYS = 14;
const AUX_ROWS = 6;
const AUX_COLS = 4;

// Row bands, so a grid can lay the board out without inspecting slot ids.
export const ROW_TOP_STRIP_195500 = 1;
export const ROW_AUX_START_195500 = 2;   // aux rows occupy 2..7
export const ROW_NUMPAD_195500 = 8;

// The aux slot that gets the reserved Action Code keycode. F9 (Action Code) and F10
// (Ctrl+Action Code, silent robbery alarm) are reserved on every layout family, so one
// slot arrives pre-assigned to f9. It is left UNLOCKED because this model's scancode
// for that cap is unknown until a board is calibrated — locking it would leave the
// technician unable to enter the code they just captured.
export const ACTION_CODE_SLOT_195500 = "a24";

const slot = (id, row, col, cap, extra = {}) => ({
  slot_id: id,
  row,
  col,
  cap_label: cap,
  scancode: "",
  keycode: "",
  function_key_number: null,
  locked: false,
  ...extra,
});

export function build3AA195500DefaultSlots() {
  const slots = [];

  for (let i = 1; i <= TOP_STRIP_KEYS; i++) {
    slots.push(slot(`t${i}`, ROW_TOP_STRIP_195500, i, `TOP ${i}`));
  }

  let n = 0;
  for (let r = 0; r < AUX_ROWS; r++) {
    for (let c = 0; c < AUX_COLS; c++) {
      n += 1;
      const id = `a${n}`;
      const isActionCode = id === ACTION_CODE_SLOT_195500;
      slots.push(
        slot(id, ROW_AUX_START_195500 + r, c + 1, isActionCode ? `AUX ${n} (ACTION CODE)` : `AUX ${n}`, {
          keycode: isActionCode ? "f9" : "",
        })
      );
    }
  }

  // The pad's CLEAR and ENTER caps, same roles they hold on the fleet keyboard: CLEAR
  // deletes the last digit on every POS pinpad, ENTER submits it.
  slots.push(slot("np1", ROW_NUMPAD_195500, 1, "CLEAR (NUM PAD)", { keycode: "backspace" }));
  slots.push(slot("np2", ROW_NUMPAD_195500, 2, "ENTER (NUM PAD)", { keycode: "enter" }));

  return slots;
}