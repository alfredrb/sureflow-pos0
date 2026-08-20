// Relay-side pole display module, delivered as copyable code in the Technical
// Documentation. The DM-D110 has no address of its own — it hangs off the receipt
// printer's DM-D port, so the relay selects it THROUGH the printer (ESC = 2),
// writes the two display lines, and reselects the printer so receipts keep working.
//
// Everything model-specific lives in PROFILES. Adding the LD9900 means adding a
// PROFILES entry (its LCI frames) — the routes and the POS stay untouched.

export const RELAY_POLE_CODE = `// poledisplay.js — customer pole display (line display)
const net = require("net");

const BUILD = "pole-build 1";
const DEFAULT_PORT = Number(process.env.POLE_PORT || 9100);
const IDLE_LINE_1 = process.env.POLE_IDLE_LINE_1 || "*** WELCOME ***";
const IDLE_LINE_2 = process.env.POLE_IDLE_LINE_2 || "";

const ESC = "\\x1b", CLR = "\\x0c";
const COLS = 20;
const pad = (s) => String(s || "").slice(0, COLS).padEnd(COLS);

// ── Model command profiles ────────────────────────────────────────────────────
const PROFILES = {
  // Epson DM-D110 on the TM printer's DM-D port. ESC = n selects the peripheral:
  // 2 = customer display, 1 = printer. CLR (0x0C) clears the display; the two
  // padded 20-column rows then fill it exactly.
  epson_dmd110: {
    port: DEFAULT_PORT,
    frame(lines) {
      return (
        ESC + "=" + "\\x02" +                  // talk to the display
        CLR +
        pad(lines[0]) + pad(lines[1]) +
        ESC + "=" + "\\x01"                    // hand the port back to the printer
      );
    },
  },

  // IBM / Toshiba 2x20 poles on the 4610/4820 RS-485 device chain. These are NOT
  // Epson devices: they answer on a chain address with the IBM/ADX display
  // command set, so ESC = peripheral select does not reach them. Reserved until
  // the frames are captured from a live unit.
  ibm_4610_2x20: null,
  toshiba_4820_2x20: null,

  // Logic Controls LD9900 (LCI command set over a serial-device server) —
  // reserved. Fill in its frame() before enabling the profile on lanes.
  logic_ld9900: null,
};

function profileFor(key) {
  const p = PROFILES[key];
  if (!p) throw new Error("Pole display profile not supported on this relay: " + key);
  return p;
}

function resolveIp(ip) {
  // Pass-through poles ride the printer address; blank falls back to the
  // relay's default printer, same as receipt printing.
  return ip || (process.env.PRINTER_IPS || "").split(",")[0].trim();
}

// Fire-and-forget write — a display update never blocks the lane.
function send(ip, port, payload) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    sock.setTimeout(4000);
    sock.once("error", reject);
    sock.once("timeout", () => { sock.destroy(); reject(new Error("Pole display timeout at " + ip)); });
    sock.connect(port, ip, () => sock.end(Buffer.from(payload, "binary"), () => resolve(true)));
  });
}

module.exports = {
  BUILD,
  show(b) {
    const p = profileFor(b.profile);
    const lines = Array.isArray(b.lines) ? b.lines : [];
    return send(resolveIp(b.pole_ip), p.port, p.frame([lines[0] || "", lines[1] || ""]));
  },
  idle(b) {
    const p = profileFor(b.profile);
    return send(resolveIp(b.pole_ip), p.port, p.frame([IDLE_LINE_1, IDLE_LINE_2]));
  },
};
`;

export const RELAY_POLE_ROUTES_CODE = `// server.js — pole display routes (mount next to /api/pinpad/*)
const pole = require("./poledisplay");

for (const [route, fn] of [["show", "show"], ["idle", "idle"]]) {
  app.post("/api/pole/" + route, async (req, res) => {
    try { await pole[fn](req.body || {}); res.json({ ok: true }); }
    catch (e) { res.status(502).json({ error: e.message }); }
  });
}
`;

export const RELAY_POLE_ENV_CODE = `# .env — add alongside PRINTER_IPS
# Port pole display frames are written to (9100 = the printer port for
# DM-D110 pass-through, or the serial-device server port for direct poles)
POLE_PORT=9100
# Idle / welcome screen between customers (20 columns each)
POLE_IDLE_LINE_1=*** WELCOME ***
POLE_IDLE_LINE_2=
`;