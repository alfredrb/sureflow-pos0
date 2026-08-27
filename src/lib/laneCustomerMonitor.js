// Dual-head provisioning for a lane fitted with a customer-facing monitor.
//
// The customer monitor is a SECOND Xorg output on the same lane — not a peripheral, not a
// serial device, and deliberately not a protocol. That is the whole reason it is a viable
// fallback for the pole displays: there is nothing to reverse-engineer. A second video
// output plus a second Chromium window is all of it.
//
// Consumed by pxeBootstrap (the kernel arg and the Xorg snippet a register generates) and
// by the Technical Docs setup step.

export const CUSTOMER_DISPLAY_ROUTE = "/customer-display";

// Xorg snippet placing the customer panel to the RIGHT of the operator panel in one
// combined screen. RightOf (rather than two separate screens) is what lets a single
// Chromium instance position a window onto the second panel with --window-position —
// separate :0.0 / :0.1 screens would need a second X server and a second browser profile.
export function buildCustomerMonitorXorg(reg) {
  const res = reg?.customer_monitor_resolution || "1920x1080";
  const portrait = reg?.customer_monitor_orientation === "portrait";
  return [
    `# /etc/X11/xorg.conf.d/30-sureflow-customer-monitor.conf`,
    `# ${reg?.name || "lane"} (${reg?.register_id || "?"}) — customer-facing second head`,
    `# Operator panel stays the primary output; the customer panel sits to its right in one`,
    `# combined screen so a single Chromium can place a window on it.`,
    `Section "Monitor"`,
    `    Identifier  "OperatorPanel"`,
    `    Option      "Primary" "true"`,
    `EndSection`,
    ``,
    `Section "Monitor"`,
    `    Identifier  "CustomerPanel"`,
    `    Option      "RightOf" "OperatorPanel"`,
    portrait ? `    Option      "Rotate" "left"` : `    # landscape — no rotation`,
    `EndSection`,
    ``,
    `Section "Screen"`,
    `    Identifier  "SureFlowScreen"`,
    `    # Virtual must cover BOTH panels or the second head is allocated no framebuffer`,
    `    # and comes up black with no error anywhere in the Xorg log.`,
    `    SubSection "Display"`,
    `        Virtual ${combinedVirtual(res, portrait)}`,
    `    EndSubSection`,
    `EndSection`,
  ].join("\n");
}

// The framebuffer has to span both panels side by side. Getting this wrong is the classic
// dual-head failure: X starts, the operator screen is fine, and the customer panel is
// black with nothing logged.
function combinedVirtual(res, portrait) {
  const [w, h] = (res || "1920x1080").split("x").map((n) => parseInt(n, 10) || 0);
  if (!w || !h) return "3840 1080";
  const cw = portrait ? h : w;
  const ch = portrait ? w : h;
  // Operator panel is assumed 1024x768 or 1920x1080; take the taller of the two.
  return `${1920 + cw} ${Math.max(1080, ch)}`;
}

// The launcher branch that opens the customer window. Kept here so the docs, the image
// builder and the kiosk script cannot drift apart.
export const CUSTOMER_WINDOW_SNIPPET = `# Second Chromium window on the customer panel, when the lane has one fitted.
# --window-position places it past the operator panel's width in the combined screen;
# --user-data-dir gives it its OWN profile so it never fights the POS window for the
# single-profile lock (two --kiosk windows in one profile is what makes the second one
# silently refuse to open).
if [ -n "$CUSTOMER_MONITOR" ] && [ "$CUSTOMER_MONITOR" != "0" ]; then
  CUST_URL="\${POS_URL%/}/customer-display?register_id=\$REGISTER_ID"
  chromium --kiosk "$CUST_URL" \\
    --user-data-dir=/tmp/sureflow-customer-profile \\
    --window-position=1920,0 \\
    --disable-gpu --noerrdialogs --disable-infobars --no-first-run \\
    --disable-session-crashed-bubble --disable-translate \\
    --check-for-update-interval=31536000 &
fi`;

export const CUSTOMER_MONITOR_STEP = {
  step_id: "pxe_customer_monitor",
  label: "Fit a customer-facing monitor (pole display alternative)",
  instructions: [
    "WHY THIS EXISTS: the 2x20 pole displays are blocked on protocol capture — the Toshiba TCx USB pole (0f66:4524) has no working transport at all, and the IBM / Toshiba RS-485 chain poles are awaiting frame capture from a live unit. A second monitor needs none of that: it is a second video output and a second browser window, both of which the lane already knows how to do.",
    "This does NOT replace the poles. A lane can be fitted with a pole, a monitor, or both — the monitor is configured in its own section on the Registers page, separate from pole_display_model, so the pole work continues untouched as the reserve path.",
    "The pinpad keeps its own role. Payment, PIN entry and signature capture stay on the Ingenico pad; the monitor is purely informational and has no controls on it at all, which matters because many of these panels are touch panels a customer will press.",
    "ONE combined X screen, with the customer panel RightOf the operator panel — not two separate :0.0 / :0.1 screens. Separate screens would need a second X server and a second browser profile; a combined screen lets one Chromium place a window onto the second panel with --window-position.",
    "The Virtual line must span BOTH panels. This is the classic dual-head failure: with too small a Virtual, X starts, the operator panel is perfect, and the customer panel is black with nothing at all in the Xorg log to explain it.",
    "The customer window needs its OWN --user-data-dir. Two --kiosk windows sharing one Chromium profile means the second one silently refuses to open — it looks exactly like the launcher never ran.",
    "The register_id travels the same way it already does for the POS window: off the kernel command line into the customer-display URL, so one shared image serves every lane with no per-lane config inside it.",
    "Transport for the live cart is a shared state record, not a socket. The monitor is a separate browser window from the POS, so it cannot be pushed to — the POS upserts this lane's display state and the monitor follows it over a realtime subscription.",
  ],
  commands: [
    "# On the CONTROLLER — confirm the lane has two outputs before configuring anything",
    "# (run this on a booted lane)",
    "DISPLAY=:0 xrandr --query        # expect two connected outputs",
    "# Generate the Xorg snippet + boot entry from the Registers page (open the register,",
    "# enable the Customer Monitor section, then press PXE) and install the snippet:",
    "sudo tee /srv/sureflow/roots/sureflow-legacy/etc/X11/xorg.conf.d/30-sureflow-customer-monitor.conf   # paste the generated snippet",
    "# Confirm the boot entry carries the flag",
    "grep -o 'sureflow.customer_monitor=[^ ]*' /srv/sureflow/tftp/pxelinux.cfg/01-*",
    "# On the LANE after rebooting",
    "DISPLAY=:0 xrandr --query        # both outputs active, customer panel right of operator",
    "pgrep -af chromium               # expect TWO chromium trees, different --user-data-dir",
  ],
  postInstructions: [
    "Ring an item up on the lane. It should appear on the customer panel within a moment, with the running total under it.",
    "Customer panel black but the operator panel fine? The Virtual line does not span both outputs — regenerate the snippet and confirm the width covers operator + customer.",
    "Only one Chromium window running? The second window is missing its own --user-data-dir, or sureflow.customer_monitor never reached the kernel command line. Check /proc/cmdline on the lane.",
    "Panel shows the idle rotation and never switches to the cart? The POS window is publishing to a different register_id than the monitor is reading — compare the register_id on both URLs.",
    "Cart shows but is frozen mid-sale? The monitor treats a state record older than five minutes as idle on purpose, so a closed POS window cannot strand a customer's cart on a public screen.",
  ],
};