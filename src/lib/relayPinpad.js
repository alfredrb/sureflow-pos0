// Relay-side Ingenico pinpad module, delivered as copyable code in the Technical
// Documentation. The pad is just another LAN peripheral the relay brokers, like the
// receipt printer and the cheque station: the POS posts an intent, the relay speaks
// the model's protocol, and blocking calls hold the socket open while the customer
// signs, keys a number, or taps a rating.
//
// BUILD 5 — the command set is now the REAL one, taken from the Ingenico Telium RBA
// Developer's Guide DIV350779 Rev 17.6 (chapter 6.2 Host Interface Messages), cross-checked
// against Bluefin's published RBA payload captures from live iSC250 hardware.
//
// Builds 1-4 carried invented tags (W0/W1/W2/S0/I0/C0/R0/X0) written before any pad was on
// a bench. They were fiction: RBA message IDs are TWO DIGITS + '.' + data, which is why the
// pad ignored every sale-flow command while still answering 08.0. Those tags are gone.
//
// The transport underneath is UNCHANGED and stays bench-verified on REG-091.

export const RELAY_PINPAD_CODE = `// pinpad.js — Ingenico RBA customer-facing pinpad (signature, prompts, entry, rating)
const net = require("net");

const BUILD = "pinpad-build 6 (RBA DIV350779 Rev 17.6, RS continuation fix)";
const DEFAULT_PORT = Number(process.env.PINPAD_PORT || 12000);

const SOH = "\\x01", STX = "\\x02", ETX = "\\x03", ACK = "\\x06", NAK = "\\x15";
const CR = "\\x0d", PREFIX = "\\x08", RS = "\\x1e", FS = "\\x1c", GS = "\\x1d", DC1 = "\\x11";

// ── Transport (verified on REG-091 — do not change) ───────────────────────────
// RBA framing per the guide: STX + <3-char message id> + data + ETX + LRC, where the LRC
// is the XOR of every byte except STX, INCLUDING ETX. Max message length 247 bytes.
// The 0x08 prefix and CR are this fleet's HID-bridge additions, bench-proven: the pad's own
// idle frame (08 02 "24.0" 0d 03 16) checksums exactly this way, 08.0 sent WITH them was
// ACKed and the same frame without them was NAKed.
function lrc(body) {
  let acc = 0;
  for (const ch of body) acc ^= ch.charCodeAt(0);
  return String.fromCharCode(acc);
}
function frame(body) {
  if (body.length > 240) throw new Error("RBA message exceeds the 247-byte limit: " + body.slice(0, 40) + "...");
  const checked = body + CR + ETX;
  return PREFIX + STX + checked + lrc(checked);
}

// The pad ACKs/NAKs at the link layer and RETRIES an unacknowledged data packet, so the host
// MUST answer every inbound data packet or the pad floods and times out.
const linkAck = () => SOH + ACK;
const isLinkAck = (s) => s === SOH + ACK || s === ACK;
const isLinkNak = (s) => s === SOH + NAK || s === NAK;

// A USB pad reached through the lane's HID bridge arrives PADDED: every report is zero-filled
// to its fixed length. Those bytes are transport padding, never protocol, and must be stripped
// before anything else looks at the stream — otherwise a silent pad reports success.
const strip = (s) => s.replace(/\\x00+/g, "");

// Splits a stream into complete pad data packets, dropping link bytes and framing.
//
// A reply is one or more FRAMES (STX ... CR ETX LRC). Inside a single frame, RS separates
// CONTINUATION RECORDS of the SAME message: the iSC250 identity spans four of them, and only
// the first carries the '08.' id. Splitting on RS and then keeping only records that start
// with an id therefore discarded the model, board serial, app name and status — which is
// exactly why /status reported an empty model from a pad that had sent everything. Split on
// frame boundaries instead and fold RS into FS, so every record survives as a field.
function packets(buf) {
  return strip(buf)
    .split(STX)
    .slice(1)
    .map((f) => f.replace(/[\\x0d]?\\x03[\\s\\S]*$/, "").split(RS).join(FS))
    .filter((p) => /^[0-9]{2}\\./.test(p));
}
const msgId = (p) => p.slice(0, 3);

// ── RBA messages (guide chapter 6.2) ─────────────────────────────────────────
// Text that begins with a digit is read by the pad as a PROMPT INDEX, not literal text, so a
// leading DC1 (Ctrl/Q) is required to force literal display. Guide 6.2.28.8.
const literal = (t) => (/^[0-9]/.test(String(t)) ? DC1 + t : String(t));

const M = {
  // 08.0 Health Stat — VERIFIED on this fleet's RBA 08.5016.
  status:   () => frame("08.0"),
  // 11.0 Status Request — the poll that carries an on-demand response back. 11.01 also
  // appends the current form name, which is what makes a stuck pad diagnosable.
  poll:     () => frame("11.01"),
  // 15.8 Soft Reset — clear the line-item (scrolling receipt) display only.
  clearCart: () => frame("15.8"),
  // 15.6 Soft Reset — Stop Action: cancels the process an on-demand message started.
  stop:     () => frame("15.6"),
  // 10.x Hard Reset — clears the transaction and returns the pad to its start screen.
  reset:    () => frame("10.1"),
  // 24.x Form Entry (on-demand) — display a form and override its text elements.
  // 'offline.K3Z' + T1 is the guide's own recipe for putting a line of text on the idle screen.
  form:     (p) => frame("24." + (p.form || "offline.K3Z") +
                     [""].concat((p.lines || [p.title]).filter(Boolean).slice(0, 6)
                       .map((t, i) => "T" + (i + 1) + "," + literal(t))).join(FS)),
  // 28.x Set Variable — response type 9 = don't answer (fire-and-forget screen writes).
  setVar:   (id, data, wantReply) =>
                   frame("28." + (wantReply ? "1" : "9") + "0" + String(id).padStart(6, "0") + data),
  // 29.x Get Variable — how signature blocks are retrieved.
  getVar:   (id) => frame("29.00" + String(id).padStart(6, "0")),
  // 20.x Signature (on-demand). Prompt 165 = "Please sign and tap Ok with pen".
  signature: (p) => frame("20." + (p.prompt || "165") + FS + (p.form || "SIGN.K3Z")),
  // 21.x Numeric Input (on-demand). display char 0 = show digits; min/max are 2 digits each.
  input:    (p) => frame("21.0" + String(p.min_length || 1).padStart(2, "0") +
                     String(p.max_length || 24).padStart(2, "0") + (p.prompt || literal(p.title || "ENTER NUMBER")) +
                     FS + (p.format || "") + FS + (p.form || "")),
  // 37.x Rating. Timeout is in TENTHS of a second. Rate-limited by the pad: consecutive
  // requests come back 37.2 (security violation).
  rating:   (p) => frame("37." + (p.form || "SURQUES.K3Z") + FS +
                     String(Math.round((p.timeout_ms || 30000) / 100)) + FS + literal(p.title || "HOW WAS YOUR VISIT?")),
};

// Line display / digital receipt variables (guide 6.2.32): 111-119 write a specific line,
// 120 the bottom line, 104 appends and scrolls. This IS the pad's cart mirror — no custom
// form needed, which is why the old W2 "multi-line cart" tag was never necessary.
const LINE_VARS = [111, 112, 113, 114, 115, 116];
const BOTTOM_VAR = 120;

// ── Response parsing ─────────────────────────────────────────────────────────
function parseStatus(list) {
  // Identity spans THREE RS-delimited packets on RBA 08.5016 (version, model/serial,
  // app/date/status), so fields must be assembled across all of them.
  const body = list.join(FS).replace(/[\\x19]/g, "");
  const f = body.replace(/^08\\./, "").split(FS).map((s) => s.trim()).filter(Boolean);
  const model = f.find((v) => /^(iSC|iPP|Lane|iUC|iUP|iWL)/i.test(v)) || "";
  const mi = f.indexOf(model);
  return {
    status_reply: true,
    rba_version: f[0],
    model,
    board_serial: mi >= 0 ? (f[mi + 1] || "") : "",
    app_name: f.find((v) => /^Retail/i.test(v)) || "",
    pad_status: f.includes("OK") ? "OK" : "",
    fields: f,
  };
}

// 11.x Status Response: 11.<2-digit state><display text>[FS]<form name>
const POLL_STATE = {
  "00": "offline", "01": "slide_card", "02": "transaction_type", "03": "enter_pin", "04": "amount",
  "05": "processing", "06": "approved_declined", "07": "barcode", "10": "please_sign",
  "11": "signature_accepted", "12": "input_capture", "13": "data_available", "14": "select_language",
  "15": "advertising", "16": "menu", "17": "textbox", "18": "emv", "19": "wic", "20": "smart_card",
  "21": "barcode_bulk", "22": "signature_cancelled", "99": "idle",
};
function parsePoll(p) {
  const rest = p.slice(3);
  const [text, form] = rest.slice(2).split(FS);
  return { code: rest.slice(0, 2), state: POLL_STATE[rest.slice(0, 2)] || "unknown", text: (text || "").trim(), form: (form || "").trim() };
}

// ── Socket helpers ───────────────────────────────────────────────────────────
function resolveIp(ip) {
  if (!ip) throw new Error("No pinpad IP configured for this lane");
  return ip;
}

// Fire-and-forget write — screen updates never hold up the lane.
function send(ip, port, payloads) {
  const list = [].concat(payloads);
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(5000);
    sock.once("error", reject);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("Pinpad timeout at " + ip)); });
    sock.connect(port, resolveIp(ip), () => {
      // Written back to back on one connection: the pad processes them in order and each is
      // ACKed at the link layer, so a six-line cart is one round trip rather than six.
      sock.end(Buffer.from(list.join(""), "binary"), () => resolve(true));
    });
  });
}

// Request → ACK → POLL. This is the real RBA on-demand flow (guide 6.1.3 / 6.2.4.3): the pad
// ACKs the request immediately, and the actual NN.x response is delivered when the host polls
// 11.x — it is NOT guaranteed to arrive unsolicited. Builds 1-4 waited on one silent socket
// for 85 seconds instead, which is why even a correct command would have looked dead.
function interact({ pinpad_ip, port, request, expect, timeout_ms = 85000, poll_ms = 600 }) {
  const target = resolveIp(pinpad_ip);
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = "", done = false, poller = null, last = null;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearInterval(poller);
      try { sock.end(); } catch (e) {}
      fn(arg);
    };
    const timer = setTimeout(() => {
      try { sock.write(Buffer.from(M.stop(), "binary")); } catch (e) {}
      finish(reject, new Error("Customer did not respond on the pinpad" +
        (last ? " (pad was on '" + last.state + "'" + (last.form ? " / " + last.form : "") + "')" : "")));
    }, timeout_ms);

    sock.once("error", (e) => finish(reject, e));
    sock.on("data", (d) => {
      const chunk = strip(d.toString("binary"));
      if (!chunk) return;                                  // HID padding only
      buf += chunk;
      if (isLinkNak(buf)) return finish(reject, new Error("Pinpad rejected the command (NAK) — check the message format"));
      if (isLinkAck(buf)) { buf = ""; return; }             // accepted, keep polling
      const list = packets(buf);
      if (!list.length) return;
      buf = "";
      try { sock.write(Buffer.from(linkAck(), "binary")); } catch (e) {}

      const hits = list.filter((p) => msgId(p) === expect);
      const polls = list.filter((p) => msgId(p) === "11.");
      if (polls.length) last = parsePoll(polls[polls.length - 1]);
      if (hits.length) finish(resolve, { packets: list, body: hits[hits.length - 1], poll: last });
      // 00.x means the pad dropped offline mid-request — no amount of polling recovers it.
      if (list.some((p) => msgId(p) === "00.")) finish(reject, new Error("Pad went offline during the request"));
    });

    sock.connect(port, target, () => {
      sock.write(Buffer.from(request, "binary"));
      poller = setInterval(() => {
        try { sock.write(Buffer.from(M.poll(), "binary")); } catch (e) {}
      }, poll_ms);
    });
  });
}

// One short request/response pair (health check, Get Variable) — no polling needed.
function askOnce(ip, port, request, expect, timeout_ms, silentMsg) {
  const target = resolveIp(ip);
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = "", done = false, quiet = null;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(quiet);
      try { sock.end(); } catch (e) {}
      fn(arg);
    };
    const timer = setTimeout(() => finish(reject, new Error(silentMsg || "Pad did not answer")), timeout_ms || 8000);
    sock.once("error", (e) => finish(reject, e));
    sock.on("data", (d) => {
      const chunk = strip(d.toString("binary"));
      if (!chunk) return;
      buf += chunk;
      if (isLinkNak(buf)) return finish(reject, new Error("Pinpad rejected the command (NAK)"));
      if (isLinkAck(buf)) { buf = ""; return; }
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        const list = packets(buf);
        if (!list.length) return finish(reject, new Error(silentMsg || "Pad returned no RBA packet"));
        try { sock.write(Buffer.from(linkAck(), "binary")); } catch (e) {}
        finish(resolve, list.filter((p) => msgId(p) === expect).length ? list : list);
      }, 400);
    });
    sock.connect(port, target, () => sock.write(Buffer.from(request, "binary")));
  });
}

// 29.x Get Variable — response is 29.<status><pad><6-digit id><data>.
async function getVar(ip, port, id) {
  const list = await askOnce(ip, port, M.getVar(id), "29.", 8000, "Pad did not answer the Get Variable request");
  const p = list.find((x) => msgId(x) === "29.");
  if (!p) return null;
  return { status: p[3], id: p.slice(5, 11), data: p.slice(11) };
}

// ── Public API (route shape unchanged, so the POS contract is untouched) ──────
const portOf = (b) => Number(b.port || DEFAULT_PORT);

module.exports = {
  BUILD,

  status: async (b) => {
    const list = await askOnce(b.pinpad_ip, portOf(b), M.status(), "08.", 8000,
      "Pad did not answer the 08.0 health check — reachable but not speaking RBA on this frame");
    const s = list.filter((p) => msgId(p) === "08.");
    return { ...parseStatus(s.length ? s : list), build: BUILD };
  },

  // Where the pad is right now, and on which form. The single most useful diagnostic:
  // 'offline / OFFLINE.K3Z' with text "This Lane Closed" is prompt 173 — the pad's normal
  // idle state, NOT a fault, and it does not stop on-demand messages from working.
  where: async (b) => {
    const list = await askOnce(b.pinpad_ip, portOf(b), M.poll(), "11.", 8000, "Pad did not answer the 11.x status request");
    const p = list.find((x) => msgId(x) === "11.");
    return { ...(p ? parsePoll(p) : {}), build: BUILD };
  },

  // Idle text on the pad's own offline form.
  display: (b) => send(b.pinpad_ip, portOf(b), M.form(b)),

  // Cart mirror through the pad's built-in line display. Lines first, total pinned to the
  // bottom line, all in one connection.
  cart: (b) => {
    const lines = (b.lines || []).slice(-LINE_VARS.length);
    const writes = lines.map((l, i) =>
      M.setVar(LINE_VARS[i], ((l.qty > 1 ? l.qty + "x " : "") + l.name).slice(0, 28).padEnd(30) + String(l.amount).padStart(9)));
    while (writes.length < LINE_VARS.length) writes.push(M.setVar(LINE_VARS[writes.length], ""));
    writes.push(M.setVar(BOTTOM_VAR, "TOTAL".padEnd(30) + String(b.total).padStart(9)));
    return send(b.pinpad_ip, portOf(b), writes);
  },

  clear:  (b) => send(b.pinpad_ip, portOf(b), M.clearCart()),
  cancel: (b) => send(b.pinpad_ip, portOf(b), M.stop()),
  reset:  (b) => send(b.pinpad_ip, portOf(b), M.reset()),

  // 20.x → response 20.0<blocks>; the drawing itself lives in variables 700-709 and is
  // fetched with 29.x. Format is Appendix A three-byte ASCII coordinates, NOT a bitmap:
  // the relay returns the blocks joined and the POS renders them.
  signature: async (b) => {
    const out = await interact({ pinpad_ip: b.pinpad_ip, port: portOf(b), request: M.signature(b), expect: "20.", timeout_ms: b.timeout_ms || 85000 });
    const status = out.body[3];
    if (status === "1") throw new Error("Signature interrupted on the pinpad");
    if (status === "6") throw new Error("Pad rejected the signature prompt/form (20.6) — check the prompt index and that SIGN.K3Z exists");
    if (status !== "0") throw new Error("Signature failed on the pinpad (20." + status + ")");

    const size = await getVar(b.pinpad_ip, portOf(b), 712);
    const blocks = Math.min(Number((size && size.data) || out.body.slice(4) || 1) || 1, 10);
    const parts = [];
    for (let i = 0; i < blocks; i++) {
      const v = await getVar(b.pinpad_ip, portOf(b), 700 + i);
      if (v && v.data) parts.push(v.data);
    }
    return { signature_ascii: parts.join(""), format: "rba_3byte_ascii", blocks, build: BUILD };
  },

  // 21.x → response 21.<exit type><data>.
  input: async (b) => {
    const out = await interact({ pinpad_ip: b.pinpad_ip, port: portOf(b), request: M.input(b), expect: "21.", timeout_ms: b.timeout_ms || 85000 });
    const exit = out.body[3];
    if (exit === "1") throw new Error("Cancelled on the pinpad");
    if (exit !== "0") throw new Error("Pad refused the input request (21." + exit + ")");
    return { value: out.body.slice(4).replace(/[^0-9]/g, ""), build: BUILD };
  },

  // Amount approval is a FORM with Accept / Decline buttons (24.x), not its own message.
  // Response 24.<exit type><key id>; the button the customer pressed comes back as the key.
  confirm: async (b) => {
    const out = await interact({
      pinpad_ip: b.pinpad_ip, port: portOf(b),
      request: M.form({ form: b.form || "ACCEPT.K3Z", lines: b.lines || [b.title || ("AMOUNT OK? " + (b.amount || "0.00"))] }),
      expect: "24.", timeout_ms: b.timeout_ms || 85000,
    });
    const exit = out.body[3];
    if (exit === "8") throw new Error("Amount approval timed out on the pinpad");
    if (exit !== "0") throw new Error("Pad refused the approval form (24." + exit + ")");
    const key = out.body.slice(4, 5);
    return { approved: key !== "B", key, build: BUILD };
  },

  // 37.x → response 37.<result><key>. Result 2 is the pad's own rate limit, not a fault.
  rating: async (b) => {
    const out = await interact({ pinpad_ip: b.pinpad_ip, port: portOf(b), request: M.rating(b), expect: "37.", timeout_ms: b.timeout_ms || 40000 });
    const result = out.body[3];
    if (result === "2") throw new Error("Rating asked again too soon — the pad rate-limits consecutive 37.x requests");
    if (result === "8") throw new Error("Rating timed out on the pinpad");
    if (result !== "0") throw new Error("Pad refused the rating form (37." + result + ")");
    const key = out.body.slice(4).trim();
    const n = Number(key);
    return { rating: n >= 1 && n <= 5 ? n : null, key, build: BUILD };
  },
};
`;

// Raw frame probe — technician use only. Still valuable with the guide in hand: it is how a
// single message is tried by hand, byte for byte, before it goes into pinpad.js.
export const RELAY_PINPAD_RAW_CODE = `// pinpadraw.js — send arbitrary frames to a pinpad and report the reply
const net = require("net");

const STX = "\\x02", ETX = "\\x03", WRAP = "\\x08", CR = "\\x0d";

function lrc(body) {
  let acc = 0;
  for (const ch of body) acc ^= ch.charCodeAt(0);
  return String.fromCharCode(acc);
}

// wrap=true reproduces this fleet's bench-verified HID framing (0x08 prefix, CR before ETX).
// wrap=false is canonical RBA per the guide (STX + body + ETX + LRC) for an A/B comparison.
function build(payload, wrap) {
  if (wrap) {
    const checked = payload + CR + ETX;
    return WRAP + STX + checked + lrc(checked);
  }
  return STX + payload + ETX + lrc(payload + ETX);
}

const hex = (s) => Array.from(s).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
const ascii = (s) => Array.from(s).map((c) => { const b = c.charCodeAt(0); return b >= 32 && b < 127 ? c : "."; }).join("");

// Holds the socket open and returns EVERYTHING the pad says, unparsed. Silence is itself a
// result and is reported as such.
function probe({ pinpad_ip, port, payload, raw_hex, wrap = true, timeout_ms = 8000 }) {
  if (!pinpad_ip) throw new Error("pinpad_ip is required");
  const out = raw_hex
    ? raw_hex.trim().split(/[\\s,]+/).map((h) => String.fromCharCode(parseInt(h, 16))).join("")
    : build(payload || "", wrap);

  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = "", done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.destroy(); } catch (e) {}
      const clean = buf.replace(/\\x00+/g, "");
      resolve({
        sent_hex: hex(out),
        sent_ascii: ascii(out),
        replied: clean.length > 0,
        reply_hex: hex(clean),
        reply_ascii: ascii(clean),
        reply_bytes: clean.length,
        verdict: clean.length === 0 ? "SILENT — pad could not parse the frame (framing suspect)"
          : clean === "\\x15" || clean === "\\x01\\x15" ? "NAK — framing understood, message content refused (message id or fields suspect)"
          : clean === "\\x06" || clean === "\\x01\\x06" ? "ACK — framing and message both accepted (poll 11.01 for the response)"
          : "REPLY — pad answered with data, see reply_ascii",
      });
    };
    // Deliberately NOT closing on first data: an ACK is often followed by a separate data frame.
    const timer = setTimeout(finish, timeout_ms);
    sock.once("error", (e) => { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    sock.on("data", (d) => { buf += d.toString("binary"); });
    sock.connect(port || Number(process.env.PINPAD_PORT || 12000), pinpad_ip, () => {
      sock.write(Buffer.from(out, "binary"));
    });
  });
}

module.exports = { probe, build, lrc };
`;

export const RELAY_PINPAD_ROUTES_CODE = `// server.js — pinpad routes (mount next to /api/check/*)
const pinpad = require("./pinpad");
const pinpadraw = require("./pinpadraw");

// Raw probe — technician diagnosis. Returns the pad's reply verbatim plus a verdict.
app.post("/api/pinpad/raw", async (req, res) => {
  try { res.json({ ok: true, ...(await pinpadraw.probe(req.body || {})) }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

// Screen updates: never allowed to hold up the lane.
for (const fn of ["cart", "display", "clear", "cancel", "reset"]) {
  app.post("/api/pinpad/" + fn, async (req, res) => {
    try { await pinpad[fn](req.body || {}); res.json({ ok: true }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });
}

// Blocking customer interactions. The POS calls these with long client timeouts and shows its
// own "look at the pinpad" prompt while they run. 'where' is instant and tells you which form
// the pad is sitting on right now.
for (const route of ["status", "where", "signature", "input", "confirm", "rating"]) {
  app.post("/api/pinpad/" + route, async (req, res) => {
    req.setTimeout(120000);
    try { const out = await pinpad[route](req.body || {}); res.json({ ok: true, ...out }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });
}
`;

export const RELAY_PINPAD_ENV_CODE = `# .env — add alongside PRINTER_IPS
# TCP port the Ingenico pads listen on (iSC250 default when set to Ethernet, and the port the
# lane's HID/serial bridge publishes a USB pad on)
PINPAD_PORT=12000
`;

// The verified message map, rendered in the Technical Docs so a technician sees what replaced
// each invented tag without reading the module source.
export const RBA_MESSAGE_MAP = [
  { intent: "Health / identity", was: "08.0", now: "08.0 Health Stat", note: "Already verified on RBA 08.5016 — returns version, model, serial, OK." },
  { intent: "Where is the pad?", was: "—", now: "11.01 Status Request", note: "Returns the state code, on-screen text and the current form name. The one diagnostic worth running first." },
  { intent: "Show text", was: "W0 / W1", now: "24.x Form Entry", note: "24.offline.K3Z[FS]T1,<text> — the guide's own recipe. Text starting with a digit needs a DC1 prefix or it is read as a prompt index." },
  { intent: "Cart mirror", was: "W2", now: "28.x Set Variable, vars 111-116 + 120", note: "The pad's built-in line display / digital receipt. No custom form needed — this is what the pad was designed to do." },
  { intent: "Clear cart", was: "—", now: "15.8 Soft Reset", note: "Clears the line-item display without touching anything else." },
  { intent: "Signature", was: "S0", now: "20.x + 29.x vars 700-709 / 712", note: "20.165[FS]SIGN.K3Z; the drawing is fetched with Get Variable in Appendix A three-byte ASCII coordinates, not a bitmap." },
  { intent: "Numeric entry", was: "I0", now: "21.x Numeric Input", note: "Display char, 2-digit min, 2-digit max, then the prompt. Response 21.0<data>." },
  { intent: "Approve amount", was: "C0", now: "24.x Form Entry with buttons", note: "There is no dedicated approval message — it is a form whose Accept/Decline button comes back as the key id." },
  { intent: "Rating", was: "R0", now: "37.x Rating", note: "37.SURQUES.K3Z[FS]<tenths of a second>[FS]<question>. The pad rate-limits consecutive requests with 37.2." },
  { intent: "Cancel", was: "X0", now: "15.6 Stop Action / 10.x Hard Reset", note: "15.6 ends the on-demand process; 10.x clears the whole transaction." },
];