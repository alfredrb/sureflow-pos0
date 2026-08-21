// Check dual-side printing — bounded investigation, not a delivered feature.
//
// Today a cheque tender is ONE insertion: FS a 0 (read the MICR on the front
// bottom edge, keep the cheque loaded) → FS a 1 (load to print position) → impact
// print the endorsement on the BACK → FS a 2 (eject). The FRONT of the cheque is
// never printed in that pass, which is the reinsertion the store is doing by hand.
//
// The open question is whether the TM-H6000IV in this fleet has a SECOND impact
// head addressing the opposite side of the sheet. Standard ESC/POS exposes only
// the FS a family, which prints the endorsement side — there is no documented
// command in that family that selects a front-facing head. So this is the same
// situation as the reserved IBM/ADX pole profiles: capture from the live unit
// first, decide second. Nothing ships until the go/no-go is recorded.

export const CURRENT_FLOW = [
  { cmd: "FS a 0 (1C 61 30 30)", detail: "Wait for the cheque, read the E-13B MICR line, keep the sheet loaded." },
  { cmd: "FS a 1 (1C 61 31)", detail: "Load the cheque to the print starting position — no fresh-sheet wait needed." },
  { cmd: "ESC c 0 4", detail: "Select the cheque / slip station as the paper source (SLIP_PAPER=4)." },
  { cmd: "text + LF", detail: "Impact-print the FOR DEPOSIT ONLY endorsement legend on the BACK of the cheque." },
  { cmd: "FS a 2 (1C 61 32)", detail: "Eject the cheque. The front was never printed — hence the manual reinsertion." },
];

// What the technician is actually trying to establish at the unit.
export const CAPTURE_STEPS = [
  {
    step: "Establish what the second ribbon spot physically is",
    detail:
      "Open the rear cover with the printer powered off and look for a second ribbon cartridge seated against a " +
      "print head, versus an empty option bay or the thermal head housing. A ribbon with no head behind it is not a " +
      "print station. Photograph it and record the exact model string from the bottom label — TM-H6000IV variants " +
      "differ, and the answer for one unit is not the answer for the fleet.",
  },
  {
    step: "Read the printer's own capability report",
    detail:
      "Hold FEED while powering on to print the self-test / configuration sheet. It lists the installed interfaces and " +
      "stations. If a second slip or endorsement station exists, it is named there — this is the cheapest single piece " +
      "of evidence and it settles most of the question.",
  },
  {
    step: "Enumerate the paper sources the firmware will accept",
    detail:
      "ESC c 0 n selects the paper source. n=3 is the receipt roll and n=4 is the cheque/slip station in the current " +
      "build. Sweep the remaining values one at a time with a cheque loaded and record which are accepted, which are " +
      "ignored, and which make the printer eject. An accepted value that prints on the FRONT is the finding that " +
      "unlocks single-pass dual-side.",
  },
  {
    step: "Capture the bytes rather than trusting the manual",
    detail:
      "If a vendor utility or the ePOS SDK can print on the front, run it against the unit and capture the frames the " +
      "same way the pole capture helper does — a socat tap in front of the printer, then od -c the stream. Recording " +
      "the real byte sequence is what turns a reserved profile into a supported one.",
  },
  {
    step: "Time the two-pass fallback so there is a baseline to compare against",
    detail:
      "Regardless of the outcome, time a guided reinsert flow at the lane: endorse the back, eject, prompt 'reinsert " +
      "face-up', print the front. If the added seconds are acceptable at the register, a no-go on the second head " +
      "costs the store very little — which is what makes this safe to gate.",
  },
];

export const DECISION_GATE = [
  {
    outcome: "GO — a real second head, and its command set was captured",
    detail:
      "Add a front-face profile to the cheque module the same way pinpad and pole models are added: a captured command " +
      "profile keyed by model, not new branching in the POS. One insertion then prints the face and the endorsement.",
  },
  {
    outcome: "NO-GO — single impact head",
    detail:
      "Commit the guided two-pass reinsert flow instead: the relay endorses the back, ejects, the POS prompts the " +
      "operator to reinsert face-up, then the front prints. Same hardware, one extra prompt, no protocol risk.",
  },
  {
    outcome: "INCONCLUSIVE — a head may exist but the protocol is undocumented",
    detail:
      "Keep the profile RESERVED, exactly like the IBM/ADX pole displays. A reserved profile is skipped silently at " +
      "the lane rather than half-working, and the fleet keeps the two-pass flow until frames are captured.",
  },
];