// Relay-side cheque reader module, delivered as copyable code in the Technical
// Documentation. Drives the Epson TM-H6000IV cheque station over TCP 9100:
// MICR read (E-13B), endorsement print on the back of the cheque, and ejection.
// Unlike printing, a MICR read needs the socket held open so the printer's
// response can be parsed, which is why this is its own module.
//
// TWO-PASS ENDORSEMENT (build 5). The fleet's printers have no endorsement (E/P)
// unit — the self-test capability report confirmed it. The slip station is the
// only station fitted and it prints the FACE of the sheet, so the previous
// single-insertion "frank" was printing the legend on the FRONT of the cheque,
// over the payee and amount. That is corrected here: the cheque is ejected after
// the MICR read, the operator turns it over and reinserts it, and the endorsement
// is printed on that second pass — so the legend lands on the back, as intended.

export const RELAY_CHECK_READER_CODE = `// checkReader.js — MICR read + endorsement franking (Epson TM-H6000IV)
const net = require("net");

const BUILD = "check-reader-build 7 (slip paper 2 — ESC c 0 is a bitfield)";
const PRINTER_IPS = (process.env.PRINTER_IPS || "").split(",").filter(Boolean);
const PORT = Number(process.env.PRINTER_PORT || 9100);

const ESC = "\\x1b", FS = "\\x1c", GS = "\\x1d";
const INIT = ESC + "@";
const ALIGN_L = ESC + "a0", ALIGN_C = ESC + "a1";
const BOLD_ON = ESC + "E1", BOLD_OFF = ESC + "E0";
// ESC c 0 n selects the print station, and n is a BITFIELD, not a station number:
// bit0 (1) = receipt roll, bit1 (2) = slip / cheque station. So the slip station is
// n=2. n=4 sets an undefined bit, which the printer silently ignores — it stays on
// the roll, which is exactly why the endorsement kept coming out of the top.
const SLIP_PAPER = Number(process.env.SLIP_PAPER || 2);
const SEL_SLIP = ESC + "c0" + String.fromCharCode(SLIP_PAPER);
const SEL_RECEIPT = ESC + "c0\\x01";
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

// Endorsement legend for the BACK of the cheque — printed on the SECOND pass,
// after the operator has turned the sheet over and reinserted it.
function buildEndorsement(c) {
  const w = 40;
  const ctr = (s) => {
    const t = String(s == null ? "" : s).slice(0, w);
    return " ".repeat(Math.max(0, Math.floor((w - t.length) / 2))) + t + "\\n";
  };
  // The cheque was ejected after the MICR read so the operator could reverse it,
  // so this pass WAITS for the reinserted sheet (ESC f) rather than loading the
  // one already inside (FS a 1) — there is nothing inside at this point.
  //
  // The sequence below is byte-for-byte the one printer.js uses for a working slip
  // chit: ESC @ FIRST, then the paper-source select, then the insertion wait. Without
  // the leading ESC @ the printer is still in whatever state the MICR read left it in
  // and it ignores the slip select, which is why the endorsement came out on the
  // thermal roll. Ending with FF (print + eject the cut sheet) matches the slip path
  // too — FS a 2 belongs to a cheque loaded by FS a 1, not to a sheet taken with ESC f.
  let o = INIT + SEL_SLIP + WAIT_INSERT + ALIGN_L;
  o += BOLD_ON + ctr("FOR DEPOSIT ONLY") + BOLD_OFF;
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
  // Second pass: waits ~30s for the REVERSED cheque, prints the endorsement on the
  // back, then ejects. Called only after the POS has prompted the operator to turn
  // the cheque over.
  frankCheck: (c) => sendRaw(resolvePrinter(c.printer_ip), buildEndorsement(c)),
  // Release a cheque without printing anything (after the read, declined tender,
  // aborted read). This is what hands the sheet back for reversing.
  ejectCheck: (ip) => sendRaw(resolvePrinter(ip), EJECT_CHECK + SEL_RECEIPT),
  BUILD,
};
`;

// Routes mounted on the relay's Express app, next to /api/print.
export const RELAY_CHECK_ROUTES_CODE = `// server.js — cheque station routes (mount next to /api/print)
const checkReader = require("./checkReader");

// Which checkReader.js the relay is actually running. The receipt test print only
// reports printer.js's build, so a stale cheque module was invisible — this is how a
// technician confirms the endorsement fix is deployed.
app.get("/api/check/build", (req, res) => {
  res.json({ build: checkReader.BUILD });
});

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

// SECOND PASS. Waits for the operator to reinsert the cheque REVERSED, prints the
// endorsement on the back, then ejects. The printer has no endorsement (E/P) unit,
// so the back can only be reached by physically turning the sheet over.
app.post("/api/check/frank", async (req, res) => {
  try {
    await checkReader.frankCheck(req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Release the cheque unprinted — used after the MICR read so the operator can turn
// it over, and for declined / aborted tenders.
app.post("/api/check/eject", async (req, res) => {
  try {
    await checkReader.ejectCheck(req.body.printer_ip);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
`;