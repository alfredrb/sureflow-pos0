import { useEffect, useRef, useState } from "react";
import { ACTION_CODE_KEY } from "@/lib/actionCodeDispatch";

// 4690-style action code entry: type the code on the keypad (e.g. 250) then press
// the Action Code key and it runs straight away. Pressing the key with nothing
// typed falls back to the on-screen action code pinpad.
export default function useActionCodeBuffer({ onDispatch, onOpenPad, enabled = true }) {
  const [buffer, setBuffer] = useState("");
  const bufferRef = useRef("");

  useEffect(() => { bufferRef.current = buffer; }, [buffer]);

  useEffect(() => {
    const onKey = (e) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if (e.key === ACTION_CODE_KEY) {
        e.preventDefault();
        const entered = bufferRef.current;
        setBuffer("");
        if (entered) onDispatch(entered);
        else onOpenPad();
        return;
      }

      if (!enabled || typing) return;

      if (/^[0-9]$/.test(e.key)) {
        setBuffer(prev => (prev + e.key).slice(0, 6));
      } else if (e.key === "Backspace") {
        setBuffer(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setBuffer("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onDispatch, onOpenPad]);

  return { buffer, clearBuffer: () => setBuffer("") };
}