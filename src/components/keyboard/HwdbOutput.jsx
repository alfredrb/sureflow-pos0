import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { buildHwdbMap, CALIBRATION_COMMANDS } from "@/lib/keyboardLayout";

// The generated hwdb map plus the calibration commands, ready to paste into the
// diskless image on the store's PXE controller.
export default function HwdbOutput({ layout }) {
  const [copied, setCopied] = useState(false);
  const code = buildHwdbMap(layout);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-800">Generated hwdb map</p>
            <p className="font-mono text-xs text-gray-400">/etc/udev/hwdb.d/70-sureflow-pos-keyboard.hwdb</p>
          </div>
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="mr-1 h-3 w-3 text-emerald-600" /> : <Copy className="mr-1 h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap bg-white p-3 font-mono text-xs text-gray-700">{code}</pre>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Calibration</p>
        {CALIBRATION_COMMANDS.map((c, i) => (
          <pre key={i} className="mb-1.5 whitespace-pre-wrap rounded-lg bg-gray-900 px-3 py-2 font-mono text-[11px] text-gray-100">{c}</pre>
        ))}
      </div>
    </div>
  );
}