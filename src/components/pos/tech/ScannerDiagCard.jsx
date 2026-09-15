import React, { useRef, useState } from "react";
import { ScanLine, RotateCcw } from "lucide-react";
import TechDiagCard from "@/components/pos/tech/TechDiagCard";

// A scanner is a keyboard wedge, so the only test that means anything is to actually
// scan into the lane and read back what arrived: the decoded data, how many
// characters, how fast they came in (a slow burst means a wedge/HID problem, not a
// bad label), and whether the Enter suffix the POS relies on was sent at all. A
// scanner with no suffix configured looks "connected" everywhere and still breaks
// every sale, which no status field can show.
export default function ScannerDiagCard() {
  const [scan, setScan] = useState(null);
  const buf = useRef("");
  const first = useRef(0);
  const inputRef = useRef(null);

  const symbology = (code) => {
    if (/^\d{13}$/.test(code)) return "EAN-13";
    if (/^\d{12}$/.test(code)) return "UPC-A";
    if (/^\d{8}$/.test(code)) return "EAN-8 / UPC-E";
    if (/^[0-9]+$/.test(code)) return "numeric (ITF / CODE128-C)";
    return "CODE128 / alphanumeric";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const code = buf.current;
      const ms = first.current ? Math.round(performance.now() - first.current) : 0;
      buf.current = ""; first.current = 0;
      setScan({
        code, length: code.length, ms, suffix: true,
        rate: code.length && ms ? Math.round((code.length / ms) * 1000) : 0,
        symbology: symbology(code),
      });
      e.preventDefault();
      return;
    }
    if (e.key.length === 1) {
      if (!first.current) first.current = performance.now();
      buf.current += e.key;
    }
  };

  // Nothing sent Enter but characters landed — the classic missing-suffix scanner.
  const checkSuffix = () => {
    if (!buf.current) return;
    const code = buf.current;
    const ms = first.current ? Math.round(performance.now() - first.current) : 0;
    buf.current = ""; first.current = 0;
    setScan({ code, length: code.length, ms, suffix: false, rate: 0, symbology: symbology(code) });
  };

  const reset = () => { buf.current = ""; first.current = 0; setScan(null); inputRef.current?.focus(); };

  const Row = ({ label, value, tone }) => (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono break-all text-right ${tone || "text-white"}`}>{value}</span>
    </div>
  );

  return (
    <TechDiagCard icon={ScanLine} title="Scanner Capture Test" hint="scan any item">
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        onBlur={checkSuffix}
        placeholder="Click here, then scan a barcode…"
        className="w-full bg-[#0a0e27] border border-slate-500/20 focus:border-slate-400/60 rounded-lg px-3 py-2.5 text-xs text-white font-mono outline-none"
      />
      {scan ? (
        <div className="mt-3 bg-[#0a0e27] rounded-lg border border-slate-500/10 p-3 text-xs space-y-1">
          <Row label="Decoded" value={scan.code || "(nothing)"} />
          <Row label="Characters" value={scan.length} />
          <Row label="Likely symbology" value={scan.symbology} />
          <Row label="Transmit time" value={`${scan.ms} ms${scan.rate ? ` · ${scan.rate} char/s` : ""}`}
            tone={scan.ms > 400 ? "text-amber-400" : "text-white"} />
          <Row label="Enter suffix" value={scan.suffix ? "sent" : "MISSING"}
            tone={scan.suffix ? "text-emerald-400" : "text-red-400"} />
          {!scan.suffix && (
            <p className="text-red-300 text-[10px] leading-snug pt-1">
              Characters arrived with no Enter — the POS will never accept this scan. Program a CR suffix on the scanner.
            </p>
          )}
          <button onClick={reset} className="mt-1 flex items-center gap-1.5 text-slate-300 text-[10px] uppercase tracking-wider font-bold hover:text-white">
            <RotateCcw className="w-3 h-3" /> Scan again
          </button>
        </div>
      ) : (
        <p className="mt-2 text-slate-400 text-[10px] leading-snug">
          Reads the wedge output directly: data, character count, transmit speed and whether the Enter suffix is programmed.
        </p>
      )}
    </TechDiagCard>
  );
}