// E-13B MICR parsing and cheque validation.
//
// The TM-H6000IV cheque reader returns the MICR line with the four E-13B symbols
// transliterated to ASCII: T = transit (routing delimiter), O = on-us (account
// delimiter), D = amount delimiter, and "-" as the dash. A US personal cheque
// reads back as:  T123456789T 1234567890O 1025
// Field order varies by bank, so the parser works off the delimiters rather than
// fixed offsets, then falls back to "longest 9-digit group is the routing number".

const digits = (s) => String(s || "").replace(/\D/g, "");

// ABA mod-10: weights 3,7,1 repeating across the nine digits.
export function validRouting(routing) {
  const d = digits(routing);
  if (d.length !== 9) return false;
  const w = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = d.split("").reduce((s, c, i) => s + Number(c) * w[i], 0);
  return sum % 10 === 0;
}

export function parseMicr(raw) {
  const line = String(raw || "").toUpperCase().replace(/\s+/g, "");
  const out = { raw: String(raw || ""), routing: "", account: "", check_number: "" };
  if (!line) return out;

  // Routing lives between the two transit symbols.
  const transit = line.match(/T(\d{9})T/);
  if (transit) out.routing = transit[1];

  // Account is the on-us field: digits ending at the O symbol.
  const onUs = line.match(/([\d-]{4,})O/);
  if (onUs) out.account = digits(onUs[1]);

  // Whatever trails the on-us field is the cheque serial number.
  const tail = line.split("O").pop();
  if (tail) out.check_number = digits(tail);

  // Delimiter-free reads (some business cheques): take number groups by length.
  if (!out.routing || !out.account) {
    const groups = line.match(/\d+/g) || [];
    if (!out.routing) out.routing = groups.find((g) => g.length === 9 && validRouting(g)) || out.routing;
    if (!out.account) {
      out.account = groups.filter((g) => g !== out.routing).sort((a, b) => b.length - a.length)[0] || "";
    }
    if (!out.check_number) {
      out.check_number = groups.filter((g) => g !== out.routing && g !== out.account).pop() || "";
    }
  }
  return out;
}

export const last4 = (account) => digits(account).slice(-4);

// Everything the register checks before it will take the cheque.
export function validateCheck({ routing, account, check_number }) {
  if (!validRouting(routing)) return "Routing number failed the ABA checksum — cheque cannot be accepted.";
  if (digits(account).length < 4) return "Account number is missing or too short.";
  if (!digits(check_number)) return "Cheque number is required.";
  return "";
}