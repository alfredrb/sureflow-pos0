import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import SoftKeyboardKey from "@/components/pos/SoftKeyboardKey";
import { LETTER_ROWS, ROW_ACTIONS, BOTTOM_ACTIONS, NUM_ROWS } from "@/lib/softKeyboardLayout";
import {
  SOFT_KB_ATTR, insertText, backspace, forwardDelete, moveCaret, pressEnter, focusSibling,
} from "@/lib/softKeyboardInput";

// On-screen QWERTY for lanes whose keyboard has no letter keys (IBM 3AA01194300 /
// 4820 SurePoint). It attaches only to inputs flagged with data-softkeyboard, so
// the dedicated numeric keypads (action code, quantity/price, tender) are untouched.
export default function POSSoftKeyboard() {
  const [target, setTarget] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target;
      if (el?.hasAttribute?.(SOFT_KB_ATTR)) { setTarget(el); setCollapsed(false); }
      else if (!boardRef.current?.contains(el)) setTarget(null);
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, []);

  // Field went away with its dialog — drop the board.
  useEffect(() => {
    if (target && !document.body.contains(target)) setTarget(null);
  });

  if (!target) return null;

  const press = (action) => {
    const el = target;
    if (!el) return;
    switch (action) {
      case "bksp": return backspace(el);
      case "del": return forwardDelete(el);
      case "enter": return pressEnter(el);
      case "space": return insertText(el, " ");
      case "left": return moveCaret(el, -1);
      case "right": return moveCaret(el, 1);
      case "tab_next": return focusSibling(el, 1);
      case "tab_prev": return focusSibling(el, -1);
      default: return insertText(el, action);
    }
  };

  return (
    <div ref={boardRef} className="fixed bottom-0 left-0 right-0 z-[60] pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-5xl px-2 pb-2">
        {/* Collapsible header, as on the lane terminal */}
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setCollapsed(c => !c); }}
          className="mx-auto flex items-center gap-1.5 px-4 py-1 rounded-t-md bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest"
        >
          {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <Keyboard className="w-3 h-3" /> Keyboard
        </button>

        {!collapsed && (
          <div className="flex gap-2 rounded-lg border border-blue-500/20 bg-[#111638] p-2 shadow-2xl">
            {/* Letters + action keys */}
            <div className="flex-1 space-y-1.5">
              {LETTER_ROWS.map((row, r) => (
                <div key={r} className="flex gap-1.5">
                  {row.map(k => (
                    <SoftKeyboardKey key={k} label={k} onPress={() => press(k)} className="flex-1 min-w-0" />
                  ))}
                  {ROW_ACTIONS[r].map(a => (
                    <SoftKeyboardKey key={a.key} label={a.label} accent onPress={() => press(a.key)} className="w-16 shrink-0" />
                  ))}
                </div>
              ))}
              <div className="flex gap-1.5">
                {BOTTOM_ACTIONS.map(a => (
                  <SoftKeyboardKey
                    key={a.key}
                    label={a.label}
                    accent
                    onPress={() => press(a.key)}
                    className={a.wide ? "flex-1" : "w-14 shrink-0"}
                  />
                ))}
              </div>
            </div>

            {/* Numeric pad — always present, like the reference terminal */}
            <div className="space-y-1.5 border-l border-blue-500/10 pl-2">
              {NUM_ROWS.map((row, r) => (
                <div key={r} className="flex gap-1.5">
                  {row.map(k => (
                    <SoftKeyboardKey key={k} label={k} onPress={() => press(k)} className="w-11 shrink-0" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}