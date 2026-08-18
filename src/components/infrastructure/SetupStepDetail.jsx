import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

function CopyBlock({ text, mono = true }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group bg-gray-900 rounded-lg px-3 py-2 pr-9">
      <pre className={`text-[11px] text-gray-100 whitespace-pre-wrap break-all ${mono ? "font-mono" : ""}`}>{text}</pre>
      <button onClick={copy} title="Copy" className="absolute top-1.5 right-1.5 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// Expanded instructions for one relay setup step: bullet guidance,
// copyable shell commands, and an optional full code file.
export default function SetupStepDetail({ detail }) {
  const [openFile, setOpenFile] = useState(null);
  if (!detail) return null;
  const files = detail.codeFiles || (detail.code ? [{ name: "server.js", code: detail.code }] : []);
  return (
    <div className="ml-8 mr-2 mb-2 mt-1 space-y-2" onClick={(e) => e.stopPropagation()}>
      {(detail.instructions || []).map((line, i) => (
        <p key={i} className="text-[11px] text-gray-600 leading-relaxed">• {line}</p>
      ))}
      {(detail.commands || []).length > 0 && (
        <div className="space-y-1.5">
          {detail.commands.map((cmd, i) => <CopyBlock key={i} text={cmd} />)}
        </div>
      )}
      {(detail.postInstructions || []).map((line, i) => (
        <p key={i} className="text-[11px] text-gray-600 leading-relaxed">• {line}</p>
      ))}
{files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.name}>
              <button onClick={() => setOpenFile(openFile === f.name ? null : f.name)} className="text-[11px] font-medium text-blue-600 hover:underline">
                {openFile === f.name ? "Hide" : "Show"} <span className="font-mono">{f.name}</span>
              </button>
              {openFile === f.name && (
                <div className="mt-1.5 max-h-72 overflow-y-auto rounded-lg"><CopyBlock text={f.code} /></div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}