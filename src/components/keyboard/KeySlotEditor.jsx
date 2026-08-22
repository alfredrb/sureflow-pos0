import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KEYCODE_OPTIONS, RESERVED_KEYCODES, normalizeScancode } from "@/lib/keyboardLayout";

const NONE = "__none__";

// Edit one physical key slot: its captured scancode, the logical key hwdb maps it
// to, and which POS function key that fires.
export default function KeySlotEditor({ slot, functionKeys, onChange }) {
  if (!slot) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Select a key on the layout to edit what it does.
      </div>
    );
  }

  const set = (k) => (v) => onChange({ ...slot, [k]: v });

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Editing key</p>
        <p className="text-base font-semibold text-gray-900">{slot.cap_label}</p>
        <p className="text-xs text-gray-400">Row {slot.row}, column {slot.col}</p>
      </div>

      {slot.locked && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
          This key is reserved by the POS — the Action Code dialog and the Ctrl+Action Code
          silent alarm depend on it. Its keycode cannot be changed.
        </p>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Keycap label</label>
        <Input value={slot.cap_label || ""} onChange={(e) => set("cap_label")(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hardware scancode</label>
        <Input
          value={slot.scancode || ""}
          onChange={(e) => set("scancode")(normalizeScancode(e.target.value))}
          placeholder="70045"
          className="font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">
          Captured once per keyboard model. Paste it exactly as the tool printed it — a showkey
          value like <span className="font-mono">0x3b</span> has its <span className="font-mono">0x</span> stripped
          automatically, because hwdb takes the bare hex.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Remap to keycode</label>
        <Select value={slot.keycode || NONE} onValueChange={(v) => set("keycode")(v === NONE ? "" : v)} disabled={slot.locked}>
          <SelectTrigger><SelectValue placeholder="Unmapped" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Unmapped</SelectItem>
            {KEYCODE_OPTIONS.map((k) => (
              <SelectItem key={k} value={k}>
                {k.toUpperCase()}{RESERVED_KEYCODES.includes(k) ? " — reserved" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">POS function key</label>
        <Select
          value={slot.function_key_number ? String(slot.function_key_number) : NONE}
          onValueChange={(v) => set("function_key_number")(v === NONE ? null : Number(v))}
        >
          <SelectTrigger><SelectValue placeholder="No action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No action</SelectItem>
            {functionKeys.map((k) => (
              <SelectItem key={k.key_number} value={String(k.key_number)}>
                {k.key_number}. {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}