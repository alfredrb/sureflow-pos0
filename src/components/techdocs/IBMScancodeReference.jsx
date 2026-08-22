import React from "react";
import { Keyboard, ExternalLink, BookOpen, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const PDF_URL = "https://sharktastica.co.uk/resources/docs/IBM_GC30-3623-10_POS_01_11.pdf";
const WIKI_URL = "https://sharktastica.co.uk/wiki/model-m-pre-modular";

// Which chapter-8 table applies to which keyboard, and the exact pages to open.
// Values are deliberately NOT transcribed here — the tables are read from the
// official manual so a typo in this app can never corrupt a key map.
const TABLES = [
  {
    pages: "8-17 to 8-20 (PDF pages 119–121)",
    table: "ANPOS Keyboard PS/2 Scan Codes",
    applies: "ANPOS / PS/2 ANPOS keyboards — the primary reference for our lanes",
    note: "These are the AT set values showkey --scancodes prints on a lane. Use this table to pre-fill or verify the remapper grid.",
  },
  {
    pages: "8-12 onward",
    table: "ANPOS Keyboard SIO Scan-Code Set",
    applies: "Same keyboards attached through the retail SIO (4683/4693) channel",
    note: "NOT what our USB/PS/2 lanes report — do not enter SIO values into the remapper.",
  },
  {
    pages: "8-3 to 8-11",
    table: "Checkout / Modifiable Layout Keyboard scan-code sets (50-key & 133-key)",
    applies: "50-key modifiable-layout checkout keyboards, if any lane runs one",
    note: "The modifiable layout is the one the firmware key utility rewrites — this table shows the factory defaults per position.",
  },
];

export default function IBMScancodeReference() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Keyboard className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-gray-900">IBM POS Keyboard Scan-Code Reference</h2>
          <p className="text-sm text-gray-500 mt-1">
            IBM's <em>Point of Sale Subsystem: Installation, Keyboards, and Code Pages</em> (GC30-3623-10,
            Sept 2001) is the factory scan-code reference for the IBM POS keyboard family. Chapter 8 documents,
            per physical key position, the scancode each keyboard sends — the authoritative cross-check for
            values captured with evtest / showkey on a lane.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <BookOpen className="w-3.5 h-3.5" /> Open the manual (PDF) <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={WIKI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Keyboard family background (Sharktastica wiki) <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-medium">Manual pages</th>
              <th className="px-3 py-2 font-medium">Table</th>
              <th className="px-3 py-2 font-medium">Applies to</th>
              <th className="px-3 py-2 font-medium">Field note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {TABLES.map((t, i) => (
              <tr key={i} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap font-mono text-xs text-gray-600">{t.pages}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{t.table}</td>
                <td className="px-3 py-2 text-gray-600">{t.applies}</td>
                <td className="px-3 py-2 text-gray-500">{t.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900 space-y-1.5">
        <p className="font-semibold">Reading the manual against a lane capture</p>
        <ul className="list-disc pl-5 space-y-1 text-blue-800">
          <li>
            <span className="font-mono text-xs">showkey --scancodes</span> prints the manual's PS/2 (AT set)
            values directly — e.g. <span className="font-mono text-xs">0x3b</span> matches the table as-is.
          </li>
          <li>
            <span className="font-mono text-xs">evtest</span> prints the long USB-HID value
            (e.g. <span className="font-mono text-xs">70045</span>) — the kernel translates it from the same
            PS/2 code, so a key that matches the manual under showkey is correct under evtest too.
          </li>
          <li>
            A key whose capture <em>disagrees</em> with the manual has been rewritten by the firmware key
            utility at some point; a position that sends <em>nothing</em> ships unassigned — both are bench
            jobs per the utility walkthrough on the{" "}
            <Link to="/admin/keyboard-mapper" className="underline">Visual Key Remapper</Link>.
          </li>
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          The scan-code tables are intentionally not copied into this app — always read values from the official
          PDF, the same rule as scanner configuration barcodes. A single transposed hex digit here would silently
          corrupt every lane map generated from it.
        </p>
      </div>
    </div>
  );
}