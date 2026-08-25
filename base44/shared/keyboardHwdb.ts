// Renders a saved KeyboardLayout into the hwdb file baked into a lane's NFS root.
//
// Backend-side twin of buildHwdbMap() in src/lib/keyboardLayout.js. It lives here
// (pure, no React/DOM) because relaySync must render the same map the visual remapper
// shows — a lane whose baked scancodes disagree with the admin panel is the worst kind
// of bug: every key "works", just not the key on the cap.

export interface HwdbSlot {
  scancode?: string;
  keycode?: string;
  cap_label?: string;
}

export interface HwdbLayout {
  keyboard_model?: string;
  vendor_id?: string;
  product_id?: string;
  ctrl_override?: boolean;
  slots?: HwdbSlot[];
}

/** Safe filename fragment for a model string (IBM 4820 -> ibm-4820). */
export function hwdbFileSlug(model: string): string {
  return String(model || 'keyboard')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'keyboard';
}

export function renderHwdbMap(layout: HwdbLayout): string {
  const model = layout?.keyboard_model || 'IBM 3AA01194300';
  // A slot with no captured scancode would emit a rule matching no key at all, so
  // only calibrated slots reach the map.
  const mapped = (layout?.slots || []).filter((s) => s.scancode && s.keycode);
  const vendor = String(layout?.vendor_id || '').trim().toUpperCase();
  const product = String(layout?.product_id || '').trim().toUpperCase();
  const match =
    vendor && product ? `evdev:input:b0003v${vendor}p${product}*` : `evdev:input:b0003v04B3p3025*`;

  const lines = [
    `# /etc/udev/hwdb.d/70-sureflow-pos-keyboard-${hwdbFileSlug(model)}.hwdb`,
    `# ${model} — baked by sureflow-build-lane-image from the saved key map`,
    `# The USB-HID MSR types its track data as ordinary digits — never remap a digit here.`,
    match,
  ];

  if (!mapped.length) {
    lines.push(` # No scancodes captured yet — calibrate this model in the key mapper.`);
  }
  mapped.forEach((s) => {
    lines.push(` KEYBOARD_KEY_${s.scancode}=${s.keycode}   # ${s.cap_label || ''}`.trimEnd());
  });

  if (layout?.ctrl_override !== false) {
    lines.push(
      `# The override strip stays Ctrl so Ctrl+Action Code (F10) keeps firing the`,
      `# silent robbery alarm. Never reassign F9 or F10.`,
      ` KEYBOARD_KEY_70029=leftctrl`,
    );
  } else {
    lines.push(
      `# Ctrl override disabled for this model — 70029 is a normal keycap here and`,
      `# must not become a Ctrl modifier.`,
    );
  }

  return lines.join('\n');
}