import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const CUSTOM = "__custom__";
const NONE = "__none__";

// Model picker for a register's hardware field. Options come from the same records the
// lane image builder matches on, so the stored string is exact by construction. A model
// the library has never heard of is still allowed through Custom, and an already-stored
// unknown value is preserved rather than blanked.
export default function HardwareModelSelect({
  value, onChange, options = [], placeholder = "Select a model", emptyLabel,
}) {
  const known = useMemo(
    () => options.some((o) => o.model === value),
    [options, value]
  );
  const [manualCustom, setManualCustom] = useState(false);
  const isCustom = manualCustom || (!!value && !known);

  // Reopening the dialog on a different register must not carry the previous lane's
  // custom mode across.
  useEffect(() => { if (value && known) setManualCustom(false); }, [value, known]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const o of options) {
      const key = o.group || o.vendor || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    return [...map.entries()];
  }, [options]);

  if (isCustom) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          <span className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            custom
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setManualCustom(false); onChange(""); }}
          className="mt-1 text-xs text-blue-600 hover:underline"
        >
          Choose from the library instead
        </button>
        <p className="mt-1 text-xs text-amber-600">
          Not in the library — the image build will not find a driver profile for this model.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Select
        value={value || NONE}
        onValueChange={(v) => {
          if (v === CUSTOM) { setManualCustom(true); onChange(""); return; }
          onChange(v === NONE ? "" : v);
        }}
      >
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{emptyLabel || "Not set"}</SelectItem>
          {groups.map(([label, items]) => (
            <SelectGroup key={label}>
              <SelectLabel className="text-xs text-gray-400">{label}</SelectLabel>
              {items.map((o) => (
                <SelectItem key={o.model} value={o.model}>
                  {o.model}{o.note ? ` — ${o.note}` : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-gray-400">
        {options.length} active profile{options.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}