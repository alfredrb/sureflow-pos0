import React, { useState } from "react";
import { ChevronDown, ChevronRight, Rocket, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { RELAY_CHECK_READER_CODE, RELAY_CHECK_ROUTES_CODE } from "@/lib/relayCheckReader";
import { RELAY_PINPAD_CODE, RELAY_PINPAD_ROUTES_CODE, RELAY_PINPAD_RAW_CODE } from "@/lib/relayPinpad";
import { RELAY_POLE_CODE, RELAY_POLE_ROUTES_CODE } from "@/lib/relayPoleDisplay";
import { RELAY_SERVER_COMPLETE_CODE, RELAY_SERVER_COMPLETE_VERIFY } from "@/lib/relayServerComplete";
import { PRINTER_BRIDGE_UDEV_RULES, PRINTER_BRIDGE_SYSTEMD_UNIT, PRINTER_BRIDGE_BUILD_STEPS, LANE_BRIDGE_PORT_MAP } from "@/lib/lanePrinterBridge";
import { BRIDGE_UDEV_RULES, BRIDGE_SER2NET_CONFIG, BRIDGE_SYSTEMD_UNIT, BRIDGE_BUILD_STEPS } from "@/lib/laneSerialBridge";
import { RELAY_LANE_REBOOT_CODE, RELAY_LANE_REBOOT_ROUTES_CODE, LANE_REBOOT_AGENT_CODE, LANE_REBOOT_AGENT_UNIT, LANE_REBOOT_AGENT_BUILD_STEPS, LANE_REBOOT_VERIFY } from "@/lib/relayLaneReboot";

// Ordered upgrade walkthrough for an ALREADY-BUILT relay. This is not the first
// build (that is Relay Deployment) — it is the sequence for pushing everything
// added since: the two-pass cheque endorsement, the pinpad and pole display
// modules, and the lane-side USB serial / printer bridges. Every module the
// technician has to paste is embedded here, so the walkthrough is self-contained.
const STEPS = [
  {
    title: "Snapshot the relay before touching it",
    blurb:
      "Take a Proxmox snapshot and keep a copy of the current app directory. Every step below is reversible if you can roll back the VM.",
    blocks: [
      {
        filename: "relay shell",
        code: `# on the Proxmox host
qm snapshot <vmid> pre-update --description "before relay feature update"

# on the relay itself
sudo systemctl stop sureflow-relay
cp -a /opt/sureflow-relay /opt/sureflow-relay.bak.$(date +%F)`,
      },
    ],
  },
  {
    title: "Add the new environment values",
    blurb:
      "The new modules read their configuration from the same .env as the printer module. SLIP_PAPER=4 is the slip station — 2 prints on the receipt roll and is the classic mistake. POLE_PORT stays 9100 because the DM-D110 is reached THROUGH the printer; only a USB pole uses the 9101 bridge port.",
    blocks: [
      {
        filename: "/opt/sureflow-relay/.env",
        code: `PRINTER_IPS=192.168.1.60,192.168.1.61   # lane receipt printers (or lane IPs when USB-bridged)
SLIP_PAPER=4                            # cheque / slip station
CHECK_TIMEOUT_MS=30000                  # how long the printer waits for a sheet

# Ingenico pinpad — direct on Ethernet, or via the lane serial bridge
PINPAD_PORT=12000

# Pole display — 9100 = through the printer (DM-D110 pass-through)
POLE_PORT=9100
POLE_BRIDGE_PORT=9101                   # USB pole, via the lane serial bridge
POLE_IDLE_LINE_1=*** WELCOME ***
POLE_IDLE_LINE_2=

CLOUD_API_KEY=<paste from Infrastructure Command Center>`,
      },
    ],
  },
  {
    title: "Paste in the relay modules",
    blurb:
      "Copy each file below into the relay app directory, next to printer.js. Nothing is compiled — these are plain Node files. checkReader.js is the important one this round: it must be check-reader-build 5, the two-pass endorsement build. Paste EVERY file here before the server.js in step 4: that server.js requires each of them at startup, and a single missing file crash-loops the relay and takes the whole store's lanes down — which is exactly what a missing polecapture.js already did at store 001.",
    blocks: [
      { title: "Cheque station — two-pass MICR read and endorsement", filename: "/opt/sureflow-relay/checkReader.js", code: RELAY_CHECK_READER_CODE },
      { title: "Ingenico pinpad — signature, prompts, cart mirror, rating", filename: "/opt/sureflow-relay/pinpad.js", code: RELAY_PINPAD_CODE },
      { title: "Pinpad raw frame probe — technician diagnosis, required by the complete server.js", filename: "/opt/sureflow-relay/pinpadraw.js", code: RELAY_PINPAD_RAW_CODE },
      { title: "Pole display — customer line display", filename: "/opt/sureflow-relay/poledisplay.js", code: RELAY_POLE_CODE },
    ],
    after: `cd /opt/sureflow-relay && grep -n "check-reader-build" checkReader.js`,
  },
  {
    title: "Patch server.js with the new routes",
    blurb:
      "Mount these AFTER the existing /api routes and BEFORE the static POS build and the SPA catch-all — the catch-all swallows anything registered below it, and a swallowed route returns the POS index.html instead of JSON, which looks exactly like a missing endpoint. Easiest path: skip the three patches and drop in the COMPLETE server.js, which already has the cheque, pinpad, pole AND lane-reboot routes mounted in the correct order. Every module it requires must exist on disk first (step 3 plus laneReboot.js from step 8) or the relay will not boot.",
    blocks: [
      { title: "Complete server.js — RECOMMENDED, replaces all three patches below", filename: "/opt/sureflow-relay/server.js", code: RELAY_SERVER_COMPLETE_CODE },
      { title: "Cheque routes — read, frank (second pass), eject", filename: "server.js (patch)", code: RELAY_CHECK_ROUTES_CODE },
      { title: "Pinpad routes", filename: "server.js (patch)", code: RELAY_PINPAD_ROUTES_CODE },
      { title: "Pole display routes", filename: "server.js (patch)", code: RELAY_POLE_ROUTES_CODE },
    ],
    after: RELAY_SERVER_COMPLETE_VERIFY,
  },
  {
    title: "Restart and confirm the build stamps",
    blurb:
      "Each module logs its build stamp on boot. An old stamp means the old copy is still on disk — that lane keeps the previous single-pass cheque behaviour and will still print the endorsement on the FACE of the cheque.",
    blocks: [
      {
        filename: "relay shell",
        code: `sudo systemctl restart sureflow-relay
sudo systemctl status sureflow-relay --no-pager
journalctl -u sureflow-relay -n 40 --no-pager | grep -i build
# expect: check-reader-build 5, pinpad-build 1, pole-build 1

curl -s http://localhost:3000/api/health | head`,
      },
    ],
  },
  {
    title: "Bring up the lane bridges (on the lane image, not the relay)",
    blurb:
      "This is what makes the single-cable lane work: socat publishes the USB receipt printer on the lane's own IP:9100, and ser2net publishes a USB pinpad on 12000 and a USB pole on 9101. The relay code is identical either way — only the IP it dials changes. These files are baked into the diskless image at build time, inside the chroot.",
    blocks: [
      { title: "USB printer bridge — udev rules", filename: "/etc/udev/rules.d/61-sureflow-printer.rules", code: PRINTER_BRIDGE_UDEV_RULES },
      { title: "USB printer bridge — systemd unit", filename: "/etc/systemd/system/sureflow-printer-bridge.service", code: PRINTER_BRIDGE_SYSTEMD_UNIT },
      { title: "USB printer bridge — image build steps", filename: "sureflow-build-image (chroot)", code: PRINTER_BRIDGE_BUILD_STEPS },
      { title: "Serial bridge — udev rules", filename: "/etc/udev/rules.d/60-sureflow-serial.rules", code: BRIDGE_UDEV_RULES },
      { title: "Serial bridge — ser2net config", filename: "/etc/ser2net.yaml", code: BRIDGE_SER2NET_CONFIG },
      { title: "Serial bridge — systemd unit", filename: "/etc/systemd/system/sureflow-serial-bridge.service", code: BRIDGE_SYSTEMD_UNIT },
      { title: "Serial bridge — image build steps", filename: "sureflow-build-image (chroot)", code: BRIDGE_BUILD_STEPS },
    ],
    after: `# from the relay, prove the lane is reachable
nc -zv <lane-ip> 9100    # printer
nc -zv <lane-ip> 12000   # pinpad
nc -zv <lane-ip> 9101    # pole`,
  },
  {
    title: "Point each register at the right addresses",
    blurb:
      "Registers → hardware profile. Ethernet transport uses the device's own IP; usb_bridge uses the LANE's IP. Always fill in the printer's Ethernet address as the fallback — the TM-H6000IV serves USB and Ethernet at the same time, so recovery is a paste, not a site visit.",
    blocks: [
      {
        filename: "Admin → Registers",
        code: `Printer transport : ethernet | usb_bridge
Printer IP        : printer's IP  (ethernet)   /  LANE's IP (usb_bridge)
Printer fallback  : printer's Ethernet IP      (always set this)
Pinpad model / IP : isc250  ->  pad's IP, or LANE's IP for a USB pad
Pole model / IP   : epson_dmd110 -> leave IP blank (routed via the printer)
                    toshiba_usb_2x20 -> LANE's IP`,
      },
    ],
  },
  {
    title: "Enable lane reboot (POS Help menu + remote reboot)",
    blurb:
      "The lanes sit on the isolated PXE VLAN behind the controller's NAT, so nothing can open a connection INTO a lane — no SSH, no HTTP — and the relay only ever sees the controller's address, which is why IP detection reports 10.0.40.10 instead of the lane. So the direction is reversed: the relay holds a queue of pending reboots keyed by REGISTER ID (the identity the lane reads from its own kernel command line), and a small agent on the lane polls for it outbound, which is the direction that always works. The same agent listens on the lane's loopback so the POS button reboots instantly without touching the network at all.",
    blocks: [
      { title: "Relay — pending reboot queue", filename: "/opt/sureflow-relay/laneReboot.js", code: RELAY_LANE_REBOOT_CODE },
      { title: "Relay — queue + claim routes (already included in the complete server.js in step 4)", filename: "server.js (patch)", code: RELAY_LANE_REBOOT_ROUTES_CODE },
      { title: "Lane agent — loopback endpoint + outbound poll", filename: "/usr/local/bin/sureflow-lane-agent", code: LANE_REBOOT_AGENT_CODE },
      { title: "Lane agent — systemd unit", filename: "/etc/systemd/system/sureflow-lane-agent.service", code: LANE_REBOOT_AGENT_UNIT },
      { title: "Lane agent — image build steps", filename: "PXE controller (chroot)", code: LANE_REBOOT_AGENT_BUILD_STEPS },
      { title: "Verify both directions", filename: "lane + relay shell", code: LANE_REBOOT_VERIFY },
    ],
    after: `sudo systemctl restart sureflow-relay
journalctl -u sureflow-relay -n 20 --no-pager | grep -i lane-reboot   # expect: lane-reboot-build 2

# POS: HELP -> Reboot Lane, or hold the version line on the login screen -> Reboot Lane.
# Admin: Infrastructure Command Center -> Register Hardware -> Reboot Lane.`,
  },
  {
    title: "Verify at the lane",
    blurb:
      "Run these in order. The cheque test is the important one: pass 1 must eject a completely unprinted sheet, and the legend must land on the BACK after the reinsert prompt.",
    blocks: [
      {
        filename: "verification",
        code: `1. Registers -> Test Print              — receipt prints, drawer kicks.
2. Tender a sale on the pinpad          — prompts, cart mirror, signature, rating.
3. Pole display                         — items mirror while ringing, then total.
4. Return path (catches a bad bridge):
     printf '\\x10\\x04\\x01' | nc -w2 <lane-ip> 9100 | od -c
     — one status byte must come back, or MICR reads will time out.
5. Cheque tender on a SCRAP cheque:
     - MICR line reads
     - cheque ejects with NOTHING printed on the face
     - POS shows "TURN THE CHEQUE OVER"
     - reinsert face-down -> legend prints on the BACK
6. Pull the lane's network cable        — paste the fallback IP, reprint.`,
      },
    ],
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
          Upgrade path for a relay that is already built and running, with every module embedded ready to copy. Pushes
          everything added since the original build: the two-pass cheque endorsement (check-reader-build 5), the pinpad and
          pole display modules, and the lane-side USB serial and printer bridges. For a brand-new store, do the Relay
          Deployment build first, then this.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Do this per store — each relay holds its own copy of the code. Until a relay is updated, that store's lanes keep
            the old single-pass cheque flow, which prints the endorsement legend on the FACE of the cheque.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANE_BRIDGE_PORT_MAP.map((p) => (
            <span key={p.port} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
              <span className="font-mono font-semibold text-gray-800">{p.port}</span> · {p.device} · {p.transport}
            </span>
          ))}
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
                <span className="text-[10px] text-gray-400">{s.blocks.length} file{s.blocks.length > 1 ? "s" : ""}</span>
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
              </button>
              {isOpen && (
                <div className="space-y-3 px-5 pb-5">
                  <p className="text-xs leading-relaxed text-gray-500">{s.blurb}</p>
                  {s.blocks.map((b, bi) => (
                    <CodeBlock key={bi} title={b.title || s.title} filename={b.filename} code={b.code} />
                  ))}
                  {s.after && <CodeBlock title="Then confirm" filename="relay shell" code={s.after} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}