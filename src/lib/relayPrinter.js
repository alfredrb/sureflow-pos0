// Relay-side raw ESC/POS printing module, delivered as copyable code in the
// Relay Setup Guide. Sends receipts straight to an Epson TM-H6000IV on TCP 9100
// and fires the cash-drawer kick command.

export const RELAY_PRINTER_CODE = `// printer.js — raw ESC/POS printing + cash drawer kick (Epson TM-H6000IV)
const net = require("net");

const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").filter(Boolean);
const PORT = Number(process.env.PRINTER_PORT || 9100);
const WIDTH = Number(process.env.RECEIPT_WIDTH || 42); // chars on 80mm paper

const ESC = "\\x1b", GS = "\\x1d";
const INIT = ESC + "@";
const ALIGN_L = ESC + "a0", ALIGN_C = ESC + "a1";
const BOLD_ON = ESC + "E1", BOLD_OFF = ESC + "E0";
const BIG_ON = GS + "!\\x11", BIG_OFF = GS + "!\\x00";
const CUT = GS + "V\\x42\\x00";
// Drawer kick: pin 2, 100ms on / 200ms off. Some drawers are wired to pin 5 (p=1).
const KICK = ESC + "p\\x00\\x32\\x64";

function line(char) { return char.repeat(WIDTH) + "\\n"; }
function money(n) { return "$" + Number(n || 0).toFixed(2); }

// Left text + right-aligned amount on one line.
function row(left, right) {
  const l = String(left), r = String(right);
  const pad = Math.max(1, WIDTH - l.length - r.length);
  return l.slice(0, WIDTH - r.length - 1) + " ".repeat(pad) + r + "\\n";
}

function center(text) { return ALIGN_C + text + "\\n" + ALIGN_L; }

// Builds the ESC/POS byte string for a receipt payload sent by the POS.
function buildReceipt(r) {
  let o = INIT + ALIGN_C;
  o += BOLD_ON + BIG_ON + (r.store_name || "Store") + "\\n" + BIG_OFF + BOLD_OFF;
  for (const l of [r.store_address, r.store_phone, r.header_line_1, r.header_line_2]) {
    if (l) o += l + "\\n";
  }
  o += ALIGN_L + line("-");
  o += "TX ID: " + (r.transaction_id || "") + "\\n";
  o += "Date: " + (r.date || new Date().toLocaleString()) + "\\n";
  o += "Register: " + (r.register_name || "") + "\\n";
  o += "Operator: " + (r.operator_name || "") + "\\n";
  o += line("-");

  for (const it of r.items || []) {
    o += row(it.qty + "x " + it.name, money(it.total));
    for (const sn of it.serial_numbers || []) o += "   SN: " + sn + "\\n";
  }

  o += line("-");
  o += row("Subtotal:", money(r.subtotal));
  o += row("Tax:", money(r.tax));
  o += BOLD_ON + row("TOTAL:", money(r.total)) + BOLD_OFF;

  if (r.rewards_applied > 0) {
    o += row("Rewards Credit:", "-" + money(r.rewards_applied));
    o += BOLD_ON + row("Amount Due:", money((r.total || 0) - r.rewards_applied)) + BOLD_OFF;
  }
  o += line("-");
  if (r.payment_method === "cash") {
    o += row("Tendered:", money(r.amount_tendered));
    o += BOLD_ON + row("Change:", money(r.change_due)) + BOLD_OFF;
  } else {
    o += row("Payment Method:", String(r.payment_method || "").toUpperCase());
  }

  // Transaction ID as a CODE128 barcode so returns can be scanned from the receipt.
  if (r.transaction_id) {
    const d = r.transaction_id;
    o += "\\n" + ALIGN_C + GS + "h\\x50" + GS + "w\\x02" + GS + "H\\x02";
    o += GS + "k\\x49" + String.fromCharCode(d.length + 2) + "{B" + d + "\\n" + ALIGN_L;
  }

  if (r.giftcard_notice) {
    o += line("-") + center("** GIFT CARDS NOT REFUNDABLE **") + center("Cannot be exchanged for cash or credit");
  }
  if (r.tax_exempt) {
    o += line("-") + center("TAX EXEMPT SALE");
    o += r.tax_exempt.name + " - " + r.tax_exempt.tax_exempt_id + "\\n";
  }
  if (r.loyalty_member) {
    o += line("-") + center("LOYALTY MEMBER");
    o += r.loyalty_member.name + " - " + r.loyalty_member.loyalty_id + "\\n";
    o += row("Earned This Visit:", money(r.rewards_earned));
    o += row("Rewards Balance:", money(r.loyalty_balance));
  }

  o += "\\n" + ALIGN_C + BOLD_ON + "Thank You!" + BOLD_OFF + "\\n" + ALIGN_L;
  for (const l of [r.footer_line_1, r.footer_line_2]) if (l) o += ALIGN_C + l + "\\n" + ALIGN_L;

  o += "\\n\\n\\n";
  if (r.open_drawer) o += KICK;   // pop the drawer on cash sales
  o += CUT;
  return o;
}

// Resolve which printer to talk to: explicit IP, else the store's first configured printer.
function resolvePrinter(ip) {
  const target = ip || PRINTER_IPS[0];
  if (!target) throw new Error("No printer IP configured (set PRINTER_IPS in .env)");
  return target;
}

function sendRaw(ip, payload) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(5000);
    sock.once("error", reject);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("Printer timeout at " + ip)); });
    sock.connect(PORT, ip, () => sock.end(Buffer.from(payload, "binary")));
    sock.once("close", () => resolve(true));
  });
}

module.exports = {
  printReceipt: (receipt) => sendRaw(resolvePrinter(receipt.printer_ip), buildReceipt(receipt)),
  openDrawer: (ip) => sendRaw(resolvePrinter(ip), INIT + KICK),
  testPrint: (ip) => sendRaw(resolvePrinter(ip), INIT + ALIGN_C + BOLD_ON + "SUREFLOW TEST PRINT\\n" + BOLD_OFF +
    new Date().toLocaleString() + "\\n" + (process.env.STORE_ID || "") + "\\n\\n\\n" + CUT),
  printers: PRINTER_IPS,
};
`;