// Ingenico RBA (Retail Base Application) protocol facts for the fleet's iSC250.
//
// WHY THIS FILE EXISTS. Every pinpad command previously in the relay profile was
// INVENTED (W0 / W1 / S0) and produced silence from the pad under every framing
// and transport variation tried. The pad's own diagnostic screen finally named
// what it runs, and RBA is a documented protocol — so the command set is now
// sourced rather than guessed. Nothing in here should be extended by inference.

// Read directly off the pad's Retail Base diagnostic screen (and lsusb for the
// USB identity). This is the evidence that ended the guessing phase.
export const RBA_IDENTITY = [
  {
    label: "Application",
    value: "Retail Base (SA00704)",
    why: "RBA — a documented Ingenico protocol. This is the single most important fact: the command set is knowable.",
  },
  {
    label: "RBA version",
    value: "15.0.6.0025",
    why: "Well above 12.02, so this unit supports OnGuard/BPS encryption of track data. Match the vendor guide to this version.",
  },
  {
    label: "Host interface",
    value: "USB-HID",
    why: "The pad is ALREADY set to USB-HID, confirming the HID bridge approach is correct and no serial mode is expected.",
  },
  {
    label: "Telium SDK / SM",
    value: "9.20.3 / SM 4.0.1",
    why: "Platform versions, recorded for the hardware audit and for matching vendor documentation revisions.",
  },
  {
    label: "Injected serial",
    value: "2215267SC010318",
    why: "Key-injection serial, distinct from the USB serial. Relevant to encryption/key questions, not to transport.",
  },
  {
    label: "USB serial",
    value: "80770133",
    why: "What lsusb reports. A Health Check reply carries the device serial, so this is how a reply is verified as genuine.",
  },
];

// Vendor-documented commands only. Format is [STX] <two-digit code> . <params> [ETX] [LRC].
export const RBA_COMMANDS = [
  {
    code: "08",
    name: "Health Check",
    request: "[STX]08.0[ETX][LRC]  =  02 30 38 2E 30 03 15",
    detail:
      "Asks the pad to identify itself. Replies with a long [FS]-delimited frame whose fields include the model name, the application name ('Retail Base') and the device serial number. This is the correct first command for any diagnosis — it needs no session, no amount and no card.",
  },
  {
    code: "87",
    name: "Capture card (swipe or keyed)",
    request: "[STX]87.Please Slide Card[ETX][LRC]",
    detail:
      "Prompts the customer and returns card data. The parameter is the prompt text shown on the pad, which also makes this the first proof that the host can put words on the screen. Response carries clear PAN first6/last4, expiry and the encrypted track under OnGuard.",
  },
];

export const RBA_HEALTH_CHECK_PROBE = `# The relay's raw probe already builds RBA framing (STX + body + ETX + LRC),
# so the health check needs NO code change — only the correct payload.
curl -s -X POST http://localhost:3000/api/pinpad/raw \\
  -H 'Content-Type: application/json' \\
  -d '{"pinpad_ip":"<lane_ip>","payload":"08.0","wrap":false,"timeout_ms":8000}' | jq

# Expected on success: replied=true, and reply_ascii contains "Retail Base"
# plus the device serial (80770133 on REG-005's unit).
#
# Byte-for-byte the frame on the wire should be:
#   02 30 38 2E 30 03 15
#   ^STX        ^ETX ^LRC = 30^38^2E^30^03
#
# If this is SILENT, the remaining suspect is the HID REPORT LAYER, not RBA:
# byte 0 of each 64-byte hidraw transfer. The bridge currently writes 0x01 there
# as a report id. Some RBA USB-HID hosts instead use byte 0 as the DATA LENGTH
# for that report, in which case 0x01 declares a 1-byte message and the pad
# discards the rest — which would look exactly like what has been seen. Test by
# setting PINPAD_REPORT_ID=0 (raw, no prefix) and by a length-prefix build,
# re-running the health check for each. Three cheap cases, one right answer.`;

export const RBA_NOTES = [
  "The pad runs RBA 15.0.6.0025 with Host: USB-HID, read off its Retail Base diagnostic screen. That screen is reached by rebooting with [Clear]+[-] held, then 2-6-3-4 and Enter.",
  "W0 / W1 / S0 were never RBA commands. RBA uses a two-digit numeric code followed by a period, so those messages were unparseable under any framing — the observed silence was correct behaviour, not a fault.",
  "0x08 is NOT a framing byte. It is the ASCII '08' of the Health Check command, misread as a wrapper from an early capture. The 'pad's own framing' A/B test was therefore invalid on both sides.",
  "The relay's existing framing (STX + body + ETX + XOR LRC) matches RBA exactly. No relay framing change is needed.",
  "Health Check (08) is the correct first command for every future diagnosis: no session, no card, no amount, and its reply contains the device serial so a genuine response cannot be confused with noise.",
  "OPEN QUESTION — the HID report layer. RBA defines the message; it does not define how bytes are chunked into 64-byte HID reports. Byte 0 of each transfer is either a report id (currently assumed, 0x01) or a per-report data length. If the health check stays silent, this is the remaining variable, and PINPAD_REPORT_ID=0 plus a length-prefix variant are the two tests that settle it.",
  "Card capture (87) takes the customer prompt text as its parameter, so the first successful screen write and the first card read are the same command. Do not build a separate display path before 08 replies.",
  "A 4690 capture is no longer required. It was the fallback for an unknown protocol, and the protocol is now known and documented.",
];