import { useEffect, useRef, useState } from "react";
import { ACTION_CODE_KEY } from "@/lib/actionCodeDispatch";

// 4690-style keypad entry on the operator prompt line: type digits (an action
// code like 250, or a product UPC / SKU). Pressing the Action Code key runs it as
// an action code; pressing Enter rings it up as an item. Pressing the Action Code
// key with nothing typed falls back to the on-screen action code pinpad.
export default function useActionCodeBuffer({ onDispatch, onOpenPad, onEnter, enabled = true }) {
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

      if (e.key === "Enter") {
        const entered = bufferRef.current;
        if (!entered) return;
        e.preventDefault();
        setBuffer("");
        onEnter?.(entered);
        return;
      }

      // Digits cover action codes and UPCs; letters and hyphens let a keyboard-wedge
      // scanner drop a full transaction number (TX-1A2B3C) straight onto the line.
      if (/^[0-9A-Za-z-]$/.test(e.key)) {
        setBuffer(prev => (prev + e.key.toUpperCase()).slice(0, 24));
      } else if (e.key === "Backspace") {
        setBuffer(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        setBuffer("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onDispatch, onOpenPad, onEnter]);

  return { buffer, clearBuffer: () => setBuffer("") };
}