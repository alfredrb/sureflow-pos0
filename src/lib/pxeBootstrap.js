// Turns a Register's hardware profile into the PXE / diskless boot artifacts the
// store controller serves that terminal. Pure string builders — no side effects.

const BOOT_IMAGES = {
  pxe_debian_legacy: {
    label: "PXE Debian — Legacy (SurePOS 700 class)",
    kernel: "debian-legacy/vmlinuz",
    initrd: "debian-legacy/initrd.img",
    // Must match the builder's LANE_ROOTS_DIR — a lane cannot mount a root that is
    // exported from a different path than the one on its kernel command line.
    nfsroot: "/srv/sureflow/roots/sureflow-legacy",
    // quiet splash hands the screen to Plymouth. Plymouth falls back to the text
    // console on failure, and ESC shows the messages live.
    // NO nomodeset: it stops i915 from initialising KMS, so there is no DRM device
    // and Plymouth renders nothing but its flat fallback field — the "grey splash".
    // The panel is driven by i915 KMS, with video= pinning the mode for the 4:3 lanes.
    extra: "i8042.nomux=1 i8042.reset video=1024x768 quiet splash",
  },
  pxe_debian_modern: {
    label: "PXE Debian — Modern (Elo EPS00E2 class)",
    kernel: "debian-modern/vmlinuz",
    initrd: "debian-modern/initrd.img",
    nfsroot: "/srv/sureflow/roots/sureflow-modern",
    extra: "quiet splash",
  },
};

export const isPxeRegister = (reg) => !!BOOT_IMAGES[reg?.boot_profile];

export const bootImageLabel = (reg) =>
  BOOT_IMAGES[reg?.boot_profile]?.label || "Local Disk (no PXE)";

const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

// Which HardwareLibrary driver profiles apply to this terminal. Matched on the
// model strings entered on the register's hardware profile. Touchscreen profiles
// are included for any PXE terminal — the panel is part of the lane, not a
// separately-recorded model field.
export function matchedProfiles(reg, profiles = []) {
  const models = [
    reg?.terminal_model,
    reg?.keyboard_model,
    reg?.scanner_model,
    reg?.printer_model,
    reg?.cash_drawer_model,
  ].filter(Boolean).map(norm);

  return profiles.filter(p => {
    if (p.active === false) return false;
    if (models.includes(norm(p.model))) return true;
    return p.device_type === "touchscreen" && isPxeRegister(reg);
  });
}

// MAC formatted the way pxelinux.cfg expects: 01-aa-bb-cc-dd-ee-ff
// The PUBLISHED POS address baked into every lane's boot entry. This is deliberately
// a constant and NOT window.location.origin: an entry generated from the builder's
// preview baked the preview-sandbox hostname into the lane, which the lane cannot
// use — it is a build-time origin, not the store-facing app. A lane must always boot
// the published app.
export const POS_CLOUD_URL = "https://sure-flow-pos.base44.app";

export function pxeConfigFileName(reg) {
  const mac = (reg.mac_address || "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (mac.length !== 12) return "pxelinux.cfg/default";
  return `pxelinux.cfg/01-${mac.match(/.{2}/g).join("-")}`;
}

// The per-terminal pxelinux entry, keyed by MAC so hardware identity drives the boot.
// relayUrl is the store's Local Relay VM, which usually lives on the BACKEND vlan —
// a different host from the PXE controller. Left blank it falls back to the
// controller's own address, which is only correct when both run on one box.
export function buildPxelinuxConfig(reg, controllerIp = "10.0.30.10", profiles = [], relayUrl = "") {
  const img = BOOT_IMAGES[reg.boot_profile];
  if (!img) {
    return `# ${reg.name} (${reg.register_id}) boots from local disk — no PXE entry required.`;
  }
  const matched = matchedProfiles(reg, profiles);
  const driverArgs = matched.map(p => (p.boot_args || "").trim()).filter(Boolean).join(" ");
  const modules = matched.flatMap(p => p.kernel_modules || []).filter(Boolean);
  const uniqueModules = [...new Set(modules)];

  return [
    `# SureFlow POS — ${reg.name} (${reg.register_id})`,
    `# Store ${reg.store_id || "—"} | MAC ${reg.mac_address || "UNSET"} | ${img.label}`,
    matched.length
      ? `# Driver profiles: ${matched.map(p => p.model).join(", ")}`
      : `# No hardware driver profiles matched — using image defaults.`,
    uniqueModules.length ? `# Kernel modules: ${uniqueModules.join(" ")}` : `# Kernel modules: image defaults`,
    `DEFAULT sureflow`,
    `PROMPT 0`,
    `TIMEOUT 30`,
    ``,
    `LABEL sureflow`,
    `  KERNEL ${img.kernel}`,
    `  INITRD ${img.initrd}`,
    // APPEND must be ONE physical line. pxelinux has no line-continuation syntax —
    // a trailing backslash truncates the kernel cmdline at that point, silently
    // dropping every argument after it (modules-load, register identity, relay URL).
    `  APPEND ${[
      `root=/dev/nfs`,
      `nfsroot=${controllerIp}:${img.nfsroot},vers=3,tcp`,
      `rw ip=dhcp`,
      img.extra,
      driverArgs,
      uniqueModules.length ? `modules-load=${uniqueModules.join(",")}` : "",
      `sureflow.register_id=${reg.register_id}`,
      `sureflow.store_id=${reg.store_id || ""}`,
      `sureflow.printer_ip=${reg.printer_ip || ""}`,
      `sureflow.scanner_if=${reg.scanner_interface || "usb_hid"}`,
      `sureflow.relay=${(relayUrl || "").trim().replace(/\/+$/, "") || `http://${controllerIp}:3000`}`,
      // The CLOUD POS address the kiosk browser opens. The lane appends
      // /pos/login?register_id=... to it, which is how the terminal selects its own
      // register with no on-screen picker. Required — the relay-served origin cannot
      // complete the platform login.
      `sureflow.pos_url=${POS_CLOUD_URL}`,
    ].filter(Boolean).join(" ")}`,
  ].join("\n");
}

// dnsmasq host reservation pinning this MAC onto the isolated PXE VLAN.
export function buildDnsmasqEntry(reg) {
  if (!reg.mac_address) return `# ${reg.register_id}: set a MAC address to generate a DHCP reservation.`;
  return [
    `# ${reg.name} (${reg.register_id}) — PXE VLAN ${reg.pxe_vlan || "unset"}, backend VLAN ${reg.backend_vlan || "unset"}`,
    `dhcp-host=${reg.mac_address},${reg.register_id.toLowerCase()},${reg.ip_address || "set-ip"}`,
  ].join("\n");
}

// Peripheral setup applied inside the image on first boot: IBM keyboard scancode
// mapping via hwdb, and the scanner's interface rules.
export function buildPeripheralRules(reg, profiles = []) {
  const lines = [`# Peripheral rules — ${reg.name} (${reg.register_id})`];

  // Rules maintained in the Hardware Driver Library win — edit them there once and
  // every register on that model picks the change up.
  const matched = matchedProfiles(reg, profiles).filter(p => (p.udev_rules || "").trim());
  matched.forEach(p => {
    lines.push(``, `# --- ${p.model} (${p.device_type}) — Hardware Driver Library ---`, p.udev_rules.trim());
  });
  const libKeyboard = matched.some(p => p.device_type === "keyboard");
  const libScanner = matched.some(p => p.device_type === "scanner");

  if (!libKeyboard && (reg.keyboard_model || "").replace(/\s/g, "").includes("3AA01194300")) {
    lines.push(
      ``,
      `# /etc/udev/hwdb.d/70-sureflow-ibm-pos-keyboard.hwdb`,
      `evdev:input:b0003v04B3p3025*`,
      ` KEYBOARD_KEY_70029=leftctrl   # IBM POS override strip`,
      ` KEYBOARD_KEY_7002b=tab`,
      ` KEYBOARD_KEY_70045=f9         # Action Code key — POS listens for F9`,
      `# apply with: systemd-hwdb update && udevadm trigger`,
    );
  } else if (!libKeyboard && reg.keyboard_model) {
    lines.push(``, `# ${reg.keyboard_model} uses stock USB HID mapping — no override needed.`);
  }

  if (libScanner) {
    // covered by the library profile above
  } else if (reg.scanner_interface === "usb_hid") {
    lines.push(``, `# ${reg.scanner_model || "Scanner"} — USB HID keyboard wedge, plug and play.`);
  } else if (reg.scanner_interface === "rs232_serial") {
    lines.push(
      ``,
      `# ${reg.scanner_model || "Scanner"} — RS-232: bind the serial port for the POS`,
      `KERNEL=="ttyS[0-9]", SUBSYSTEM=="tty", SYMLINK+="sureflow-scanner", MODE="0660", GROUP="sureflow"`,
    );
  } else if (reg.scanner_interface === "usb_ocia") {
    lines.push(
      ``,
      `# ${reg.scanner_model || "Scanner"} — legacy IBM USB-OCIA`,
      `SUBSYSTEM=="usb", ATTR{idVendor}=="04b3", SYMLINK+="sureflow-scanner", MODE="0660", GROUP="sureflow"`,
    );
  }

  if (reg.printer_ip) {
    lines.push(``, `# Receipt printer (${reg.printer_model || "ESC/POS"}) reached at ${reg.printer_ip}:9100 via the relay.`);
  }

  return lines.join("\n");
}

// Xorg input/output snippets (touch calibration matrices, evdev sections) pulled
// straight from the matched driver profiles — baked into the read-only image.
export function buildXorgConfig(reg, profiles = []) {
  const matched = matchedProfiles(reg, profiles).filter(p => (p.xorg_config || "").trim());
  if (!matched.length) {
    return `# No Xorg snippets on the matched driver profiles for ${reg.register_id}.`;
  }
  return matched
    .map(p => [`# --- ${p.model} (${p.device_type}) ---`, p.xorg_config.trim()].join("\n"))
    .join("\n\n");
}

// Debian packages the image build needs for this terminal's peripherals.
export function buildImagePackages(reg, profiles = []) {
  const pkgs = [...new Set(matchedProfiles(reg, profiles).flatMap(p => p.packages || []).filter(Boolean))];
  if (!pkgs.length) return `# No extra packages required beyond the base image for ${reg.register_id}.`;
  return [`# Inside the chroot for ${reg.register_id}:`, `apt-get install -y \\`, ...pkgs.map((p, i) => `  ${p}${i === pkgs.length - 1 ? "" : " \\"}`)].join("\n");
}