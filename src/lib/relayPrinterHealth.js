// Relay-side printer HEALTH support, delivered as copyable code in the
// Technical Documentation.
//
// Rides the exact same one-byte real-time status mechanism the drawer read uses —
// the readStatus() socket added for DLE EOT 2 is reused as-is. Three more DLE EOT
// probes give the printer's own condition:
//   DLE EOT 1 (10 04 01) — printer status: bit 3 (0x08) set = OFFLINE.
//   DLE EOT 3 (10 04 03) — error status: bit 3 (0x08) cutter error,
//                          bits 5/6 (0x60) recoverable/unrecoverable error.
//   DLE EOT 4 (10 04 04) — roll paper sensor: bits 2/3 (0x0C) paper NEAR-END (low),
//                          bits 5/6 (0x60) paper END (out).
//
// Any probe that gets no answer reports the whole read as unreachable — the POS
// shows nothing rather than guessing, and a dead printer NIC never fabricates
// a "paper out" prompt.

export const RELAY_PRINTER_HEALTH_PRINTER_CODE = `// printer.js — ADD these blocks (printer health read)
// Requires the readStatus() helper from the drawer status install.

// 1) Near DLE_EOT_DRAWER:
const DLE_EOT_PRINTER = Buffer.from([0x10, 0x04, 0x01]); // offline bit
const DLE_EOT_ERROR   = Buffer.from([0x10, 0x04, 0x03]); // cutter / error bits
const DLE_EOT_PAPER   = Buffer.from([0x10, 0x04, 0x04]); // roll paper sensor

// 2) Add to module.exports, beside drawerStatus:
  printerHealth: async (ip) => {
    const target = resolvePrinter(ip);
    // Sequential on purpose — the TM printers answer real-time status one request
    // at a time, and three short round-trips still complete well under a second.
    const p = await readStatus(target, DLE_EOT_PRINTER);
    if (p === null) return { reachable: false };
    const e = await readStatus(target, DLE_EOT_ERROR);
    const r = await readStatus(target, DLE_EOT_PAPER);
    return {
      reachable: true,
      online: (p & 0x08) === 0,
      error: e === null ? false : (e & 0x68) !== 0,
      paper_low: r === null ? false : (r & 0x0c) !== 0,
      paper_out: r === null ? false : (r & 0x60) !== 0,
      raw: { printer: p, error: e, paper: r },
    };
  },
`;

export const RELAY_PRINTER_HEALTH_ROUTE_CODE = `// api.js — ADD this route beside POST /drawer/status

// The printer's own condition: online/offline, error, paper low, paper out.
// Polled slowly by the POS for the operator prompt line and carried up on the
// lane heartbeat for the portal's register card.
router.post("/printer/health", async (req, res) => {
  try {
    res.json({ ok: true, ...(await printer.printerHealth((req.body || {}).printer_ip)) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
`;

export const RELAY_PRINTER_HEALTH_VERIFY = `# Syntax gate, then restart.
node --check /opt/sureflow-relay/printer.js && node --check /opt/sureflow-relay/api.js
sudo systemctl restart sureflow-relay

# Healthy printer, roll fitted:
curl -s -X POST http://localhost:3000/api/printer/health \\
  -H 'Content-Type: application/json' -d '{"printer_ip":"192.168.1.60"}'
# expect: {"ok":true,"reachable":true,"online":true,"error":false,"paper_low":false,"paper_out":false,...}

# Prove each SENSOR, not just the route:
# 1. Open the printer cover  -> online:false   (cover open forces the printer offline)
# 2. Pull the roll out       -> paper_out:true
# 3. Fit a nearly-empty roll -> paper_low:true (near-end sensor; adjust its lever if it never trips)

# Unreachable printer must come back {"ok":true,"reachable":false} — never a fake status.
`;