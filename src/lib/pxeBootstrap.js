// Turns a Register's hardware profile into the PXE / diskless boot artifacts the
// store controller serves that terminal. Pure string builders — no side effects.

const BOOT_IMAGES = {
  pxe_debian_legacy: {
    label: "PXE Debian — Legacy (SurePOS 700 class)",
    kernel: "debian-legacy/vmlinuz",
    initrd: "debian-legacy/initrd.img",
    nfsroot: "/srv/nfs/sureflow-legacy",
    extra: "nomodeset i8042.nomux=1 i8042.reset",
  },
  pxe_debian_modern: {
    label: "PXE Debian — Modern (Elo EPS00E2 class)",
    kernel: "debian-modern/vmlinuz",
    initrd: "debian-modern/initrd.img",
    nfsroot: "/srv/nfs/sureflow-modern",
    extra: "quiet",
  },
};

export const isPxeRegister = (reg) => !!BOOT_IMAGES[reg?.boot_profile];

export const bootImageLabel = (reg) =>
  BOOT_IMAGES[reg?.boot_profile]?.label || "Local Disk (no PXE)";

// MAC formatted the way pxelinux.cfg expects: 01-aa-bb-cc-dd-ee-ff
export function pxeConfigFileName(reg) {
  const mac = (reg.mac_address || "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (mac.length !== 12) return "pxelinux.cfg/default";
  return `pxelinux.cfg/01-${mac.match(/.{2}/g).join("-")}`;
}

// The per-terminal pxelinux entry, keyed by MAC so hardware identity drives the boot.
export function buildPxelinuxConfig(reg, controllerIp = "10.0.30.10") {
  const img = BOOT_IMAGES[reg.boot_profile];
  if (!img) {
    return `# ${reg.name} (${reg.register_id}) boots from local disk — no PXE entry required.`;
  }
  return [
    `# SureFlow POS — ${reg.name} (${reg.register_id})`,
    `# Store ${reg.store_id || "—"} | MAC ${reg.mac_address || "UNSET"} | ${img.label}`,
    `DEFAULT sureflow`,
    `PROMPT 0`,
    `TIMEOUT 30`,
    ``,
    `LABEL sureflow`,
    `  KERNEL ${img.kernel}`,
    `  INITRD ${img.initrd}`,
    `  APPEND root=/dev/nfs nfsroot=${controllerIp}:${img.nfsroot},vers=3,tcp rw ip=dhcp ${img.extra} \\`,
    `    sureflow.register_id=${reg.register_id} sureflow.store_id=${reg.store_id || ""} \\`,
    `    sureflow.printer_ip=${reg.printer_ip || ""} sureflow.scanner_if=${reg.scanner_interface || "usb_hid"} \\`,
    `    sureflow.relay=http://${controllerIp}:3000`,
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
export function buildPeripheralRules(reg) {
  const lines = [`# Peripheral rules — ${reg.name} (${reg.register_id})`];

  if ((reg.keyboard_model || "").replace(/\s/g, "").includes("3AA01194300")) {
    lines.push(
      ``,
      `# /etc/udev/hwdb.d/70-sureflow-ibm-pos-keyboard.hwdb`,
      `evdev:input:b0003v04B3p3025*`,
      ` KEYBOARD_KEY_70029=leftctrl   # IBM POS override strip`,
      ` KEYBOARD_KEY_7002b=tab`,
      `# apply with: systemd-hwdb update && udevadm trigger`,
    );
  } else if (reg.keyboard_model) {
    lines.push(``, `# ${reg.keyboard_model} uses stock USB HID mapping — no override needed.`);
  }

  if (reg.scanner_interface === "usb_hid") {
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