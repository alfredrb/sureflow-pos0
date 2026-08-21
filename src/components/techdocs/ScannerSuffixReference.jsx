import React from "react";
import { ScanLine, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";

// Why the scanner must send its own Enter, and how to program it.
//
// The POS reads scans through the operator prompt line (useActionCodeBuffer): every
// character a keyboard-wedge scanner types lands in the buffer, and ENTER is what
// rings the item up. A scanner shipped with no suffix therefore fills the line and
// stops, leaving the cashier to press Enter by hand on every item. The fix belongs
// in the scanner, not the app: the suffix is stored in the scanner's non-volatile
// config, so it survives reboots, image rebuilds and moving the gun between lanes.

const PROGRAM_STEPS = [
  { n: 1, label: "SCAN OPTIONS", note: "Puts the scanner into suffix programming mode." },
  { n: 2, label: "<DATA> <SUFFIX 1>", note: "Selects the transmit format: barcode data followed by suffix 1." },
  { n: 3, label: "ENTER", note: "Sets suffix 1 to the Enter / carriage-return keystroke." },
];

const VERIFY = `# On the LANE, prove the scanner sends Enter (no POS needed).
# Open a plain text editor or a terminal and scan any barcode twice:
#
#   012345678905
#   012345678905
#
# Each scan must land on its OWN line. If both scans end up on one line, the
# suffix did not take — re-run the three programming barcodes in order.

# Then in the POS, Sale mode:
#   scan an item -> it must ring straight into the cart with NO key press.`;

export default function ScannerSuffixReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <ScanLine className="h-5 w-5 text-blue-600" /> Barcode Scanner — Auto-Enter Suffix
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          The lane scanners are keyboard-wedge (USB HID) devices: a scan is typed into the POS exactly as if the cashier
          keyed it, and the POS rings the item up when it receives <span className="font-mono text-gray-700">Enter</span>.
          A scanner with no suffix configured types the digits and stops, which is why the operator currently has to press
          Enter after every item. Programming a carriage-return suffix into the scanner fixes it fleet-wide with no change
          to the POS.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-emerald-800">
            Do this at provisioning time, per scanner. The suffix is written to the scanner's non-volatile memory, so it
            survives power cycles, diskless image rebuilds and moving the gun to another lane — nothing has to be
            reapplied after a rebuild.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-bold text-gray-900">Programming procedure — Zebra DS4308 (and DS4608 / LS2208 class)</h3>
        <p className="mt-1 text-xs text-gray-500">
          Scan the three configuration barcodes from the scanner's Product Reference Guide, in this exact order. The
          scanner beeps after each one; a long low beep means the barcode was rejected and the sequence must be restarted.
        </p>
        <div className="mt-3 space-y-2">
          {PROGRAM_STEPS.map((s) => (
            <div key={s.n} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                {s.n}
              </span>
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-gray-800">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs font-bold text-blue-900">Where to get the three barcodes</p>
          <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
            Print them from Zebra's own documents — never from a photocopy, a phone screen or a re-drawn copy. A
            configuration barcode that decodes even slightly wrong writes a different parameter into the scanner, and
            recovering means a full factory-default reset and re-programming of the gun.
          </p>
          <div className="mt-2 space-y-1.5">
            <a
              href="https://support.zebra.com/article/How-dodr-every-scan-with-the-laser-scanners-when-attached-via-USB-or-Keyboard-Wedge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              <span>Zebra KB 000011457 — the three Enter-suffix barcodes on one page (all scanners)</span>
            </a>
            <a
              href="https://sool.sk/wp-content/uploads/2023/09/ds4308-prg-en.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1.5 text-[11px] font-semibold text-blue-700 hover:underline"
            >
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              <span>DS4308 Product Reference Guide (PDF) — Keyboard Wedge / USB chapter and the ASCII value tables</span>
            </a>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-blue-800">
            Print the KB page once at 100% scale (no "fit to page" shrinking), laminate it, and keep it in the lane
            toolkit — provisioning a replacement gun is then three scans at the register.
          </p>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Use <span className="font-mono">ENTER</span>, not <span className="font-mono">TAB</span>. Tab moves focus in
            the kiosk browser and will pull the operator prompt line out from under the next scan. Do not add a second
            suffix — two terminators submit the line twice and can double-ring the item.
          </p>
        </div>
      </div>

      <CodeBlock title="Verify" filename="lane + POS" code={VERIFY} />

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <h3 className="text-sm font-bold text-gray-900">Serial / OCIA scanners</h3>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          This applies only to scanners set to <span className="font-mono">usb_hid</span> on the register's hardware
          profile. A scanner on <span className="font-mono">rs232_serial</span> or <span className="font-mono">usb_ocia</span>{" "}
          does not type keystrokes at all — its data arrives on a serial port, and the terminator is set in the scanner's
          serial host parameters instead. Confirm the interface on the register profile before programming.
        </p>
      </div>
    </div>
  );
}