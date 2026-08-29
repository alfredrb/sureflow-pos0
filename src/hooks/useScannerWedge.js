import { useEffect, useRef } from "react";

// USB-HID barcode scanner input on the self-checkout lane: the scanner is a
// keyboard wedge, so scans arrive as fast keystrokes ending with Enter. Keys
// typed into a focused input (manual code entry, serial capture) are left
// alone — the wedge only claims free-floor keystrokes.
export default function useScannerWedge({ onScan, enabled = true }) {
  const buf = useRef("");
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Enter") {
        const code = buf.current.trim();
        buf.current = "";
        if (code.length >= 3) onScanRef.current(code);
        return;
      }
      if (e.key.length === 1) buf.current += e.key;
      else if (e.key === "Escape") buf.current = "";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}