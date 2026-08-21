// Cheque dual-side printing — investigation, now anchored to Epson's own manuals
// rather than to inference. Still gated: what the vendor documents is the model
// FAMILY, and what a given fleet unit has is a factory option to be confirmed.
//
// The vendor's own model breakdown (TM-H6000V User's Manual, "Applicable Models
// and Features") settles the architecture question:
//
//   Standard model  — prints on the FACE of roll/slip paper.
//                     Models with the endorsement printer (factory-installed
//                     option) can print ALSO on the BACK of slip paper.
//   Validation model — prints on the FACE of roll/slip/validation paper.
//
// So dual-side is a HARDWARE OPTION, not a hidden command: the slip station
// prints the face, and a separate endorsement mechanism (E/P) — a second impact
// head — prints the back. Epson documents the E/P as driving endorsement print
// "as part of a sequence that is automatically processed: MICR reading, ..." so on
// an E/P-equipped unit a single insertion legitimately covers both sides.
//
// This reframes the open question from "does a secret front-print command exist?"
// to "does THIS unit carry the E/P option, and is our sequence addressing it?" —
// which the self-test sheet and the ribbon bays answer in minutes.

// RESOLVED at the unit: the capability report printed by the self-test shows the
// endorsement unit is NOT installed. That closes the investigation as a NO-GO for
// this printer — and, because the E/P is the only mechanism that reaches the back
// of the sheet, it forces one further conclusion about the franking legend.
export const RESOLUTION = {
  outcome: "NO-GO — endorsement unit not installed",
  summary:
    "The printer's own capability report lists no endorsement unit. There is no second impact head, so no command " +
    "sequence can print the back of a cheque on this hardware. Single-insertion dual-side printing is off the table.",
  consequences: [
    {
      point: "The franking legend has been printing on the FACE of the cheque all along",
      detail:
        "With no E/P fitted, the slip station is the only station that can print — and it prints the face. So the " +
        "FOR DEPOSIT ONLY legend has never been an endorsement on the back; it has been overprinting the front of the " +
        "cheque, on top of the payee and amount area. This is no longer a hypothesis: it is the only physical possibility.",
    },
    {
      point: "That explains the off-centre franking legend outright",
      detail:
        "The long-standing 'franking legend is off-centre' issue was never a margin bug. The legend was laid out for the " +
        "back of the sheet and is landing on the front, so no amount of nudging the offsets will make it correct — it is " +
        "in the wrong place because it is on the wrong side.",
    },
    {
      point: "Overprinting the face may make the cheque unacceptable to the bank",
      detail:
        "Printing over the payee, amount or signature area of a cheque can render it non-negotiable. Treat this as the " +
        "urgent half of the finding: confirm with a deposited cheque what the current legend actually obscures before " +
        "the next deposit run, and consider suppressing the legend until the placement is corrected.",
    },
    {
      point: "The endorsement has to move to a two-pass reinsert flow",
      detail:
        "To endorse the back on this hardware the operator must physically turn the cheque over and reinsert it. That is " +
        "the guided flow the NO-GO branch already anticipated: print, eject, prompt to reinsert reversed, print, eject.",
    },
  ],
  next_steps: [
    "DONE — the face legend is suppressed. The cheque is now ejected unprinted after the MICR read, so nothing is printed on the front.",
    "DONE — the guided two-pass reinsert flow is live (check-reader build 5): read, eject, TURN THE CHEQUE OVER prompt, endorse the back, eject.",
    "Verify at the lane on a scrap cheque that the legend now lands on the back and the front is clean.",
    "Run the same self-test on every other lane's printer — the E/P is a per-unit factory option, so a sister lane may still have one.",
    "Deploy the updated checkReader.js to each store relay; lanes keep the old single-pass behaviour until the relay is updated.",
  ],
};

export const VENDOR_FINDINGS = [
  {
    finding: "Dual-side is a factory option, not a command discovery",
    detail:
      "Epson splits the line into a standard model that prints the FACE of roll/slip paper, and a variant with the " +
      "endorsement printer option that can print ALSO on the BACK of slip paper. There is nothing to reverse-engineer: " +
      "if the option is absent, no command sequence will produce back-side print.",
    source: "TM-H6000V User's Manual — Applicable Models and Features",
  },
  {
    finding: "The endorsement mechanism is a genuine second impact head",
    detail:
      "The E/P is documented as its own print mechanism, and third-party service references describe it plainly as a " +
      "second impact print head. That is the physical thing the earlier capture step was trying to establish by eye.",
    source: "TM-H6000II Technical Reference Guide — E/P mechanism",
  },
  {
    finding: "MICR read and endorsement are one automatic sequence",
    detail:
      "Epson describes the E/P as printing the endorsement as part of a sequence the printer processes automatically " +
      "beginning with the MICR read. On an E/P unit the single-insertion flow is the vendor's intended design, not a " +
      "trick — which is what makes a GO outcome low-risk.",
    source: "TM-H6000II Technical Reference Guide — E/P mechanism",
  },
  {
    finding: "Two ribbon bays, two mechanisms — a visual tell",
    detail:
      "On the H6000V the ribbon cartridge for ENDORSEMENT printing is installed under the receipt unit, while the ribbon " +
      "for SLIP/VALIDATION printing is installed under the front cover. Two separately documented ribbon locations means " +
      "two mechanisms, and their presence is checkable without powering the unit.",
    source: "TM-H6000V User's Manual — Part Names and Functions",
  },
  {
    finding: "Our current sequence may be printing the endorsement on the FACE",
    detail:
      "Because the slip station is the FACE printer, ESC c 0 4 followed by text prints the legend on the front of the " +
      "cheque, not the back — the back requires the E/P station. This is the leading explanation for the long-standing " +
      "off-centre franking legend: the legend is landing on a side, and in a position, it was never laid out for. " +
      "Confirm on a scrap cheque before changing any relay code.",
    source: "Inference from the model/station split above — verify at the unit",
  },
];

export const SOURCE_REFERENCES = [
  { label: "TM-H6000V Technical Reference Guide (Rev. B)", url: "https://files.support.epson.com/pdf/pos/bulk/tm-h6000v_trg_en_revb.pdf" },
  { label: "TM-H6000V User's Manual", url: "https://files.support.epson.com/pdf/pos/bulk/tm-h6000v_um_en_01.pdf" },
  { label: "Epson TM-H6000V support and manuals index", url: "https://epson.com/Support/Point-of-Sale/OmniLink-Printers/Epson-TM-H6000V-Series/s/SPT_C31CG62032#manuals" },
  { label: "TM-H6000II Technical Reference Guide (E/P mechanism detail)", url: "http://www.i-o.cz/user/upload/TMH-6000-II%20Technical%20Reference.pdf" },
  { label: "IBM SurePOS 700 Series manual", url: "https://www.manualslib.com/manual/1923709/Ibm-Surepos-700-Series.html" },
  { label: "IBM 4800-C41 manual", url: "https://www.manualslib.com/manual/377421/Ibm-4800-C41.html" },
];

// The corrected two-pass sequence now running at the lane (check-reader build 5).
export const CURRENT_FLOW = [
  { cmd: "FS a 0 (1C 61 30 30)", detail: "PASS 1 — wait for the cheque face-up, read the E-13B MICR line." },
  { cmd: "FS a 2 (1C 61 32)", detail: "Eject the cheque unprinted, so the operator can turn it over. Nothing is printed on the face any more." },
  { cmd: "— operator turns the cheque over —", detail: "The POS shows the TURN THE CHEQUE OVER prompt and waits for the operator to reinsert it face-down." },
  { cmd: "ESC c 0 4 + ESC f", detail: "PASS 2 — select the slip station and wait ~30s for the reversed sheet. FS a 1 is wrong here: nothing is loaded." },
  { cmd: "text + LF", detail: "Impact-print the FOR DEPOSIT ONLY legend — now landing on the BACK of the cheque, which is where it was laid out for." },
  { cmd: "FS a 2 (1C 61 32)", detail: "Eject the endorsed cheque and return the printer to the receipt roll." },
];

// What the technician now needs to establish — narrowed by the vendor findings.
export const CAPTURE_STEPS = [
  {
    step: "Read the printer's own capability report",
    detail:
      "Hold FEED while powering on to print the self-test / configuration sheet. It names the installed stations and " +
      "interfaces, so it states directly whether the endorsement mechanism is fitted. Cheapest possible evidence, and " +
      "it now answers the whole architectural question — do this one first.",
  },
  {
    step: "Confirm the model string and the E/P option on the label",
    detail:
      "Record the exact model string from the bottom label. The E/P is a factory-installed option, so it varies unit by " +
      "unit within the same fleet — the answer for one lane is explicitly not the answer for the fleet. Log which lanes " +
      "have it before planning any rollout.",
  },
  {
    step: "Check both ribbon bays physically",
    detail:
      "Powered off, open the receipt unit (endorsement ribbon location) and the front cover (slip/validation ribbon " +
      "location). A seated cartridge against a head in the receipt-unit bay is the E/P; an empty bay means this unit " +
      "prints the face only. Photograph both for the fleet record.",
  },
  {
    step: "Establish which SIDE our current legend actually prints on",
    detail:
      "Run one cheque tender on a scrap cheque and look at the paper. If the legend is on the FACE, the off-centre " +
      "franking issue is a station problem rather than a layout problem, and the fix is to address the E/P — not to " +
      "nudge the margins again.",
  },
  {
    step: "Capture the bytes for the endorsement station",
    detail:
      "On an E/P unit, drive endorsement print with a vendor utility or the ePOS SDK and tap the stream the same way the " +
      "pole capture helper does — a socat tap in front of the printer, then od -c. Recording the real frames is what " +
      "turns a reserved profile into a supported one.",
  },
  {
    step: "Time the two-pass fallback anyway",
    detail:
      "Time a guided reinsert flow at the lane: print one side, eject, prompt to reinsert, print the other. This is the " +
      "path every non-E/P unit takes permanently, and a mixed fleet will need it regardless of what the best lanes can do.",
  },
];

export const DECISION_GATE = [
  {
    outcome: "GO — the E/P option is fitted and its frames were captured",
    detail:
      "Add an endorsement-station profile to the cheque module the same way pinpad and pole models are added: a captured " +
      "command profile keyed by model, not new branching in the POS. One insertion then prints the face and the back, " +
      "which is Epson's documented design for these units.",
  },
  {
    outcome: "NO-GO — standard model, face printing only",
    detail:
      "No command will produce back-side print on this hardware, so commit the guided two-pass reinsert flow: print, " +
      "eject, prompt the operator to reinsert, print the other side. Same hardware, one extra prompt, no protocol risk.",
  },
  {
    outcome: "MIXED FLEET — some lanes have the E/P, some do not",
    detail:
      "The likeliest real-world outcome given it is a factory option. Treat it exactly like the pole displays: the " +
      "capability is per-register hardware profile, E/P lanes take the single-insertion path, and every other lane keeps " +
      "the two-pass flow. Never assume the option chain-wide.",
  },
];