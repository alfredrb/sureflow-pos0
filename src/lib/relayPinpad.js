// Relay-side Ingenico pinpad module, delivered as copyable code in the Technical
// Documentation. The pad is just another LAN peripheral the relay brokers, like the
// receipt printer and the cheque station: the POS posts an intent, the relay speaks
// the model's protocol, and blocking calls hold the socket open while the customer
// signs, keys a number, or taps a rating.
//
// Everything model-specific lives in PROFILES. Adding the Lane/7000 means adding a
// PROFILES entry (its Terminal API frames) — the routes and the POS stay untouched.

export const RELAY_PINPAD_CODE = `// pinpad.js — Ingenico customer-facing pinpad (signature, prompts, entry, rating)
const net = require("net");

const BUILD = "pinpad-build 2";
const DEFAULT_PORT = Number(process.env.PINPAD_PORT || 12000);

const SOH = "\\x01", STX = "\\x02", ETX = "\\x03", ACK = "\\x06", NAK = "\\x15";
const CR = "\\x0d", PREFIX = "\\x08", RS = "\\x1e", FS = "\\x1c";

// LRC over the frame body, as Ingenico's serial framing expects.
function lrc(body) {
  let acc = 0;
  for (const ch of body) acc ^= ch.charCodeAt(0);
  return String.fromCharCode(acc);
}

// VERIFIED on iSC250 / RBA Retail Base 08.5016 (bench-confirmed, not inferred):
//   host -> pad:  08 STX <data> CR ETX LRC
// The 0x08 prefix sits OUTSIDE the checksum; the LRC covers <data> + CR + ETX.
// Proof: the pad's own idle frame 08 02 "24.0" 0d 03 16 checksums exactly, and the
// health check 08 02 "08.0" 0d 03 18 was ACKed, while the same frame WITHOUT the
// prefix+CR was NAKed. Both omissions were separate faults in the old builder.
function frame(body) {
  const checked = body + CR + ETX;
  return PREFIX + STX + checked + lrc(checked);
}

// The pad ACKs/NAKs at the link layer with SOH + ACK|NAK, and sends data packets as
// RS + STX <fields, FS-separated> ETX LRC. It RETRIES an unacknowledged packet, so the
// host MUST answer every inbound data packet with SOH ACK or the pad floods and times out.
const linkAck = () => SOH + ACK;
const isLinkAck = (s) => s === SOH + ACK || s === ACK;
const isLinkNak = (s) => s === SOH + NAK || s === NAK;

// Splits a stream into complete pad data packets, dropping the link bytes.
function dataPackets(buf) {
  return buf.split(RS).slice(1).map((p) => p.replace(/^\\x02/, "").replace(/\\x03[\\s\\S]*$/, "")).filter(Boolean);
}

// ── Model command profiles ────────────────────────────────────────────────────
// Each profile turns a POS intent into one or more frames, and parses the reply.
// A profile may also be sourced from the Hardware Library (pinpad_commands JSON)
// so a model can be tuned without redeploying the relay.
const PROFILES = {
  isc250: {
    port: DEFAULT_PORT,
    // Screen control
    // Health check / identity — VERIFIED against a live pad. Returns the RBA
    // application version, model, serials, build date and status.
    status:     () => frame("08.0"),
    // NOTE: the commands below are NOT yet verified against RBA 08.5016. The framing
    // they are wrapped in now IS correct, so a NAK from here means the command tag is
    // wrong (fix from the RBA Programmer's Guide for 08.5016), not the transport.
    clear:      () => frame("W0"),
    display:    (p) => frame("W1" + [p.title || "", ...(p.lines || [])].join("|").slice(0, 240)),
    cart:       (p) => frame("W2" + [
                    "ITEMS " + (p.item_count || 0),
                    ...(p.lines || []).map(l => (l.qty > 1 ? l.qty + "x " : "") + l.name + "  " + l.amount),
                    "SUBTOTAL " + p.subtotal,
                    "TAX " + p.tax,
                    "TOTAL " + p.total,
                  ].join("|").slice(0, 480)),
    // Blocking interactions
    signature:  (p) => frame("S0" + (p.title || "PLEASE SIGN")),
    input:      (p) => frame("I0" + (p.max_length || 24) + "|" + (p.title || "ENTER NUMBER")),
    confirm:    (p) => frame("C0" + (p.amount || "0.00")),
    rating:     (p) => frame("R0" + (p.title || "HOW WAS YOUR VISIT?")),
    cancel:     () => frame("X0"),
    // Replies arrive as STX <tag> <payload> ETX LRC. Signature payload is the
    // pad's bitmap, base64 encoded by the pad firmware.
    parse(raw) {
      const packets = dataPackets(raw);
      const body = packets.length ? packets[0] : raw.replace(/^\\x02/, "").replace(/\\x03[\\s\\S]*$/, "");
      // Identity / health reply: FS-separated fields opening with the 08.5 response id.
      if (body.startsWith("08.5")) {
        const f = body.split(FS);
        return {
          status_reply: true,
          rba_version: f[0],
          model: f[6] || "",
          board_serial: f[7] || "",
          fields: f,
        };
      }
      const tag = body.slice(0, 2);
      const payload = body.slice(2);
      if (tag === "SR") return { image_base64: payload, format: "png" };
      if (tag === "IR") return { value: payload.replace(/[^0-9]/g, "") };
      if (tag === "CR") return { approved: payload.trim() === "1" };
      if (tag === "RR") return { rating: Number(payload.trim()) || null };
      if (tag === "XR" || payload === "CANCEL") return { cancelled: true };
      return { raw: payload };
    },
  },

  // Lane/7000 (Tetra) — reserved. Its display and signature primitives go through
  // Ingenico's Terminal API rather than these raw frames, so the POS treats this
  // profile as unsupported until the block below is filled in.
  lane_7000: null,
};

function profileFor(key) {
  const p = PROFILES[key];
  if (!p) throw new Error("Pinpad profile not supported on this relay: " + key);
  return p;
}
function resolveIp(ip) {
  if (!ip) throw new Error("No pinpad IP configured for this lane");
  return ip;
}

// Fire-and-forget write — screen updates never block the lane.
function send(ip, port, payload) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(5000);
    sock.once("error", reject);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("Pinpad timeout at " + ip)); });
    sock.connect(port, ip, () => sock.end(Buffer.from(payload, "binary"), () => resolve(true)));
  });
}

// Request/response — hold the socket open while the customer acts on the pad.
// Like the cheque reader, the pad streams and then stops, so the read settles on a
// quiet period rather than a terminator.
function ask(ip, port, payload, profile, timeoutMs) {
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
    const timer = setTimeout(() => {
      try { sock.write(Buffer.from(profile.cancel(), "binary")); } catch (e) {}
      finish(reject, new Error("Customer did not respond on the pinpad"));
    }, timeoutMs);

    sock.once("error", (e) => finish(reject, e));
    sock.on("data", (d) => {
      buf += d.toString("binary");
      if (isLinkAck(buf)) { buf = ""; return; }        // command accepted, keep waiting
      if (isLinkNak(buf)) return finish(reject, new Error("Pinpad rejected the command"));
      // Acknowledge inbound data at the link layer, or the pad retries the packet.
      if (buf.includes(RS) && buf.includes(ETX)) {
        try { sock.write(Buffer.from(linkAck(), "binary")); } catch (e) {}
      }
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        const out = profile.parse(buf);
        if (out.cancelled) return finish(reject, new Error("Cancelled on the pinpad"));
        finish(resolve, { ...out, build: BUILD });
      }, 400);
    });
    sock.connect(port, target, () => sock.write(Buffer.from(payload, "binary")));
  });
}

module.exports = {
  BUILD,
  status:    (b) => { const p = profileFor(b.profile); return ask(b.pinpad_ip, p.port, p.status(), p, 8000); },
  clear:     (b) => { const p = profileFor(b.profile); return send(resolveIp(b.pinpad_ip), p.port, p.clear()); },
  display:   (b) => { const p = profileFor(b.profile); return send(resolveIp(b.pinpad_ip), p.port, p.display(b)); },
  cart:      (b) => { const p = profileFor(b.profile); return send(resolveIp(b.pinpad_ip), p.port, p.cart(b)); },
  cancel:    (b) => { const p = profileFor(b.profile); return send(resolveIp(b.pinpad_ip), p.port, p.cancel()); },
  signature: (b) => { const p = profileFor(b.profile); return ask(b.pinpad_ip, p.port, p.signature(b), p, 85000); },
  input:     (b) => { const p = profileFor(b.profile); return ask(b.pinpad_ip, p.port, p.input(b), p, 85000); },
  confirm:   (b) => { const p = profileFor(b.profile); return ask(b.pinpad_ip, p.port, p.confirm(b), p, 85000); },
  rating:    (b) => { const p = profileFor(b.profile); return ask(b.pinpad_ip, p.port, p.rating(b), p, 40000); },
};
`;

// Raw frame probe — technician use only, and the ONLY honest way to find this pad's
// real command set. Everything in PROFILES above was written speculatively before any
// iSC250 was on a bench; a live test then showed the pad ignores it completely. Rather
// than guess another tag letter per 85-second timeout, this sends arbitrary bytes and
// reports whatever comes back.
//
// Wrapper bytes are applied to match the pad's OWN frames, which are the only ground
// truth we have. A captured idle frame reads:
//     01 08 02 32 34 2e 30 08 03 13
//     ^report ^wrap ^STX  "24.0"  ^wrap ^ETX ^LRC
// so 0x08 sits before STX and before ETX, and the LRC covers the body INCLUDING the
// trailing 0x08 (verified: XOR of "24.0" + 0x08 + ETX = 0x13). frame() above omits both
// 0x08 bytes, which is the leading suspect for the pad's silence.
export const RELAY_PINPAD_RAW_CODE = `// pinpadraw.js — send arbitrary frames to a pinpad and report the reply
const net = require("net");

const STX = "\\x02", ETX = "\\x03", WRAP = "\\x08";

function lrc(body) {
  let acc = 0;
  for (const ch of body) acc ^= ch.charCodeAt(0);
  return String.fromCharCode(acc);
}

// wrap=true reproduces the pad's own framing exactly (0x08 either side).
// wrap=false reproduces the relay's current framing, for an A/B comparison.
function build(payload, wrap) {
  const body = wrap ? WRAP + payload + WRAP : payload;
  return STX + body + ETX + lrc(body + ETX);
}

const hex = (s) => Array.from(s).map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");
const ascii = (s) => Array.from(s).map((c) => { const b = c.charCodeAt(0); return b >= 32 && b < 127 ? c : "."; }).join("");

// Holds the socket open and returns EVERYTHING the pad says, unparsed — no profile,
// no tag assumptions. Silence is itself a result and is reported as such.
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
      resolve({
        sent_hex: hex(out),
        sent_ascii: ascii(out),
        replied: buf.length > 0,
        reply_hex: hex(buf),
        reply_ascii: ascii(buf),
        reply_bytes: buf.length,
        // The three outcomes that actually distinguish the hypotheses.
        verdict: buf.length === 0 ? "SILENT — pad could not parse the frame (framing suspect)"
          : buf === "\\x15" ? "NAK — framing understood, command content refused (tag suspect)"
          : buf === "\\x06" ? "ACK — framing and command both accepted"
          : "REPLY — pad answered with data, see reply_ascii",
      });
    };
    // Deliberately NOT closing on first data: a screen-change notification may follow
    // an ACK as a second frame, and half-closing early is exactly what hid the pad's
    // answer on the fire-and-forget routes.
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
for (const [route, fn] of [["cart", "cart"], ["display", "display"], ["clear", "clear"], ["cancel", "cancel"]]) {
  app.post("/api/pinpad/" + route, async (req, res) => {
    try { await pinpad[fn](req.body || {}); res.json({ ok: true }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });
}

// Blocking customer interactions. The POS calls these with long client timeouts
// and shows its own "look at the pinpad" prompt while they run.
for (const route of ["status", "signature", "input", "confirm", "rating"]) {
  app.post("/api/pinpad/" + route, async (req, res) => {
    try { const out = await pinpad[route](req.body || {}); res.json({ ok: true, ...out }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });
}
`;

export const RELAY_PINPAD_ENV_CODE = `# .env — add alongside PRINTER_IPS
# TCP port the Ingenico pads listen on (iSC250 default when set to Ethernet)
PINPAD_PORT=12000
`;