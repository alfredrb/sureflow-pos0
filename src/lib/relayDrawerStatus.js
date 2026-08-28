// Relay-side cash drawer STATUS support, delivered as copyable code in the
// Technical Documentation.
//
// The drawer open command (ESC p) already goes out through printer.js. This adds the
// other direction: asking the printer whether the drawer is currently open, using the
// ESC/POS real-time status command DLE EOT 2 (bytes 10 04 02). The printer answers with
// one status byte whose bit 2 (0x04) carries the DK port's drawer-sense line.
//
// Why this works on the fleet's hardware: the IBM/Toshiba SDL drawer pinout wires
// pin 2 = open signal, pin 3 = open/close status sense, pin 4 = ground. Pin 3 is the
// reed switch, and the TM-H6000IV reports it back on this very byte.

export const RELAY_DRAWER_STATUS_PRINTER_CODE = `// printer.js — ADD these two blocks (drawer status read)

// 1) Near the other ESC/POS constants, beside KICK:
//
// ESC/POS real-time status. DLE EOT 2 asks the DRAWER KICK port sense line.
// Bit 2 (0x04) of the reply is the drawer-sense pin: set = drawer OPEN.
const DLE_EOT_DRAWER = Buffer.from([0x10, 0x04, 0x02]);

// 2) A request/RESPONSE socket. sendRaw only writes and resolves on flush, so it
//    cannot be reused here — this one waits for the printer's status byte.
//    A printer that never answers resolves as null, which the caller reports as
//    "unknown". It must NEVER be reported as open: an unreachable printer would
//    then block the lane from selling.
function readStatus(ip, request, timeout = 2500) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (v) => { if (!done) { done = true; sock.destroy(); resolve(v); } };
    sock.setTimeout(timeout);
    sock.once("connect", () => sock.write(request));
    sock.once("data", (buf) => finish(buf[buf.length - 1]));
    sock.once("error", () => finish(null));
    sock.once("timeout", () => finish(null));
    sock.connect(PORT, ip);
  });
}

// 3) Add to module.exports, beside openDrawer:
  drawerStatus: async (ip) => {
    const byte = await readStatus(resolvePrinter(ip), DLE_EOT_DRAWER);
    if (byte === null) return { open: null, reachable: false };
    return { open: (byte & 0x04) !== 0, reachable: true, raw: byte };
  },
`;

export const RELAY_DRAWER_STATUS_ROUTE_CODE = `// api.js — ADD this route directly under the existing POST /drawer

// Is the cash drawer open right now? Polled by the POS after a cash sale so the
// lane can hold the next transaction until the drawer is closed, and read by the
// portal for the live drawer badge.
// open:null = the printer did not answer, reported to the POS as "unknown" so a
// dead printer never blocks selling.
router.post("/drawer/status", async (req, res) => {
  try {
    res.json({ ok: true, ...(await printer.drawerStatus((req.body || {}).printer_ip)) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
`;

export const RELAY_DRAWER_STATUS_VERIFY = `# 1. Syntax gate before restarting — never restart on an unparseable file.
node --check /opt/sureflow-relay/printer.js
node --check /opt/sureflow-relay/api.js

sudo systemctl restart sureflow-relay

# 2. JSON back = the route is mounted ABOVE the SPA catch-all (correct).
#    HTML back = it landed below the catch-all and the POS will read "unknown" forever.
curl -s -X POST http://localhost:3000/api/drawer/status \\
  -H 'Content-Type: application/json' -d '{"printer_ip":"192.168.1.60"}'
# drawer closed -> {"ok":true,"open":false,"reachable":true,"raw":22}
# drawer open   -> {"ok":true,"open":true,"reachable":true,"raw":26}

# 3. Prove the SENSOR, not just the route: pull the drawer open by hand and re-run.
#    'open' must flip. If it never flips, the drawer's sense pin (pin 3 on the SDL
#    pinout) is not wired through the DK cable — swap the cable before touching code.

# 4. Unreachable printer must report open:null, not open:true.
curl -s -X POST http://localhost:3000/api/drawer/status \\
  -H 'Content-Type: application/json' -d '{"printer_ip":"192.168.1.199"}'
# expect: {"ok":true,"open":null,"reachable":false}
`;