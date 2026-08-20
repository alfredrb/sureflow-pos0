// Relay-side cheque reader module, delivered as copyable code in the Technical
// Documentation. Drives the Epson TM-H6000IV cheque station over TCP 9100:
// MICR read (E-13B), endorsement / franking print on the back of the cheque, and
// cheque ejection. Unlike printing, a MICR read needs the socket held open so the
// printer's response can be parsed, which is why this is its own module.

export const RELAY_CHECK_READER_CODE = `// checkReader.js — MICR read + endorsement franking (Epson TM-H6000IV)
const net = require("net");

const BUILD = "check-reader-build 4";
const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").filter(Boolean);
const PORT = Number(process.env.PRINTER_PORT || 9100);

const ESC = "\\x1b", FS = "\\x1c", GS = "\\x1d";
const INIT = ESC + "@";
const ALIGN_L = ESC + "a0", ALIGN_C = ESC + "a1";
const BOLD_ON = ESC + "E1", BOLD_OFF = ESC + "E0";
// Paper source select. 4 = cheque / slip station on the H6000 family, 3 = receipt roll.
const SLIP_PAPER = Number(process.env.SLIP_PAPER || 4);
const SEL_SLIP = ESC + "c0" + String.fromCharCode(SLIP_PAPER);
const SEL_RECEIPT = ESC + "c0\\x03";
const WAIT_INSERT = ESC + "f\\x1e\\x0a";   // wait ~30s for the sheet
const EJECT = "\\x0c";                      // FF — print and eject the cheque

// Cheque-station command family (1C 61 xx). These are the ONLY commands the
// printer accepts while MICR mode is active — anything else makes it eject the
// cheque and drop out of MICR mode, which is why the read must be sent on its own.
//   FS a 0 n  (1C 61 30 n) — read the cheque MICR line. n is REQUIRED; 0x30 waits
//                            for the cheque, reads E-13B, and keeps it loaded.
//   FS a 1    (1C 61 31)   — load the cheque to the print starting position
//                            (used before franking the back).
//   FS a 2    (1C 61 32)   — eject the cheque.
const MICR_READ = FS + "a0" + "\\x30";
const LOAD_CHECK = FS + "a\\x31";
const EJECT_CHECK = FS + "a\\x32";

function resolvePrinter(ip) {
  const target = ip || PRINTER_IPS[0];
  if (!target) throw new Error("No printer IP configured (set PRINTER_IPS in .env)");
  return target;
}

// Fire-and-forget write (franking, eject).
function sendRaw(ip, payload) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(8000);
    sock.once("error", reject);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("Printer timeout at " + ip)); });
    sock.connect(PORT, ip, () => sock.end(Buffer.from(payload, "binary"), () => resolve(true)));
  });
}

// Request/response: hold the socket open until the reader returns the MICR line.
// timeoutMs covers the operator inserting the cheque, so it is deliberately long.
function readMicr(ip, timeoutMs = 45000) {
  const target = resolvePrinter(ip);
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = "";
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.end(); } catch (e) {}
      fn(arg);
    };
    const timer = setTimeout(() => {
      try { sock.write(Buffer.from(EJECT_CHECK, "binary")); } catch (e) {}
      finish(reject, new Error("No cheque inserted / MICR read timed out"));
    }, timeoutMs);

    sock.once("error", (e) => finish(reject, e));
    // The TM-H6000IV does NOT terminate the MICR line with CR/LF — it streams the
    // E-13B characters and then simply stops. Waiting for a newline hangs forever,
    // so settle the read once the reader has been quiet for a moment.
    let quiet = null;
    sock.on("data", (d) => {
      buf += d.toString("binary");
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        // Strip control bytes; a lone 0x0f/0x1c reply means the MICR was unreadable.
        const line = buf.replace(/[\\x00-\\x1f\\x7f]/g, "").trim();
        if (!line || /^ERR/i.test(line)) finish(reject, new Error("MICR unreadable — key the cheque manually"));
        else finish(resolve, { micr: line, build: BUILD });
      }, 600);
    });
    sock.connect(PORT, target, () => {
      // Reset first, THEN send the read on its own. No ESC f wait-for-paper and no
      // paper-source select in front of it: FS a 0 waits for the cheque itself, and
      // any non-cheque command issued once MICR mode is armed makes the printer
      // abandon the read — that is why the lane sat on "reading MICR line" forever.
      sock.write(Buffer.from(INIT, "binary"));
      setTimeout(() => { try { sock.write(Buffer.from(MICR_READ, "binary")); } catch (e) {} }, 120);
    });
  });
}

// Endorsement / franking legend printed on the BACK of the cheque, then eject.
function buildFranking(c) {
  const w = 40;
  const ctr = (s) => {
    const t = String(s == null ? "" : s).slice(0, w);
    return " ".repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t + "\\n";
  };
  // The cheque is still in the printer from the read, so load it to the print
  // starting position with FS a 1 instead of waiting for a fresh sheet (ESC f).
  let o = SEL_SLIP + LOAD_CHECK + ALIGN_L;
  o += ctr(BOLD_ON + "FOR DEPOSIT ONLY" + BOLD_OFF);
  o += ctr(String(c.store_name || "STORE").toUpperCase());
  o += ctr("ST# " + (c.store_number || "0000") + "  REG# " + (c.register_id || "00"));
  o += ctr("CHK# " + (c.check_number || "") + "   $" + Number(c.amount || 0).toFixed(2));
  o += ctr("RT " + (c.routing_number || "") + " ACCT ***" + (c.account_last4 || ""));
  if (c.transaction_id) o += ctr("TX " + c.transaction_id);
  o += ctr(c.date || new Date().toLocaleString());
  o += ctr("OP " + (c.operator_pin || "") + " " + String(c.operator_name || "").toUpperCase());
  o += "\\n" + EJECT_CHECK + SEL_RECEIPT;
  return o;
}

module.exports = {
  readMicr,
  frankCheck: (c) => sendRaw(resolvePrinter(c.printer_ip), buildFranking(c)),
  // Release a cheque without franking it (declined tender, aborted read).
  ejectCheck: (ip) => sendRaw(resolvePrinter(ip), EJECT_CHECK + SEL_RECEIPT),
  BUILD,
};
`;

// Routes mounted on the relay's Express app, next to /api/print.
export const RELAY_CHECK_ROUTES_CODE = `// server.js — cheque station routes (mount next to /api/print)
const checkReader = require("./checkReader");

// Blocking read: the printer waits for the operator to insert the cheque, so the
// POS calls this with a long client timeout and shows an "insert cheque" prompt.
app.post("/api/check/read", async (req, res) => {
  try {
    const out = await checkReader.readMicr(req.body.printer_ip);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Print the endorsement legend on the back of the cheque and eject it.
app.post("/api/check/frank", async (req, res) => {
  try {
    await checkReader.frankCheck(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Release a cheque without franking (declined / aborted).
app.post("/api/check/eject", async (req, res) => {
  try {
    await checkReader.ejectCheck(req.body.printer_ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
`;