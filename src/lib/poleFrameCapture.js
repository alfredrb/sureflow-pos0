// Pole display frame-capture helper.
//
// The IBM and Toshiba 2×20 poles are reserved profiles for one reason: nobody has
// the IBM/ADX byte frames they answer to. This helper records them from a live
// unit instead of hand-decoding a manual.
//
// How it works: the pole is driven by a known-good controller (the original 4690
// register, or the printer chain it normally hangs on) while the capture module
// listens on the same line and records every byte. Frames are separated by a 600ms
// quiet period — the same settle logic the cheque reader already uses, because
// these devices send no terminator the listener can rely on.
//
// The operator triggers one action at a time (clear, write line 1, write line 2,
// idle); each becomes one recorded frame, and the module emits a ready-to-paste
// frame() body for the relay pole module.

export const CAPTURE_QUIET_MS = 600;

export const POLE_CAPTURE_CODE = `// polecapture.js — records IBM/ADX pole frames from a live unit
const net = require("net");

const QUIET_MS = ${CAPTURE_QUIET_MS};   // frame boundary: this long with no bytes = frame done
const sessions = new Map();             // capture_id -> { label, frames, socket, timer, buf }

const hex = (buf) => Array.from(buf).map((b) => "\\\\x" + b.toString(16).padStart(2, "0")).join("");
const printable = (buf) =>
  Array.from(buf).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");

// Open the pole's line and record whatever the driving controller sends.
// address = lane_ip:9101 for a USB pole behind the lane serial bridge,
//           printer_ip:9100 for a pole on the 4610/4820 RS-485 chain.
function start({ capture_id, label, ip, port }) {
  if (sessions.has(capture_id)) throw new Error("Capture already running: " + capture_id);

  const s = { label: label || capture_id, frames: [], buf: [], timer: null, socket: null };
  const settle = () => {
    if (!s.buf.length) return;
    const buf = Buffer.from(s.buf);
    s.frames.push({ bytes: hex(buf), ascii: printable(buf), length: buf.length, at: new Date().toISOString() });
    s.buf = [];
  };

  const sock = new net.Socket();
  sock.on("data", (chunk) => {
    for (const b of chunk) s.buf.push(b);
    clearTimeout(s.timer);
    s.timer = setTimeout(settle, QUIET_MS);   // quiet period closes the frame
  });
  sock.on("error", (e) => { s.error = e.message; });
  sock.connect(port, ip);

  s.socket = sock;
  sessions.set(capture_id, s);
  return { capture_id, listening: ip + ":" + port };
}

function status(capture_id) {
  const s = sessions.get(capture_id);
  if (!s) throw new Error("No such capture: " + capture_id);
  return { label: s.label, frame_count: s.frames.length, frames: s.frames, error: s.error || null };
}

// Stop recording and emit a frame() body for the relay pole module. The recorded
// frames are laid out in the order the technician triggered them, so the clear /
// line-1 / line-2 prefixes can be read straight off the captured bytes.
function stop({ capture_id, profile_key, baud, chain_address }) {
  const s = sessions.get(capture_id);
  if (!s) throw new Error("No such capture: " + capture_id);
  clearTimeout(s.timer);
  try { s.socket.destroy(); } catch (_) {}
  sessions.delete(capture_id);

  const lines = s.frames.map((f, i) => "  // frame " + (i + 1) + ' ("' + f.ascii + '") ' + f.length + " bytes\\n" +
    '  //   "' + f.bytes + '"');

  return {
    profile_key,
    baud: baud || 9600,
    chain_address: chain_address || null,
    frame_count: s.frames.length,
    frames: s.frames,
    // Paste this into PROFILES[profile_key] in poledisplay.js, replacing the
    // placeholder strings with the captured prefixes above.
    frame_body:
      "  " + profile_key + ": {\\n" +
      "    port: DEFAULT_PORT,\\n" +
      (chain_address ? "    address: " + JSON.stringify(chain_address) + ",\\n" : "") +
      "    frame(lines) {\\n" +
      "      // captured " + s.frames.length + " frame(s) from a live unit:\\n" +
      lines.join("\\n") + "\\n" +
      "      const CLEAR = \\"\\";     // <- captured clear frame\\n" +
      "      const LINE1 = \\"\\";     // <- captured line-1 position frame\\n" +
      "      const LINE2 = \\"\\";     // <- captured line-2 position frame\\n" +
      "      return CLEAR + LINE1 + pad(lines[0]) + LINE2 + pad(lines[1]);\\n" +
      "    },\\n" +
      "  },",
  };
}

module.exports = { start, status, stop };
`;

export const POLE_CAPTURE_ROUTES_CODE = `// server.js — pole capture routes (technician use only)
const capture = require("./polecapture");

app.post("/api/pole/capture/start",  (req, res) => {
  try { res.json(capture.start(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("/api/pole/capture/status", (req, res) => {
  try { res.json(capture.status(req.query.capture_id)); } catch (e) { res.status(404).json({ error: e.message }); }
});
app.post("/api/pole/capture/stop",  (req, res) => {
  try { res.json(capture.stop(req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});
`;

// Technician procedure. Deliberately ordered so the pole is never driven by both
// the capture listener and the relay at the same time.
export const POLE_CAPTURE_STEPS = [
  {
    step: "1 — Note the pole's electrical identity",
    detail:
      "USB pole: confirm it enumerates as a serial device (ls -l /dev/serial/by-id/) and note the baud printed on the " +
      "label — almost always 9600 8N1. RS-485 chain pole: read the chain ADDRESS off the rotary/DIP switch on the " +
      "unit. Every captured frame encodes that address, so a wrong address means correct bytes that never arrive.",
  },
  {
    step: "2 — Take the lane out of service",
    detail:
      "Set the register's pole model to blank while capturing. If the relay is also writing display updates, the " +
      "capture records the relay's own frames mixed with the ones you want.",
  },
  {
    step: "3 — Start the capture",
    detail:
      "POST /api/pole/capture/start with a capture_id and the pole's address — lane_ip:9101 for a USB pole behind " +
      "the serial bridge, printer_ip:9100 for a chain pole. The listener records silently until you stop it.",
  },
  {
    step: "4 — Trigger one action at a time",
    detail:
      "Drive the pole from the known-good controller in this order, pausing about a second between each: clear the " +
      "display, write a distinctive string to line 1 (e.g. AAAAAAAAAAAAAAAAAAAA), write a different string to line 2 " +
      "(BBBB…), then show the idle/welcome screen. The 600ms quiet period turns each action into its own frame.",
  },
  {
    step: "5 — Stop and read the frames",
    detail:
      "POST /api/pole/capture/stop with the profile_key, baud and chain_address. The response holds every recorded " +
      "frame as hex plus its printable form — the A's and B's mark exactly where the payload sits, so the bytes " +
      "before them are the clear and cursor-position prefixes.",
  },
  {
    step: "6 — Fill in the profile and enable it",
    detail:
      "Paste the returned frame_body into PROFILES in poledisplay.js, move the captured prefixes into CLEAR / LINE1 / " +
      "LINE2, then flip the profile's supported flag. Re-assign the pole model on the register and ring an item to " +
      "confirm both lines render.",
  },
  {
    step: "7 — If the frames arrive but nothing displays",
    detail:
      "USB pole: wrong baud produces garbage glyphs rather than silence — correct the connector line in " +
      "/etc/ser2net.yaml. RS-485 pole: silence usually means an unterminated bus or a mismatched chain address. " +
      "Termination resistors belong at both physical ends of the bus; a single pole on a straight RJ45 normally " +
      "terminates inside the printer port, but a longer chain with an unterminated end returns nothing at all.",
  },
];