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

function money(n) { return Number(n || 0).toFixed(2); }
function padR(s, n) { return String(s == null ? "" : s).slice(0, n).padEnd(n, " "); }
function padL(s, n) { return String(s == null ? "" : s).slice(-n).padStart(n, " "); }

// IBM 4690 totals block: right-aligned label + right-aligned amount.
function amountRow(label, amount) { return padL(label, 30) + padL(amount, 12) + "\\n"; }

// Centers text in a fixed-width column so item names line up uniformly.
function padC(s, n) {
  const t = String(s == null ? "" : s).slice(0, n);
  const left = Math.floor((n - t.length) / 2);
  return " ".repeat(left) + t + " ".repeat(n - t.length - left);
}

// NAME(centered 16) SKU(12) F AMOUNT(9) TAXCODE — the 4690 item column layout.
function itemLine(it, exempt) {
  const code = exempt ? "E" : Number(it.tax_rate || 0) > 0 ? "X" : "O";
  return padC(String(it.name || "").toUpperCase(), 16) + " " + padL(it.sku || "", 12) +
    " " + (it.food ? "F" : " ") + padL(money(it.total), 9) + " " + code + "\\n";
}

function center(text) { return ALIGN_C + text + "\\n" + ALIGN_L; }

// Builds the ESC/POS byte string for a receipt payload sent by the POS.
function buildReceipt(r) {
  let o = INIT + ALIGN_C;
  o += BOLD_ON + BIG_ON + String(r.store_name || "Store").toUpperCase() + "\\n" + BIG_OFF + BOLD_OFF;
  for (const l of [r.header_line_1, r.store_address, r.store_phone]) {
    if (l) o += l + "\\n";
  }
  o += "\\n";
  if (r.doc_type === "return") o += BOLD_ON + "*** RETURN / REFUND ***" + BOLD_OFF + "\\n";
  if (r.doc_type === "exchange") o += BOLD_ON + "*** EXCHANGE ***" + BOLD_OFF + "\\n";
  if (r.manager_name) o += "MANAGER " + String(r.manager_name).toUpperCase() + "\\n";
  o += "ST# " + (r.store_number || "0000") + "  OP# " + (r.operator_pin || "") +
    "  REG# " + (r.register_id || "00") + "\\n";
  o += ALIGN_L;

  for (const it of r.items || []) {
    o += itemLine(it, r.tax_exempt);
    for (const sn of it.serial_numbers || []) o += "   SN: " + sn + "\\n";
  }

  o += amountRow("SUBTOTAL", money(r.subtotal));
  if (r.tax_exempt) o += amountRow("TAX EXEMPT", "0.00");
  else o += amountRow("TAX  " + Number(r.tax_rate || 0).toFixed(3) + " %", money(r.tax));
  o += amountRow(r.doc_type === "return" ? "REFUND TOTAL"
    : r.doc_type === "exchange" ? "BALANCE DUE" : "TOTAL", money(r.total));
  // On a refund the money moves back to the customer, so tender prints negative.
  const signed = (n) => (r.doc_type === "return" ? "-" + money(n) : money(n));
  if (r.rewards_applied > 0) o += amountRow("REWARDS TEND", signed(r.rewards_applied));
  const tender = String(r.payment_method || "cash").toUpperCase().replace("_", " ");
  o += amountRow(tender + " TEND", signed(r.payment_method === "cash"
    ? r.amount_tendered : (r.total || 0) - (r.rewards_applied || 0)));
  o += amountRow("CHANGE DUE", money(r.change_due));

  const count = (r.items || []).reduce(function (s, i) { return s + Number(i.qty || 0); }, 0);
  o += "\\n" + ALIGN_C + "# ITEMS " + (r.doc_type === "return" ? "RETURNED " : "SOLD ") +
    count + "\\n" + ALIGN_L;

  // Transaction ID as a CODE128 barcode (with the TX printed under it) so
  // returns can be scanned straight from the receipt.
  if (r.transaction_id) {
    const d = r.transaction_id;
    o += ALIGN_C + GS + "h\\x50" + GS + "w\\x02" + GS + "H\\x02";
    o += GS + "k\\x49" + String.fromCharCode(d.length + 2) + "{B" + d + "\\n" + ALIGN_L;
  }

  if (r.giftcard_notice) {
    o += center("GIFT CARDS NOT REFUNDABLE") + center("Cannot be exchanged for cash or credit");
  }
  if (r.tax_exempt) {
    o += center("TAX EXEMPT " + (r.tax_exempt.tax_exempt_id || ""));
    o += center(String(r.tax_exempt.name || "").toUpperCase());
  }
  if (r.loyalty_member) {
    o += center("MEMBER " + (r.loyalty_member.loyalty_id || ""));
    o += amountRow("REWARDS EARNED", money(r.rewards_earned));
    o += amountRow("REWARDS BALANCE", money(r.loyalty_balance));
  }

  for (const l of [r.footer_line_1, r.footer_line_2]) if (l) o += center(l);
  o += center(r.date || new Date().toLocaleString());
  o += "\\n" + center("***CUSTOMER COPY***");

  o += "\\n";                     // GS V 66 feeds to the cutter, so no extra padding needed
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
    // Resolve as soon as the bytes are flushed to the printer instead of waiting
    // for the socket teardown — the print starts immediately either way.
    sock.connect(PORT, ip, () => sock.end(Buffer.from(payload, "binary"), () => resolve(true)));
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