// Lane HID pinpad bridge.
//
// WHY THIS EXISTS. The Ingenico iSC250 (0b00:0074) is a PURE HID DEVICE on the
// firmware our fleet ships with. Verified on a live lane:
//
//   bNumInterfaces      1
//   bInterfaceClass     3 Human Interface Device
//   hid-generic 0003:0B00:0074.0001: hiddev0,hidraw0
//
// There is no ttyACM, no ttyUSB, and /dev/serial/by-id does not exist. So NO udev
// tty rule and NO usbserial bind can ever produce /dev/sureflow-pinpad — the tty
// rule's vendor ID was never the problem, the device simply has no serial
// interface to name. ser2net still bound port 12000 happily over that missing
// device, so the relay CONNECTED and then failed every write with "Device open
// failure": silent, and identical to unplugged hardware at the POS.
//
// This is the same trap the Toshiba USB pole hit, and the fix is the same shape:
// put a translator on the lane that turns the HID device into something the
// relay's existing TCP write already speaks. The pole borrowed the vendor's vsd
// driver; the pad has no such driver, so we bridge /dev/hidraw* directly.
//
// The relay and the POS are UNCHANGED: the bridge owns the same port 12000 the
// pinpad module already writes to, and the register's pinpad_ip stays the LANE's
// own LAN IP.

export const HID_PINPAD_PORT = 12000;

// hidraw needs its own rule — a tty rule cannot match a hidraw device. Keyed on
// the Ingenico vendor id so any iSC250 in the fleet is picked up.
export const HID_PINPAD_UDEV_RULES = `# /etc/udev/rules.d/62-sureflow-pinpad-hid.rules
# HID-class pinpads. The iSC250 presents ONLY a HID interface, so it appears as
# /dev/hidraw* and never as a tty — this is the rule that gives it a stable name.
KERNEL=="hidraw*", ATTRS{idVendor}=="0b00", SYMLINK+="sureflow-pinpad-hid", MODE="0660", GROUP="dialout"
`;

// Deliberately dependency-free node: the lane image already carries nodejs for
// the lane agent, and a read-only root cannot npm install anything.
export const HID_PINPAD_BRIDGE_CODE = `#!/usr/bin/env node
// sureflow-pinpad-bridge — publishes a HID-class pinpad on TCP so the relay's
// existing socket write reaches a device that has no serial port and no LAN
// address of its own.
//
// Accepts one connection at a time (the relay opens, writes, reads, closes).
// A serial pad still wins if one is ever fitted: /dev/sureflow-pinpad is
// preferred over the hidraw node, so this bridge serves both kinds of pad and
// the fleet keeps ONE pinpad port.
"use strict";

const net = require("net");
const fs = require("fs");

const PORT = Number(process.env.PINPAD_BRIDGE_PORT || ${HID_PINPAD_PORT});
const TTY_DEV = "/dev/sureflow-pinpad";      // serial pad, if one is ever fitted
const HID_DEV = "/dev/sureflow-pinpad-hid";  // the iSC250's hidraw node
// HID transfers are FIXED SIZE. Writing a short buffer to hidraw returns EINVAL
// on most devices, so outbound frames are zero-padded up to the report size and
// split across reports when longer. 64 is the iSC250's interrupt endpoint size;
// override per store if a different pad turns up.
const REPORT = Number(process.env.PINPAD_REPORT_SIZE || 64);
// HID REPORT ID. This is byte 0 of every hidraw transfer and is NOT part of the
// message. The pad's own frames arrive as:
//     01 08 02 32 34 2e 30 08 03 13
//     ^^ report id
// so writes must carry the SAME leading 0x01 or the kernel delivers them as a
// report the pad does not have and it discards them before parsing anything.
// That is what made every command silent under BOTH RBA and relay framing: the
// framing A/B was decided one layer below where it was being tested.
const REPORT_ID = Number(process.env.PINPAD_REPORT_ID || 1);
// WHAT BYTE 0 ACTUALLY MEANS is the open question, and RBA does not answer it —
// RBA defines the message, not how it is chunked into fixed 64-byte reports.
// Three possibilities, so the bridge can be told which rather than assuming:
//   report_id = byte 0 is a HID report id (0x01). The original assumption.
//   length    = byte 0 is the COUNT OF DATA BYTES in this report. Under this
//               scheme a 0x01 prefix declares a 1-byte message, so the pad reads
//               only the STX and discards the command — silent, exactly as seen.
//   raw       = no prefix at all; the message starts at byte 0.
const FRAME_MODE = process.env.PINPAD_FRAME_MODE || "report_id";

function log(msg) {
  process.stdout.write("[pinpad-bridge] " + msg + "\\n");
}

function devicePath() {
  if (fs.existsSync(TTY_DEV)) return { path: TTY_DEV, hid: false };
  if (fs.existsSync(HID_DEV)) return { path: HID_DEV, hid: true };
  return null;
}

// Outbound: prefix the report id, then pad or split to the report size for
// hidraw; pass bytes straight through for a real tty, which has neither
// constraint. Only REPORT-1 bytes of message fit per transfer because byte 0 is
// spent on the report id.
function framesFor(buf, hid) {
  if (!hid) return [buf];
  const raw = FRAME_MODE === "raw";
  const body = raw ? REPORT : REPORT - 1;
  const out = [];
  for (let i = 0; i < buf.length; i += body) {
    const chunk = Buffer.alloc(REPORT);
    const n = Math.min(body, buf.length - i);
    if (raw) {
      buf.copy(chunk, 0, i, i + n);
    } else {
      // report_id writes a fixed id; length writes how many data bytes follow.
      chunk[0] = FRAME_MODE === "length" ? n : REPORT_ID;
      buf.copy(chunk, 1, i, i + n);
    }
    out.push(chunk);
  }
  if (!out.length) out.push(Buffer.alloc(REPORT));
  return out;
}

const server = net.createServer((sock) => {
  const dev = devicePath();
  if (!dev) {
    // Fail LOUDLY rather than accepting bytes into a void — the silent version
    // of this is exactly what made the pad look like dead hardware.
    log("connection refused: no pinpad device present (" + TTY_DEV + " / " + HID_DEV + ")");
    sock.destroy();
    return;
  }

  let fd;
  try {
    fd = fs.openSync(dev.path, "r+");
  } catch (e) {
    log("cannot open " + dev.path + ": " + e.message);
    sock.destroy();
    return;
  }
  log("connection open on " + dev.path + (dev.hid ? " (hidraw, " + REPORT + "-byte reports)" : " (serial)"));

  let closed = false;
  const shutdown = () => {
    if (closed) return;
    closed = true;
    try { fs.closeSync(fd); } catch (e) { /* already gone */ }
    sock.destroy();
  };

  // Device -> socket. A blocking read on hidraw parks until the pad sends a
  // report (a keypress, a card swipe, a response frame), so it is driven by a
  // recursive async read rather than a poll.
  const readBuf = Buffer.alloc(REPORT);
  const pump = () => {
    if (closed) return;
    fs.read(fd, readBuf, 0, REPORT, null, (err, bytes) => {
      if (closed) return;
      if (err) { log("read error: " + err.message); shutdown(); return; }
      // Strip the inbound report id for the same reason it is added outbound:
      // it is transport, not message. Left in place it puts a stray 0x01 in
      // front of every STX, which the relay's frame parser cannot match.
      if (bytes > 0) {
        // Mirror the outbound decision. In length mode byte 0 is a count, so it
        // both bounds the payload and must not be forwarded as data.
        let start = 0;
        let end = bytes;
        if (dev.hid && FRAME_MODE === "length") {
          start = 1;
          end = Math.min(bytes, 1 + readBuf[0]);
        } else if (dev.hid && FRAME_MODE === "report_id" && readBuf[0] === REPORT_ID) {
          start = 1;
        }
        if (end > start) sock.write(Buffer.from(readBuf.slice(start, end)));
      }
      pump();
    });
  };
  pump();

  // Socket -> device.
  sock.on("data", (data) => {
    for (const frame of framesFor(data, dev.hid)) {
      try {
        fs.writeSync(fd, frame, 0, frame.length);
      } catch (e) {
        log("write error: " + e.message);
        shutdown();
        return;
      }
    }
  });

  sock.on("error", (e) => { log("socket error: " + e.message); shutdown(); });
  sock.on("close", () => { log("connection closed"); shutdown(); });
});

server.on("error", (e) => {
  log("listener error: " + e.message);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => log("listening on 0.0.0.0:" + PORT));
`;

export const HID_PINPAD_SYSTEMD_UNIT = `# /etc/systemd/system/sureflow-pinpad-bridge.service
[Unit]
Description=SureFlow lane HID pinpad bridge (hidraw to TCP)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/node /usr/local/bin/sureflow-pinpad-bridge
# How byte 0 of each 64-byte HID report is used: report_id | length | raw.
# Set once the health check (RBA command 08) answers under one of them.
Environment=PINPAD_FRAME_MODE=report_id
# A pad unplugged mid-shift, or a lane that boots with no pad fitted, must not
# leave the port dead once one is plugged in.
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`;

// The report size and the pad's actual frame layout are the only unknowns here.
// This is how a technician reads them off the pad rather than guessing.
// STOP GUESSING BYTE 0. The report descriptor is the device's own declaration of
// its report IDs and their exact sizes, so it answers in one command what three
// framing modes could not. Run this BEFORE any further framing experiment.
export const HID_PINPAD_DESCRIPTOR_STEPS = `# 1. THE REPORT DESCRIPTOR — the authoritative answer on report id and size.
sudo mount -t debugfs none /sys/kernel/debug 2>/dev/null
ls /sys/kernel/debug/hid/
sudo cat /sys/kernel/debug/hid/0003:0B00:0074.0001/rdesc

# Read from the dump:
#   Report ID (85 xx)      -> whether byte 0 is an id AT ALL, and its value.
#                             NO 85 item means the device has no report ids and
#                             every prefix byte we sent was corrupting the frame.
#   Report Count / Size    -> the true report length (may not be 64).
#   Output vs Feature      -> whether host->pad data goes as an OUTPUT report
#                             (what write() does) or a FEATURE report (which
#                             needs HIDIOCSFEATURE, NOT a plain write).
# A FEATURE-only device explains everything at once: our writes would be
# accepted by the kernel and never delivered.

# 2. DID THE BYTES REACH THE WIRE? usbmon sees the actual USB transfer, which is
# the only way to tell "kernel accepted it" from "pad received it".
sudo modprobe usbmon
lsusb -t | grep -i -B2 ingenico          # note the bus number
sudo timeout 15 cat /sys/kernel/debug/usb/usbmon/<bus>u | grep -i -A1 "0b00\\|Co\\|Io" &
# ...now run the health check from the controller, then read the capture above.

# 3. WHICH ENDPOINTS EXIST. An interrupt OUT endpoint is required for hidraw
# writes to go anywhere; if the pad only has interrupt IN, writes are dead.
sudo lsusb -v -d 0b00: 2>/dev/null | grep -A4 "bEndpointAddress"
`;

export const HID_PINPAD_PROBE_STEPS = `# Confirm the pad is present as a HID device and has a stable symlink
lsusb | grep -i ingenico
ls -l /dev/sureflow-pinpad-hid /dev/hidraw*

# Read what the pad SENDS. Run this, then press keys / swipe a card on the pad —
# each report prints as one line of hex. The line length is the report size.
sudo od -An -tx1 -w64 /dev/sureflow-pinpad-hid

# Confirm the bridge is listening and see it accept the relay's connection
systemctl status sureflow-pinpad-bridge --no-pager
sudo ss -lntp | grep 12000
sudo journalctl -u sureflow-pinpad-bridge -f

# Prove the path from the controller (the direction the relay actually uses)
nc -w2 -v <lane_ip> 12000 </dev/null
`;

export const HID_PINPAD_NOTES = [
  "The Ingenico iSC250 in this fleet is a HID-class device, not a serial one — verified on a live lane: bNumInterfaces 1, bInterfaceClass 3, bound by hid-generic to hiddev0/hidraw0, with no ttyACM, no ttyUSB and no /dev/serial/by-id at all. Every attempt to reach it through a udev tty rule or usbserial is wasted effort.",
  "ser2net must NOT own port 12000 any more. It bound the port over a device that never existed, so the relay connected successfully and then failed every write with 'Device open failure' — a silent failure indistinguishable from unplugged hardware. The pinpad connection was removed from ser2net.yaml and this bridge owns the port instead.",
  "A serial pad still works. The bridge prefers /dev/sureflow-pinpad (a real tty) over the hidraw node, so a future CDC-firmware pad needs no change and the fleet keeps one pinpad port.",
  "HID transfers are fixed size, unlike a serial stream. Outbound frames are zero-padded to the report size (64 bytes for the iSC250) and split across reports when longer, because writing a short buffer to hidraw returns EINVAL on most devices. Override with PINPAD_REPORT_SIZE if a different pad appears.",
  "EVERY hidraw transfer carries a REPORT ID in byte 0, and it is transport rather than message. This was the real reason the pad ignored every command in silence: writes went out starting at STX, so the kernel delivered them as report 0x02, a report the pad does not have, and it discarded them before looking at the framing at all. That is also why the RBA-vs-relay framing A/B came back SILENT both ways — the test was decided one layer below where it was aimed. The pad's own frames prove the value: 01 08 02 32 34 2e 30 08 03 13 leads with 0x01. Outbound now prefixes 0x01 (PINPAD_REPORT_ID) and inbound strips it, so the relay still sees clean STX-framed messages and needs no change. Payload space per report is REPORT-1 bytes, not REPORT.",
  "Nothing in the relay or the POS changed. The bridge listens on the same port 12000 the relay's pinpad module already writes to, and the register's pinpad_ip stays the LANE's own LAN IP.",
  "The pad's frame LAYOUT is still unknown and is not guessed at here — the bridge is a faithful byte pipe. Read the real reports with the od command in the probe steps while pressing keys on the pad, then encode them in the relay's pinpad profile.",
  "PROBING IS EXHAUSTED — do not repeat it. On REG-005, with the report-ID fix in place, the bridge opened /dev/sureflow-pinpad-hid and wrote all 64 bytes with NO write error, under BOTH the pad's own 0x08 framing and the relay's framing, and the pad replied to neither. Reading the device directly with 'od -An -tx1 -w64 /dev/sureflow-pinpad-hid' while pressing number keys and Enter produced NOTHING AT ALL. So the pad is silent in both directions: outbound bytes are accepted by the kernel and discarded by the pad, and inbound nothing is ever emitted. That rules out framing, the report ID, the report size and the command tags all at once — a pad that ignored only our tags would still send keypresses.",
  "The remaining explanation is the pad's own state, not the lane. It sits on 'LANE CLOSE' / screen 24.0, an idle RBA application that does not talk to a host until it is given a session-start command we do not have. No invented tag can reach it from that state, so the ONLY paths forward are the Ingenico RBA Programmer's Guide for its firmware, or a serial capture of the original 4690 host driving one of these pads. Note that lsusb is no help for the firmware version: the unit reports bcdDevice 0.00, iProduct 'Ingenico iSC250', iSerial 80770133 — the RBA version has to be read off the pad's own menu.",
  "TREAT THE 24.0 FRAME AS UNVERIFIED. The frame 01 08 02 32 34 2e 30 08 03 13 is what the report-ID fix was derived from, but it could not be reproduced on REG-005 by any means once the direct hidraw read was tried. The report-ID reasoning still stands on its own (byte 0 of a hidraw transfer is transport), yet nothing should be built on that frame's contents until a pad reproduces it.",
  "RBA'S OWN HEALTH CHECK WAS ALSO SILENT. On REG-005 the frame 02 30 38 2E 30 03 15 ([STX]08.0[ETX][LRC]) — vendor-documented, byte-perfect, correct LRC — got no reply. Since the message layer is now known to be right, the fault must be BELOW it, in how bytes are packed into fixed 64-byte HID reports. RBA specifies the message, not the chunking, so byte 0 of each transfer is the last untested variable.",
  "ALL THREE FRAMING MODES ARE SILENT. On REG-005 the RBA health check was sent with byte 0 as a report id (0x01), as a data length, and with no prefix at all. The pad answered none of them. Three mutually exclusive readings of byte 0 cannot all be wrong in the same way, so byte 0 is NOT the fault and further framing experiments are wasted effort. Combined with the earlier direct hidraw read that produced nothing even while keys were pressed, the pad is silent in both directions, which points at the HID TRANSPORT itself rather than at any message we compose.",
  "NEXT STEP IS THE REPORT DESCRIPTOR, NOT ANOTHER GUESS — see HID_PINPAD_DESCRIPTOR_STEPS. Dumping /sys/kernel/debug/hid/0003:0B00:0074.0001/rdesc makes the device state its own report ids and sizes, and critically whether host-to-pad data is an OUTPUT report (which a plain write delivers) or a FEATURE report (which needs HIDIOCSFEATURE and is silently discarded by a write). A feature-only or IN-only endpoint layout would explain every symptom at once: the kernel accepts all 64 bytes, and nothing ever reaches the pad. usbmon then confirms whether the bytes hit the wire.",
  "Byte 0 is now selectable with PINPAD_FRAME_MODE, so it is tested rather than assumed: report_id (fixed 0x01, the original guess), length (the count of data bytes in that report), or raw (no prefix). The length reading is the strongest suspect precisely because it explains the silence — a 0x01 prefix would declare a ONE-byte message, so the pad reads a lone STX and discards the command, which is indistinguishable from ignoring it. Inbound parsing mirrors whichever mode is set.",
  "Refusing a connection when no pad is present is deliberate. Accepting bytes into a void is what made this fault so expensive to find the first time.",
];