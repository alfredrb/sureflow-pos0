// Technical Documentation catalog.
//
// Structured around how the estate is actually worked on rather than as one flat list:
// the four "Build & Deploy" sections are the path a technician walks to stand a store up,
// and everything below them is reference material you only open when something specific
// is wrong. The installer wizard now carries the files these sections describe, so the
// deep infrastructure sections are troubleshooting aids, not build instructions.
//
// keywords exist purely for the search box — the words a technician would actually type
// when they do not know which section holds the answer.

export const SECTION_GROUPS = [
  {
    id: "build",
    label: "Build & Deploy",
    blurb: "The path to a working store, in order.",
    sections: [
      {
        id: "hardware",
        label: "Fleet Hardware",
        blurb: "Terminals, keyboards, pole displays, scanners, printing and lane validation.",
        keywords: "hardware fleet terminal surepos elo lane models specs validation",
      },
      {
        id: "ports",
        label: "Terminal Ports",
        blurb: "Rear-panel port maps and wiring tables per terminal model.",
        keywords: "ports wiring rear panel rj45 rj11 usb serial powered cable map",
      },
      {
        id: "debianbuild",
        label: "Debian Controller Build",
        blurb: "Bare metal before the wizard: disk layout, dual-NIC VLAN setup and the fleet IP standard.",
        keywords: "debian install disk partition nic vlan ip scheme netplan interfaces drbd raw switch trunk native subnet 10.0.40.10 10.0.25.12",
      },
      {
        id: "installer",
        label: "Controller Installer",
        blurb: "Guided whiptail build of a store controller, with this store's answer sheet and bundle download.",
        keywords: "installer wizard whiptail tarball bundle answer sheet controller.conf relay key build",
      },
    ],
  },
  {
    id: "documents",
    label: "Document Library",
    blurb: "The sourced material behind all of the above.",
    sections: [
      {
        id: "documents",
        label: "Documents & Sources",
        blurb: "Vendor PDFs, manuals, spec sheets, firmware and source links, searchable by device.",
        keywords: "pdf manual document source vendor spec sheet firmware driver datasheet upload library gc30 archive",
      },
    ],
  },
  {
    id: "controller",
    label: "Controller Troubleshooting",
    blurb: "When a store's controller, boot or sync misbehaves.",
    sections: [
      {
        id: "controllermenu",
        label: "Controller Console Menu",
        blurb: "The login menu on the box: relay health, PXE status, logs, and this store's operators.",
        keywords: "console menu sureflow-menu login whiptail operators relay health logs",
      },
      {
        id: "pxe",
        label: "PXE Controller",
        blurb: "Diskless boot: DHCP/TFTP, NFS roots, kiosk image and boot profiles.",
        keywords: "pxe tftp dnsmasq dhcp nfs root diskless boot profile pxelinux kiosk image",
      },
      {
        id: "hacluster",
        label: "Controller Redundancy",
        blurb: "Dual controller pair: DRBD mirror, floating VIP and automatic promotion.",
        keywords: "ha redundancy drbd keepalived vrrp vip failover failback promote split brain",
      },
      {
        id: "maintenance",
        label: "Nightly Maintenance",
        blurb: "Midnight lane reboot and update window: staggered batches and busy-lane deferral.",
        keywords: "maintenance window nightly reboot stagger batch defer midnight lane",
      },
      {
        id: "relay",
        label: "Relay Deployment",
        blurb: "Local Relay build: OS, networking, app, printing and telemetry.",
        keywords: "relay deployment env systemd node server.js printing telemetry bind",
      },
      {
        id: "cloudupdate",
        label: "Cloud-Pushed Updates",
        blurb: "Pinned git ref checked out by the controller itself, health-gated with rollback.",
        keywords: "cloud update git ref release rollout rollback health gate pinned tag",
      },
      {
        id: "relayupdate",
        label: "Relay Feature Update",
        blurb: "Step-by-step upgrade of an existing relay: modules, routes, bridges and verification.",
        keywords: "relay update upgrade patch module route bridge verify snapshot",
      },
    ],
  },
  {
    id: "lane",
    label: "Lane Peripheral Troubleshooting",
    blurb: "One lane, one device, one fault.",
    sections: [
      {
        id: "check",
        label: "Cheque Station",
        blurb: "MICR reading, endorsement franking, relay cheque routes and diagnostics.",
        keywords: "cheque check micr e13b franking endorsement slip station tm-h6000 two pass",
      },
      {
        id: "pinpad",
        label: "Customer Pinpad",
        blurb: "Ingenico signature capture, prompts, cart mirror, rating and relay pinpad routes.",
        keywords: "pinpad ingenico isc250 lane7000 signature prompt rating cart mirror 12000",
      },
      {
        id: "poledisplay",
        label: "Pole Display",
        blurb: "Customer line display: item/total mirror, amount due and change.",
        keywords: "pole display line display dm-d110 2x20 rs485 4610 4820 9101 frame capture",
      },
      {
        id: "customermonitor",
        label: "Customer Monitor",
        blurb: "Second customer-facing screen: dual-head Xorg, the second kiosk window and the live cart feed.",
        keywords: "customer monitor second screen dual head display xorg xrandr rightof virtual kiosk window user-data-dir customer-display pole alternative idle slides promotion thank you",
      },
      {
        id: "bootstatus",
        label: "Boot Status Codes",
        blurb: "Boot-stage codes written to the lane's pole display — read where a lane stopped off the glass.",
        keywords: "boot status code pole diagnostic b10 b30 e01 e02 black screen initramfs stage stuck 4690 numeric code splash beep",
      },
      {
        id: "bridge",
        label: "Lane Serial Bridge",
        blurb: "USB pinpads and poles published as TCP ports on the lane.",
        keywords: "serial bridge ser2net socat usb tcp 9101 12000 ttyusb",
      },
      {
        id: "printerbridge",
        label: "USB Printer Bridge",
        blurb: "Single-cable lane: the USB receipt printer published on the lane's IP.",
        keywords: "printer bridge usb socat 9100 ub-u06 single cable fallback ethernet",
      },
      {
        id: "drawerbridge",
        label: "USB Drawer Bridge",
        blurb: "Reserved contingency for a native USB cash drawer.",
        keywords: "cash drawer usb bridge 9102 sdl rj11 dk esc p hidraw",
      },
      {
        id: "scanner",
        label: "Barcode Scanner",
        blurb: "Auto-Enter suffix programming so a scan rings up without a key press.",
        keywords: "scanner barcode zebra ds4308 suffix auto enter cr lf programming ocia rs232",
      },
      {
        id: "keyboard",
        label: "POS Keyboard Scan Codes",
        blurb: "Official IBM GC30-3623 scan-code tables mapped to the remapper workflow.",
        keywords: "keyboard scancode hwdb evtest showkey anpos gc30-3623 4820 3aa01194300 remap",
      },
      {
        id: "keyturnmsr",
        label: "Keyturn & MSR",
        blurb: "The barrel lock and the magstripe reader — why neither is in the key remapper.",
        keywords: "keyturn barrel lock key position msr magstripe swipe sod",
      },
    ],
  },
  {
    id: "reference",
    label: "Reference Data",
    blurb: "Live configuration the image build reads.",
    sections: [
      {
        id: "library",
        label: "Driver Library",
        blurb: "Per-model driver profiles applied to the diskless image at build time.",
        keywords: "driver library profile packages kernel modules udev xorg boot args model",
      },
    ],
  },
];

export const ALL_SECTIONS = SECTION_GROUPS.flatMap((g) =>
  g.sections.map((s) => ({ ...s, groupId: g.id, groupLabel: g.label })),
);

// Matches on label, blurb and the keyword line, so "drbd" finds Controller Redundancy
// and "micr" finds the Cheque Station without the technician knowing our section names.
export function searchSections(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = q.split(/\s+/);
  return ALL_SECTIONS.filter((s) => {
    const hay = `${s.label} ${s.blurb} ${s.keywords} ${s.groupLabel}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}