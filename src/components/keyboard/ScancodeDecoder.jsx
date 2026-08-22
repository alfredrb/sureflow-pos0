import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Copy, Check } from "lucide-react";
import { decodeShowkey } from "@/lib/showkeyDecode";

// Paste a raw showkey capture, get the hwdb codes to type into the key slots — in
// the order the keys were pressed, so a technician can work straight down the grid.
export default function ScancodeDecoder() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(null);
  const codes = decodeShowkey(text);

  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <Wand2 className="h-4 w-4 text-gray-400" /> Scancode decoder
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Paste the raw output from <span className="font-mono">showkey --scancodes</span> — press/release
        pairs, extended keys and split lines are all worked out for you.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={"0x3b 0xbb\n0xe0 0x48 0xe0 0xc8\n0x04 0x84 0x05 0x85"}
        className="mt-3 font-mono text-xs"
      />

      {text.trim() && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">
            {codes.length} key{codes.length === 1 ? "" : "s"} detected, in press order
          </p>
          {codes.length === 0 ? (
            <p className="mt-1 text-sm text-gray-500">
              No usable scancodes in that paste — nothing but zero bytes, which means no code reached
              the console. Capture that key with <span className="font-mono">evtest</span> instead.
            </p>
          ) : (
            <ol className="mt-2 flex flex-wrap gap-2">
              {codes.map((c, i) => (
                <li key={i}>
                  <button
                    onClick={() => copy(c.code)}
                    title="Copy this code"
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-sm text-gray-900 hover:bg-gray-100"
                  >
                    <span className="font-sans text-[10px] text-gray-400">{i + 1}</span>
                    {c.code}
                    {c.extended && <span className="font-sans text-[10px] text-gray-400">ext</span>}
                    {c.fromRelease && (
                      <span
                        className="font-sans text-[10px] text-amber-600"
                        title="Only the release byte was captured — the press bit was stripped to recover this code"
                      >
                        rel
                      </span>
                    )}
                    {copied === c.code ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}