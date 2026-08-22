// Turns a pasted `showkey --scancodes` capture into the list of hwdb codes to type
// into the key slots.
//
// The console prints raw AT set-1 bytes with no key boundaries, so the whole paste
// is read as one byte stream (a press and its release often split across lines):
//   - 0xe0 / 0xe1 is an extended-key prefix — prefix + byte is ONE code (e0 48)
//   - a byte under 0x80 is a press; the matching release is that byte + 0x80
//   - a stray byte of 0x80 or more is a release with no press in the paste
//   - 0x00 never reaches the driver as a real code and is dropped
export function decodeShowkey(text = "") {
  const bytes = (String(text).match(/0x[0-9a-f]{2}/gi) || []).map((b) => parseInt(b, 16));
  const codes = [];
  let i = 0;

  while (i < bytes.length) {
    const b = bytes[i];

    if (b === 0x00) { i += 1; continue; }

    if (b === 0xe0 || b === 0xe1) {
      const next = bytes[i + 1];
      if (next === undefined) break;
      const prefix = b.toString(16);
      const code = prefix + next.toString(16).padStart(2, "0");
      i += 2;
      // Skip its release: the same prefix followed by the press byte + 0x80.
      if (bytes[i] === b && bytes[i + 1] === (next | 0x80)) i += 2;
      codes.push({ code, extended: true });
      continue;
    }

    if (b < 0x80) {
      const code = b.toString(16).padStart(2, "0");
      i += 1;
      if (bytes[i] === (b | 0x80)) i += 1; // its release
      codes.push({ code, extended: false });
      continue;
    }

    i += 1; // orphan release byte
  }

  return codes;
}