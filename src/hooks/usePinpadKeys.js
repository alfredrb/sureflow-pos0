import { useEffect } from "react";

/**
 * Physical-keyboard support for on-screen pinpads (IBM POS keyboard or any USB keyboard).
 *
 * Digits append to the buffer, Backspace deletes the last digit, Enter submits and
 * Escape clears. Only active while the pinpad it belongs to is on screen, so two
 * pinpads never fight over the same keystroke.
 */
export function usePinpadKeys({ active, value, setValue, maxLength = 6, onEnter, onClear }) {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        setValue((prev) => (prev.length >= maxLength ? prev : prev + e.key));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setValue((prev) => prev.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (value.length > 0 && onEnter) onEnter();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (onClear) onClear();
        else setValue("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, value, maxLength, onEnter, onClear, setValue]);
}

export default usePinpadKeys;