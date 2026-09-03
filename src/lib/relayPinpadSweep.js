// Relay-side RBA message-ID sweep — technician diagnosis only.
//
// Why this exists: the sale-flow tags in pinpad.js (W0, S0, I0…) were written before
// any iSC250 was on a bench and are now KNOWN WRONG. The pad's own frames give away
// the real shape — its unsolicited idle notification is "24.0" and the verified health
// check is "08.0" — so RBA message IDs are TWO DIGITS, a dot, then a subfield, not
// letter-pair tags. This sweep walks that ID space and records what the pad says.
//
// It is only meaningful because the transport is already proven: a NAK now means "that
// message ID is not it", not "your framing is broken". Before the framing was verified
// a sweep would have returned 100 identical silences and taught nothing.
//
// LIMIT OF THE METHOD: this maps WHICH message IDs the firmware answers. It does not
// reveal the field layout inside them. Building display and signature properly still
// needs the RBA Programmer's Guide for 08.5016.

export const RELAY_PINPAD_SWEEP_CODE = `// pinpadsweep.js — walk the RBA message-ID space and report what answers
const net = require("net");

const STX = "\\x02", ETX = "\\x03", ACK = "\\x06", NAK = "\\x15";
const CR = "\\x0d", PREFIX = "\\x08", SOH = "\\x01", RS = "\\x1e";

// Verified framing: 08 STX <body> CR ETX LRC, checksum over <body>+CR+ETX.
function lrc(s) { let a = 0; for (const c of s) a ^= c.charCodeAt(0); return String.fromCharCode(a); }
function frame(body) { const c = body + CR + ETX; return PREFIX + STX + c + lrc(c); }

const strip = (s) => s.replace(/\\x00+/g, "");
const hex = (s) => Array.from(s).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
const ascii = (s) => Array.from(s).map((c) => { const b = c.charCodeAt(0); return b >= 32 && b < 127 ? c : "."; }).join("");

// Message IDs that must NEVER be sent blind. Some RBA messages reboot the terminal,
// reset configuration, or drop it into a download/maintenance mode that needs a
// physical recovery. A sweep that bricks a pad to find a display command is a bad trade.
// Callers may override with allow_dangerous, but the default refuses.
const DANGEROUS = ["09", "10", "11", "13", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49",
                   "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"];

// One probe. Resolves with a verdict rather than throwing, so a sweep never aborts
// halfway and leaves the technician with a partial picture they might mistake for whole.
function probeOne(ip, port, id, waitMs) {
  const body = id + ".0";
  const out = frame(body);
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let buf = "", done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.destroy(); } catch (e) {}
      const clean = strip(buf);
      // A pad that answers only padding said nothing at all.
      let verdict = "silent";
      if (clean === SOH + ACK || clean === ACK) verdict = "ack";
      else if (clean === SOH + NAK || clean === NAK) verdict = "nak";
      else if (clean.includes(RS) || clean.length > 2) verdict = "reply";
      resolve({
        message_id: body,
        verdict,
        reply_bytes: clean.length,
        reply_ascii: ascii(clean).slice(0, 300),
        reply_hex: hex(clean).slice(0, 600),
      });
    };
    const timer = setTimeout(finish, waitMs);
    sock.once("error", (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ message_id: body, verdict: "error", error: e.message });
    });
    sock.on("data", (d) => {
      buf += d.toString("binary");
      // An ACK on its own may be followed by a data frame, so never settle on the
      // first chunk — that is exactly what hid the pad's real answer before.
      if (strip(buf).includes(ETX)) setTimeout(finish, 250);
    });
    sock.connect(port, ip, () => sock.write(Buffer.from(out, "binary")));
  });
}

// Sequential by design: two frames in flight on one pad interleave replies and the
// results become unattributable. Slow and correct beats fast and wrong here.
async function sweep({ pinpad_ip, port, from = 0, to = 99, wait_ms = 700, allow_dangerous = false, ids }) {
  if (!pinpad_ip) throw new Error("pinpad_ip is required");
  const target = port || Number(process.env.PINPAD_PORT || 12000);

  const list = ids && ids.length
    ? ids.map((v) => String(v).padStart(2, "0"))
    : Array.from({ length: to - from + 1 }, (_, i) => String(from + i).padStart(2, "0"));

  const results = [], skipped = [];
  for (const id of list) {
    if (!allow_dangerous && DANGEROUS.includes(id)) { skipped.push(id + ".0"); continue; }
    results.push(await probeOne(pinpad_ip, target, id, wait_ms));
  }

  const answered = results.filter((r) => r.verdict === "reply" || r.verdict === "ack");
  return {
    pinpad_ip,
    port: target,
    probed: results.length,
    skipped_dangerous: skipped,
    answered_ids: answered.map((r) => r.message_id),
    summary: {
      reply: results.filter((r) => r.verdict === "reply").length,
      ack: results.filter((r) => r.verdict === "ack").length,
      nak: results.filter((r) => r.verdict === "nak").length,
      silent: results.filter((r) => r.verdict === "silent").length,
      error: results.filter((r) => r.verdict === "error").length,
    },
    results,
  };
}

module.exports = { sweep, probeOne, DANGEROUS };
`;

export const RELAY_PINPAD_SWEEP_ROUTE_CODE = `// server.js — add beside the other pinpad routes
const pinpadsweep = require("./pinpadsweep");

// Long-running by nature: 100 ids x 700ms is over a minute, so give it its own timeout.
app.post("/api/pinpad/sweep", async (req, res) => {
  req.setTimeout(300000);
  try { res.json({ ok: true, ...(await pinpadsweep.sweep(req.body || {})) }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});
`;

// The IDs worth reading first once a sweep comes back — grounded in what the pad has
// already told us, not in guesswork.
export const SWEEP_KNOWN_IDS = [
  { id: "08.0", meaning: "Status / identity request", status: "verified on 08.5016 — returns version, model, serial, OK" },
  { id: "24.0", meaning: "Screen display — the pad's own idle notification", status: "observed unsolicited from the pad; the display family almost certainly lives here" },
];