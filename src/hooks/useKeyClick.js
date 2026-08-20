import { useEffect } from "react";
import { playKeyClick } from "@/lib/keyClick";

// Mirrors the lane keyboard's internal buzzer: one click per keystroke and per
// screen touch, exactly like a 4690 terminal. Capture phase so it fires even when
// a handler stops propagation.
export function useKeyClick(active = true) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => { if (!e.repeat) playKeyClick(); };
    const onPointer = () => playKeyClick();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [active]);
}

export default useKeyClick;