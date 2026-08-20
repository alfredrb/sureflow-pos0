import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, FileText } from "lucide-react";
import { RELAY_CHECK_READER_CODE, RELAY_CHECK_ROUTES_CODE } from "@/lib/relayCheckReader";
import { RELAY_SERVER_WITH_CHECKS_CODE } from "@/lib/relayServerWithChecks";

const BLOCKS = [
  { file: "checkReader.js", code: RELAY_CHECK_READER_CODE, note: "Drop into the relay app directory next to printer.js." },
  { file: "server.js (routes only)", code: RELAY_CHECK_ROUTES_CODE, note: "Just the three routes, if you are patching an existing server.js." },
  { file: "server.js (complete file)", code: RELAY_SERVER_WITH_CHECKS_CODE, note: "Full Phase 3 server with the cheque routes already in place — after /api, before the static POS build and SPA catch-all." },
];

function CodeBlock({ file, code, note }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div>
          <p className="text-xs font-semibold text-gray-800 font-mono">{file}</p>
          <p className="text-[11px] text-gray-400">{note}</p>
        </div>
        <Button size="sm" variant="outline" onClick={copy} className="gap-1 text-xs">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed overflow-x-auto bg-[#0a0e27] text-blue-100 max-h-80">{code}</pre>
    </div>
  );
}

export default function CheckReaderReference() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" /> Cheque Station (MICR + Franking)
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Epson TM-H6000IV cheque flow, using the cheque-station command family only:
          <span className="font-mono text-xs"> FS a 0 n </span>(read MICR — sent on its own, with no
          <span className="font-mono text-xs"> ESC f </span>or paper-select in front of it, since any other command drops the
          printer out of MICR mode), <span className="font-mono text-xs">FS a 1</span> to load the cheque to the print position for the
          <span className="font-semibold"> FOR DEPOSIT ONLY</span> endorsement, then <span className="font-mono text-xs">FS a 2</span> to eject.
          Selecting Check at tender arms the reader automatically and prompts the operator to insert the cheque; a failed or dirty
          read falls back to manual keying, flagged on the cheque record.
          The module logs <span className="font-mono text-xs">check-reader-build 4</span> — an older build stamp means the previous
          copy is still deployed on the relay.
        </p>
      </div>
      {BLOCKS.map(b => <CodeBlock key={b.file} {...b} />)}
      <p className="text-[11px] text-gray-400">
        Requires <span className="font-mono">SLIP_PAPER=4</span> and <span className="font-mono">PRINTER_IPS</span> in the relay
        <span className="font-mono"> .env</span> — the same values the receipt printer module uses.
      </p>
    </div>
  );
}