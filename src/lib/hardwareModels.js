// Sources the register hardware-profile dropdowns from the same records the lane image
// builder matches against, so a picked model string can never drift from the library.
//
// Why this matters: relaySync's hardware_profiles action matches Register model fields
// against HardwareLibrary.model exactly (lowercased/trimmed), and keyboard_layouts
// matches keyboard_model against KeyboardLayout.keyboard_model. A hand-typed
// "IBM 4820 SurePoint" vs a library "IBM SurePoint 4820" silently bakes nothing.

// Active profiles of one device type, deduped on model, sorted by vendor then model.
// Insertion order is meaningful — the select renders vendor groups in this order.
export function profilesByType(library = [], deviceType) {
  const seen = new Set();
  const out = [];
  for (const p of library) {
    if (p.device_type !== deviceType || p.active === false) continue;
    const model = String(p.model || "").trim();
    if (!model || seen.has(model.toLowerCase())) continue;
    seen.add(model.toLowerCase());
    out.push({ model, vendor: String(p.vendor || "").trim() });
  }
  return out.sort(
    (a, b) => (a.vendor || "~").localeCompare(b.vendor || "~") || a.model.localeCompare(b.model)
  );
}

// Keyboard is the one field whose truth lives in KeyboardLayout rather than the hardware
// library, because that is what the image build renders hwdb from. Saved maps come first;
// library keyboard profiles follow as a secondary group for models not yet calibrated.
export function keyboardModelOptions(layouts = [], library = []) {
  const seen = new Set();
  const out = [];

  for (const l of layouts) {
    if (l.active === false) continue;
    const model = String(l.keyboard_model || "").trim();
    if (!model || seen.has(model.toLowerCase())) continue;
    seen.add(model.toLowerCase());
    const mapped = (l.slots || []).filter((s) => s.scancode && s.keycode).length;
    out.push({
      model,
      group: "Saved keyboard maps",
      note: mapped > 0 ? `${mapped} key${mapped === 1 ? "" : "s"} mapped` : "not calibrated",
    });
  }

  for (const p of profilesByType(library, "keyboard")) {
    if (seen.has(p.model.toLowerCase())) continue;
    seen.add(p.model.toLowerCase());
    out.push({ model: p.model, group: "Hardware library (no saved map)" });
  }

  return out;
}