// Relay-side cheque reader module, delivered as copyable code in the Technical
// Documentation. Drives the Epson TM-H6000IV cheque station over TCP 9100:
// MICR read (E-13B), endorsement / franking print on the back of the cheque, and
// cheque ejection. Unlike printing, a MICR read needs the socket held open so the
// printer's response can be parsed, which is why this is its own module.

export const RELAY_CHECK_READER_CODE = `// checkReader.js — MICR read + endorsement franking (Epson TM-H6000IV)
const net = require("net");

const BUILD = "check-reader-build 2";
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

// FS a n — read the MICR line. n = 0x30 ('0') starts the read; the cheque stays
// loaded so the same insertion can be franked, and the reader answers with the
// E-13B line then CR/LF. n = 0x31 ('1') cancels a pending read.
// NOTE: exactly ONE parameter byte. Sending FS a "0" 0x30 (two bytes) leaves a
// stray character in the data stream and the reader never answers.
const MICR_READ = FS + "a" + "\\x30";
const MICR_CANCEL = FS + "a" + "\\x31";     // cancel a pending read and release the cheque

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
      try { sock.write(Buffer.from(MICR_CANCEL, "binary")); } catch (e) {}
      finish(reject, new Error("No cheque inserted / MICR read timed out"));
    }, timeoutMs);

    sock.once("error", (e) => finish(reject, e));
    sock.on("data", (d) => {
      buf += d.toString("binary");
      // The reader terminates the MICR line with CR/LF. A leading 0x0f/0x1c byte
      // signals a read error (dirty or unreadable MICR).
      if (/[\\r\\n]/.test(buf)) {
        const line = buf.replace(/[\\r\\n]+$/, "").replace(/^[\\x00-\\x1f]+/, "");
        if (!line || /^ERR/i.test(line)) finish(reject, new Error("MICR unreadable — key the cheque manually"));
        else finish(resolve, { micr: line, build: BUILD });
      }
    });
    sock.connect(PORT, target, () => {
      // No ESC f here: the MICR read command itself waits for the cheque to be
      // inserted. Prefixing it with the slip-station "wait for paper" command
      // blocks the printer before the read ever starts, which is why the lane
      // sat on "reading MICR line" forever and no data came back.
      sock.write(Buffer.from(INIT + SEL_SLIP + MICR_READ, "binary"));
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
  let o = INIT + SEL_SLIP + WAIT_INSERT + ALIGN_L;
  o += ctr(BOLD_ON + "FOR DEPOSIT ONLY" + BOLD_OFF);
  o += ctr(String(c.store_name || "STORE").toUpperCase());
  o += ctr("ST# " + (c.store_number || "0000") + "  REG# " + (c.register_id || "00"));
  o += ctr("CHK# " + (c.check_number || "") + "   $" + Number(c.amount || 0).toFixed(2));
  o += ctr("RT " + (c.routing_number || "") + " ACCT ***" + (c.account_last4 || ""));
  if (c.transaction_id) o += ctr("TX " + c.transaction_id);
  o += ctr(c.date || new Date().toLocaleString());
  o += ctr("OP " + (c.operator_pin || "") + " " + String(c.operator_name || "").toUpperCase());
  o += "\\n" + EJECT + SEL_RECEIPT;
  return o;
}

module.exports = {
  readMicr,
  frankCheck: (c) => sendRaw(resolvePrinter(c.printer_ip), buildFranking(c)),
  // Release a cheque without franking it (declined tender, aborted read).
  ejectCheck: (ip) => sendRaw(resolvePrinter(ip), INIT + SEL_SLIP + MICR_CANCEL + EJECT + SEL_RECEIPT),
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