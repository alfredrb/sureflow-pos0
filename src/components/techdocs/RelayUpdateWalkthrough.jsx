import React, { useState } from "react";
import { ChevronDown, ChevronRight, Rocket, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";

// Ordered upgrade walkthrough for an ALREADY-BUILT relay. This is not the first
// build (that is Relay Deployment) — it is the sequence for pushing everything
// added since: the two-pass cheque endorsement, the pinpad and pole display
// modules, and the lane-side USB serial / printer bridges.
const STEPS = [
  {
    title: "Snapshot the relay before touching it",
    blurb:
      "Take a Proxmox snapshot and keep a copy of the current app directory. Every step below is reversible if you can roll back the VM.",
    code: `# on the Proxmox host
qm snapshot <vmid> pre-update --description "before relay feature update"

# on the relay itself
sudo systemctl stop sureflow-relay
cp -a /opt/sureflow-relay /opt/sureflow-relay.bak.$(date +%F)`,
    filename: "relay shell",
  },
  {
    title: "Add the new environment values",
    blurb:
      "The new modules read their configuration from the same .env as the printer module. SLIP_PAPER=4 is the slip station — 2 prints on the receipt roll and is the classic mistake.",
    code: `sudo nano /opt/sureflow-relay/.env

PRINTER_IPS=192.168.1.60,192.168.1.61   # lane receipt printers (or lane IPs when USB-bridged)
SLIP_PAPER=4                            # cheque / slip station
CHECK_TIMEOUT_MS=30000                  # how long the printer waits for a sheet
PINPAD_PORT=12000                       # Ingenico, direct or via the lane serial bridge
POLE_PORT=9101                           # USB pole via the lane serial bridge
CLOUD_API_KEY=<paste from Infrastructure Command Center>`,
    filename: "/opt/sureflow-relay/.env",
  },
  {
    title: "Drop in the relay modules",
    blurb:
      "Copy each module out of its documentation tab (the Copy button on every code panel) into the relay app directory, next to printer.js. Nothing is compiled — these are plain Node files.",
    code: `cd /opt/sureflow-relay

# Cheque Station tab  -> checkReader.js   (must be check-reader-build 5)
# Customer Pinpad tab -> pinpad.js
# Pole Display tab    -> poleDisplay.js
nano checkReader.js
nano pinpad.js
nano poleDisplay.js

# confirm the cheque module is the two-pass build
grep -n "check-reader-build" checkReader.js`,
    filename: "relay shell",
  },
  {
    title: "Patch server.js with the new routes",
    blurb:
      "Mount the cheque, pinpad and pole routes AFTER the existing /api routes and BEFORE the static POS build and the SPA catch-all — the catch-all swallows anything registered below it. The Cheque Station tab also ships a complete server.js if you would rather replace the file wholesale.",
    code: `# routes to be present in server.js
POST /api/check/read      # pass 1 — arm the reader, return the MICR line
POST /api/check/frank     # pass 2 — wait for the reversed sheet, endorse the back
POST /api/check/eject     # release the sheet unprinted so it can be turned over
POST /api/pinpad/*        # display, signature capture, numeric entry, rating
POST /api/pole/*          # line display mirror

node --check server.js    # syntax gate before restarting`,
    filename: "/opt/sureflow-relay/server.js",
  },
  {
    title: "Restart and confirm the build stamps",
    blurb:
      "Each module logs its build stamp on boot. An old stamp means the old copy is still on disk — that lane keeps the previous single-pass cheque behaviour and will still print on the face of the cheque.",
    code: `sudo systemctl restart sureflow-relay
sudo systemctl status sureflow-relay --no-pager
journalctl -u sureflow-relay -n 40 --no-pager | grep -i build

curl -s http://localhost:3000/api/health | head`,
    filename: "relay shell",
  },
  {
    title: "Bring up the lane-side bridges (on each lane, not the relay)",
    blurb:
      "This is what makes the single-cable lane work: socat publishes the USB receipt printer on the lane's own IP:9100, and ser2net publishes a USB pinpad and pole on 12000 / 9101. The relay code is identical either way — only the IP it dials changes.",
    code: `# baked into the PXE image; verify on a booted lane
systemctl status sureflow-printer-bridge   # socat  usblp -> :9100
systemctl status sureflow-serial-bridge    # ser2net ttyUSB -> :12000 / :9101

# from the relay, prove the lane is reachable
nc -zv <lane-ip> 9100
nc -zv <lane-ip> 12000`,
    filename: "lane shell",
  },
  {
    title: "Point each register at the right addresses",
    blurb:
      "Registers → hardware profile. Ethernet transport uses the device's own IP; usb_bridge uses the LANE's IP. Always fill in the printer's Ethernet address as the fallback — the TM-H6000IV serves USB and Ethernet at the same time, so recovery is a paste, not a site visit.",
    code: `Printer transport : ethernet | usb_bridge
Printer IP        : printer's IP  (ethernet)   /  LANE's IP (usb_bridge)
Printer fallback  : printer's Ethernet IP      (always set this)
Pinpad model / IP : isc250  ->  pad's IP, or LANE's IP for a USB pad
Pole model / IP   : epson_dmd110 -> leave IP blank (routed via the printer)
                    toshiba_usb_2x20 -> LANE's IP`,
    filename: "Admin → Registers",
  },
  {
    title: "Verify at the lane",
    blurb:
      "Run these in order. The cheque test is the important one: pass 1 must eject a completely unprinted sheet, and the legend must land on the BACK after the reinsert prompt.",
    code: `1. Registers → Test Print              — receipt prints, drawer kicks.
2. Tender a sale on the pinpad          — prompts, cart mirror, signature, rating.
3. Pole display                         — items mirror while ringing, then total.
4. Cheque tender on a SCRAP cheque:
     - MICR line reads
     - cheque ejects with NOTHING printed on the face
     - POS shows "TURN THE CHEQUE OVER"
     - reinsert face-down -> legend prints on the BACK
5. Pull the lane's network cable        — paste the fallback IP, reprint.`,
    filename: "verification",
  },
];

export default function RelayUpdateWalkthrough() {
  const [open, setOpen] = useState(0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <Rocket className="h-5 w-5 text-blue-600" /> Relay Feature Update Walkthrough
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upgrade path for a relay that is already built and running. Pushes everything added since the original build:
          the two-pass cheque endorsement (check-reader-build 5), the pinpad and pole display modules, and the lane-side
          USB serial and printer bridges. For a brand-new store, do the Relay Deployment build first, then this.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Do this per store — each relay holds its own copy of the code. Until a relay is updated, that store's lanes keep
            the old single-pass cheque flow, which prints the endorsement legend on the FACE of the cheque.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {STEPS.map((s, i) => {
          const isOpen = open === i;
          return (
            <div key={s.title} className="border-b border-gray-50 last:border-0">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                  {i + 1}
                </span>
                <span className="flex-1 text-xs font-semibold text-gray-800">{s.title}</span>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <p className="mb-3 text-xs leading-relaxed text-gray-500">{s.blurb}</p>
                  <CodeBlock title={s.title} filename={s.filename} code={s.code} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}