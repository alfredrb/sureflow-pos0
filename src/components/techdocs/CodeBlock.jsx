import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

// Copyable code panel used by the technical documentation references.
export default function CodeBlock({ title, note, code, filename }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {filename && <p className="mt-0.5 font-mono text-[11px] text-gray-400">{filename}</p>}
          {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
        </div>
        <button onClick={copy} className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50">
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto bg-gray-950 p-4 font-mono text-[11px] leading-relaxed text-gray-200">{code}</pre>
    </div>
  );
}