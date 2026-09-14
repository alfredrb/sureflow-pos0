import { useEffect, useRef } from "react";

// Silent robbery alarm on the physical keyboard. The override strip is remapped to
// Ctrl by hwdb and the Action Code key to F9, so Ctrl+Action Code arrives as
// Ctrl+F9; F10 is honoured too for layouts that emit it directly. No on-screen
// reaction until the confirmation dialog opens — nothing a robber could notice.
export default function useRobberyAlarm({ onTrigger, enabled = true }) {
  const ref = useRef({ onTrigger, enabled });
  useEffect(() => { ref.current = { onTrigger, enabled }; }, [onTrigger, enabled]);

  useEffect(() => {
    const onKey = (e) => {
      const s = ref.current;
      if (!s.enabled) return;
      const isAlarm = e.code === "F10" || (e.code === "F9" && e.ctrlKey);
      if (!isAlarm) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      s.onTrigger();
    };
    // Capture phase so the Action Code handler never sees the Ctrl-held press.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}