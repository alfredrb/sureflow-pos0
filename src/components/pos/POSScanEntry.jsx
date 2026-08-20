import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScanLine } from "lucide-react";

// Keyed / scanned item entry. A scanner in keyboard-wedge mode types the UPC and
// sends Enter, so typing a UPC or SKU by hand behaves exactly like a scan.
export default function POSScanEntry({ onSubmitCode }) {
  const [code, setCode] = useState("");

  const submit = () => {
    const value = code.trim();
    if (!value) return;
    onSubmitCode(value);
    setCode("");
  };

  return (
    <div className="px-3 py-2 bg-[#0d1230] border-b border-blue-500/10 flex-shrink-0">
      <div className="relative">
        <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300/40" />
        <Input
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Scan or key UPC / SKU, then press Enter"
          autoFocus
          className="pl-9 h-11 bg-[#0a0e27] border-blue-500/15 text-white font-mono text-sm placeholder:text-blue-300/30 placeholder:font-body"
        />
      </div>
    </div>
  );
}