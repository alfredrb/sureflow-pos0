import React, { useEffect, useState } from "react";
import { base44 } from "@/api/data";
import { logAuditEvent } from "@/lib/auditLogger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, Save, AlertTriangle } from "lucide-react";
import KeyboardGrid from "@/components/keyboard/KeyboardGrid";
import KeySlotEditor from "@/components/keyboard/KeySlotEditor";
import HwdbOutput from "@/components/keyboard/HwdbOutput";
import ScancodeDecoder from "@/components/keyboard/ScancodeDecoder";
import KeyMapperWalkthrough from "@/components/keyboard/KeyMapperWalkthrough";
import { DEFAULT_KEYBOARD_MODEL, buildDefaultSlots, duplicateKeycodes, isCalibrated } from "@/lib/keyboardLayout";

export default function AdminKeyboardMapper() {
  const [layout, setLayout] = useState(null);
  const [functionKeys, setFunctionKeys] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      const [layouts, keys] = await Promise.all([
        base44.entities.KeyboardLayout.list(),
        base44.entities.FunctionKey.list(),
      ]);
      const existing = layouts.find((l) => l.active !== false);
      setFunctionKeys(keys.sort((a, b) => a.key_number - b.key_number));
      setLayout(
        existing || {
          keyboard_model: DEFAULT_KEYBOARD_MODEL,
          label: "Standard lane layout",
          slots: buildDefaultSlots(),
          notes: "",
          active: true,
        }
      );
    })();
  }, []);

  if (!layout) {
    return <div className="p-6 text-sm text-gray-500">Loading keyboard layout…</div>;
  }

  const selected = layout.slots.find((s) => s.slot_id === selectedId) || null;
  const dupes = duplicateKeycodes(layout.slots);

  const updateSlot = (next) =>
    setLayout({ ...layout, slots: layout.slots.map((s) => (s.slot_id === next.slot_id ? next : s)) });

  const save = async () => {
    setSaving(true);
    const payload = {
      keyboard_model: layout.keyboard_model,
      label: layout.label,
      slots: layout.slots,
      notes: layout.notes,
      active: true,
    };
    const saved = layout.id
      ? await base44.entities.KeyboardLayout.update(layout.id, payload)
      : await base44.entities.KeyboardLayout.create(payload);
    setLayout({ ...payload, id: saved?.id || layout.id });
    await logAuditEvent({
      action: "Updated Keyboard Key Map",
      category: "configuration",
      description: `Saved the visual key remap for ${payload.keyboard_model}: ${
        payload.slots.filter((s) => s.keycode).length
      } of ${payload.slots.length} physical keys mapped.`,
      page: "/admin/keyboard-mapper",
    });
    setSaving(false);
    setSavedAt(new Date());
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Keyboard className="h-5 w-5 text-gray-400" /> Visual Key Remapper
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Lay out the physical function-key block and choose what each key does. The map is stored
            per keyboard model, so every register on that model picks it up on its next boot.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save Layout"}
        </Button>
      </div>

      <KeyMapperWalkthrough />

      {!isCalibrated(layout.slots) && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>
            This model has no captured scancodes yet. Run the calibration step on a lane and enter each
            key's scancode — until then the generated map has nothing to apply.
          </p>
        </div>
      )}

      {dupes.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>Two keys share the same keycode: {dupes.join(", ").toUpperCase()}. Give each key its own keycode.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Keyboard Model</label>
          <Input
            value={layout.keyboard_model}
            onChange={(e) => setLayout({ ...layout, keyboard_model: e.target.value })}
            placeholder={DEFAULT_KEYBOARD_MODEL}
          />
          <p className="mt-1 text-xs text-gray-400">Matched against each register's keyboard model.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Layout Name</label>
          <Input value={layout.label || ""} onChange={(e) => setLayout({ ...layout, label: e.target.value })} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[auto,1fr]">
        <KeyboardGrid
          slots={layout.slots}
          functionKeys={functionKeys}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div className="space-y-4">
          <KeySlotEditor slot={selected} functionKeys={functionKeys} onChange={updateSlot} />
          <ScancodeDecoder />
          <HwdbOutput layout={layout} />
        </div>
      </div>

      {savedAt && (
        <p className="text-xs text-gray-400">
          Saved {savedAt.toLocaleTimeString()} — rebuild or refresh the diskless image to push the map to the lanes.
        </p>
      )}
    </div>
  );
}