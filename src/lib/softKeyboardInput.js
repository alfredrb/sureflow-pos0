// Writes into a focused input the way a real keyboard does, so React controlled
// components see a normal change event and existing validation keeps working.

// Fields opt in by carrying this attribute — nothing is hijacked globally.
export const SOFT_KB_ATTR = "data-softkeyboard";

function nativeSetter(el) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, "value").set;
}

export function setValue(el, value, caret) {
  nativeSetter(el).call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const pos = caret ?? value.length;
  try { el.setSelectionRange(pos, pos); } catch { /* number inputs have no selection */ }
}

function caretOf(el) {
  const v = el.value ?? "";
  const start = el.selectionStart ?? v.length;
  const end = el.selectionEnd ?? start;
  return { v, start, end };
}

export function insertText(el, text) {
  const { v, start, end } = caretOf(el);
  setValue(el, v.slice(0, start) + text + v.slice(end), start + text.length);
}

export function backspace(el) {
  const { v, start, end } = caretOf(el);
  if (start !== end) return setValue(el, v.slice(0, start) + v.slice(end), start);
  if (start === 0) return;
  setValue(el, v.slice(0, start - 1) + v.slice(start), start - 1);
}

// DEL — forward delete, matching the 4690 keyboard's DEL key.
export function forwardDelete(el) {
  const { v, start, end } = caretOf(el);
  if (start !== end) return setValue(el, v.slice(0, start) + v.slice(end), start);
  setValue(el, v.slice(0, start) + v.slice(start + 1), start);
}

export function moveCaret(el, delta) {
  const { start } = caretOf(el);
  const pos = Math.max(0, Math.min((el.value ?? "").length, start + delta));
  try { el.setSelectionRange(pos, pos); } catch { /* ignore */ }
}

// ENTER — let the field's own key handler / form submit react to it.
export function pressEnter(el) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
}

// TAB — hop to the next (or previous) keyboard-enabled field in the same dialog.
export function focusSibling(el, dir) {
  const fields = Array.from(document.querySelectorAll(`[${SOFT_KB_ATTR}]`)).filter(f => f.offsetParent !== null);
  const i = fields.indexOf(el);
  if (i === -1) return;
  const next = fields[(i + dir + fields.length) % fields.length];
  next?.focus();
}