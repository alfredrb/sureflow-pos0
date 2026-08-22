// Physical arrangement of the on-screen keyboard, matching the lane terminal's
// touch keyboard: three QWERTY rows with the action keys on the right, a space
// row underneath, and a permanent numeric pad to the side.

export const LETTER_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["@", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
];

// Action keys sit at the end of the letter rows, as on the lane keyboard.
export const ROW_ACTIONS = [
  [{ key: "bksp", label: "BKSP" }],
  [{ key: "del", label: "DEL" }, { key: "enter", label: "ENTER" }],
  [],
];

export const BOTTOM_ACTIONS = [
  { key: "tab_prev", label: "◀ TAB" },
  { key: "tab_next", label: "TAB ▶" },
  { key: "space", label: "SPACE", wide: true },
  { key: "left", label: "◀" },
  { key: "right", label: "▶" },
];

export const NUM_ROWS = [
  ["7", "8", "9", "!", "?"],
  ["4", "5", "6", "=", "+"],
  ["1", "2", "3", "*", "&"],
  ["-", "0", "00", "'", ":"],
];