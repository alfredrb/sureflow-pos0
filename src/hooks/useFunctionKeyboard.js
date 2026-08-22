import { useEffect, useRef } from "react";

// Physical function-key block → POS function keys.
//
// The lane's saved keyboard layout maps each captured hardware scancode to a
// keycode (hwdb does that remap at boot) and that keycode to a FunctionKey number.
// Here the browser's key event is matched back onto the same slot, so pressing
// CASH on the keyboard runs exactly what the on-screen CASH key runs.
//
// F9 / F10 are skipped — they belong to the Action Code key and the Ctrl+Action
// Code silent alarm, which have their own handlers.
const RESERVED = ["F9", "F10"];

export default function useFunctionKeyboard({ slots = [], functionKeys = [], onFunctionKey, enabled = true }) {
  const ref = useRef({ slots, functionKeys, onFunctionKey, enabled });
  useEffect(() => { ref.current = { slots, functionKeys, onFunctionKey, enabled }; }, [slots, functionKeys, onFunctionKey, enabled]);

  useEffect(() => {
    const onKey = (e) => {
      const s = ref.current;
      if (!s.enabled) return;
      if (!/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) return;
      if (RESERVED.includes(e.code)) return;
      const slot = s.slots.find(
        (sl) => (sl.keycode || "").toLowerCase() === e.code.toLowerCase() && sl.function_key_number
      );
      if (!slot) return;
      const fkey = s.functionKeys.find((k) => k.key_number === slot.function_key_number);
      if (!fkey) return;
      e.preventDefault();
      s.onFunctionKey(fkey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}