// Content index for the Technical Documentation search.
//
// The reference sections are React components, so their prose cannot be crawled at
// runtime. Instead each section declares its topics here: the specific question a
// technician arrives with, and enough text to recognise the answer. That is deliberately
// better than crawling would be — a crawl returns whichever paragraph happens to contain
// the word, while these entries are the things people actually come looking for.
//
// Adding a topic is one line, and the ALL_SECTIONS catalog supplies the group / section
// labels so a result can always say where it lives.

import { ALL_SECTIONS } from "@/lib/techDocSections";

const T = (section, topic, text) => ({ section, topic, text });

export const TOPIC_INDEX = [
  // --- Fleet Hardware ---
  T("hardware", "Approved terminal models", "IBM SurePOS 700 legacy lanes and Elo EPS00E2 modern lanes. Toshiba 4900-C67 is rejected: limited storage, locked OS, no Linux driver support."),
  T("hardware", "Controller hardware choice", "Dell OptiPlex 5040 SFF. The 3040 Micro is rejected — no PCIe expansion and no second drive bay, so it cannot be a dual-NIC HA controller. Prioritise RAM over CPU."),
  T("hardware", "Lane storage requirement", "Diskless lanes hold no storage of their own; the NFS root lives on the controller's SSD. Spinning disk here is felt on every lane at once."),
  T("hardware", "Keyboard models in the fleet", "IBM 3AA01194300 with the separate S1/S2 system strip, and the IBM 4820 SurePoint whose keypad has S1 as ITEM INQUIRY and S2 as ERROR CORRECT."),

  // --- Terminal Ports ---
  T("ports", "Powered USB and RJ45 port map", "Rear-panel port maps per terminal model, showing which ports are powered USB, which are RS-232, and which carry the drawer and printer."),
  T("ports", "Which port the printer goes in", "Per-model wiring table for the receipt printer, cash drawer DK line, scanner and pole display."),

  // --- Debian Controller Build ---
  T("debianbuild", "Fleet IP standard", "VLAN 40 PXE isolated 10.0.40.0/24: primary controller 10.0.40.10, secondary 10.0.40.11, floating PXE VIP 10.0.40.50, lane DHCP pool 10.0.40.100-200. VLAN 25 backend routed 10.0.25.0/24: primary relay 10.0.25.12, secondary 10.0.25.13, backend VIP 10.0.25.50, printers .60-.79, pinpads .80-.99, gateway 10.0.25.1. Same last octets at every store."),
  T("debianbuild", "Disk layout, standalone controller", "sda1 512MB EFI, sda2 40GB ext4 root, sda3 8GB swap, sda4 remainder ext4 mounted /var/log so a runaway log cannot fill root, and the whole second SSD ext4 at /srv/sureflow for lane roots, TFTP and the relay."),
  T("debianbuild", "Disk layout, HA pair", "The OS disk is local and not mirrored. The second SSD is left RAW as the DRBD backing device — formatting it is the classic mistake. /dev/drbd0 is ext4 mounted at /srv/sureflow only on the box holding the primary role, mounted by keepalived and never listed in fstab."),
  T("debianbuild", "No LVM, no encryption", "No LVM: it adds a layer between DRBD and the disk for flexibility this box never needs. No encryption on /srv/sureflow: an unattended reboot must complete with nobody present to type a passphrase."),
  T("debianbuild", "Dual-NIC interfaces file", "Two physical NICs in /etc/network/interfaces. The backend NIC carries the address, the gateway and DNS. The PXE NIC has an address and deliberately NO gateway line — that omission is the isolation."),
  T("debianbuild", "Only one default route", "ip route must show exactly one default, via 10.0.25.1 on the backend NIC. Two defaults means a gateway was put on the PXE interface and lane traffic will intermittently leak out of the isolated VLAN."),
  T("debianbuild", "Switch port and VLAN config", "Controller backend port untagged VLAN 25, controller PXE port untagged VLAN 40, lane ports trunked with VLAN 40 as the untagged NATIVE vlan because a PXE ROM cannot tag a frame. VLAN 40 gets no SVI and no DHCP relay."),
  T("debianbuild", "Lane will not PXE boot", "Most common cause is the lane port's native VLAN not being 40, so the boot request arrives tagged and never reaches dnsmasq. Confirm with tcpdump on the PXE NIC on port 67 while powering the lane: no DISCOVER means the VLAN, a DISCOVER with no reply means dnsmasq."),
  T("debianbuild", "Debian netinst installer answers", "Debian 12 bookworm netinst. Hostname sfc-<store>-a. Install over the backend NIC — it is the only one with a route out. Untick the desktop environment and print server; tick only SSH server and standard utilities. Manual partitioning; do not let guided mode touch the second SSD."),
  T("debianbuild", "ip_nonlocal_bind for HA", "Both HA boxes need net.ipv4.ip_nonlocal_bind = 1 so a service can bind the floating VIP before keepalived has finished bringing it up."),
  T("debianbuild", "DRBD replication network", "DRBD replicates over the backend VLAN between 10.0.25.12 and 10.0.25.13, never over the PXE VLAN, so a lane boot storm cannot starve the disk mirror."),

  // --- Controller Installer ---
  T("installer", "Running the installer wizard", "sudo ./install from the extracted bundle, or paste /usr/local/sbin/sureflow-controller-install by hand. Re-runnable: answers are saved to /etc/sureflow/controller.conf at mode 600 and offered back as defaults."),
  T("installer", "Installer bundle download", "Download a generic or store-specific .tar.gz containing the wizard, the console menu, the lane agent and a pre-seeded answer sheet."),
  T("installer", "What the wizard asks for", "Store number, box role (standalone / primary / secondary), the PXE-VLAN IP, the backend-VLAN IP, the PXE subnet, both floating VIPs and the peer's backend IP on an HA pair, and the relay API key from the Infrastructure Command Center."),
  T("installer", "What the wizard does not do", "It does not stage a lane root under /srv/sureflow/roots and it does not bring up DRBD replication on an HA pair. The summary screen says which steps remain."),
  T("installer", "Relay unit is disabled on HA", "On an HA box the wizard leaves sureflow-relay disabled on purpose — keepalived's role script owns it. An enabled unit would run the relay on both boxes and double every cloud sync."),
  T("installer", "Store answer sheet", "Per-store crib sheet of every value the wizard asks for, generated from the store record so a technician on site is not reading another store's numbers."),

  // --- Controller Console Menu ---
  T("controllermenu", "Console menu on login", "sureflow-menu runs from /etc/profile.d on interactive login: relay health, restart, PXE and boot status, the relay log, lane management and operator administration."),
  T("controllermenu", "Add or remove an operator at the store", "The menu manages this store's operators against the cloud through relaySync, using the box's own store API key. Every change is written to the audit trail."),
  T("controllermenu", "Lane status and batched reboots", "Live lane status from relay heartbeat polls, with on-demand and batched reboots and image rebuilds. There is no SSH to lanes — VLAN 40 has no inbound routing."),

  // --- PXE Controller ---
  T("pxe", "dnsmasq DHCP and TFTP config", "dnsmasq bound to the PXE interface only with bind-interfaces, dhcp-boot pxelinux.0, dhcp-option 66 pointing at the PXE VIP, and tftp-root /srv/sureflow/tftp."),
  T("pxe", "NFS root export", "Lane roots exported from /srv/sureflow/roots. A read-only NFS root causes systemd service failures; write paths must be tmpfs or bind-mounted."),
  T("pxe", "Boot profiles per terminal", "pxe_debian_legacy for SurePOS 700 class hardware, pxe_debian_modern for Elo EPS00E2 class, local_disk for a terminal that boots itself. The register's MAC is the hardware identity, not a static IP."),

  // --- Controller Redundancy ---
  T("hacluster", "keepalived and the floating VIP", "VRRP holds the PXE and backend VIPs on whichever box is acting primary, so lanes and the cloud never depend on which box is alive."),
  T("hacluster", "DRBD mirror and split brain", "The raw second disk is mirrored between the pair. /dev/drbd0 mounts only on the primary; recovery from split brain requires choosing a survivor and discarding the other side's changes."),
  T("hacluster", "Failover and controlled failback", "The relay health watch promotes the secondary when the primary goes stale and records the reason. Failback is deliberately manual, once the original primary is back and DRBD has resynced."),

  // --- Nightly Maintenance ---
  T("maintenance", "Maintenance window and stagger", "Per-store window with a batch size and interval; each lane's release time is window start plus batch index times the interval, so the store is never fully dark."),
  T("maintenance", "Busy lane deferral", "A lane with an open sale or an operator still clocked in is deferred with a reason and retried, then skipped at the cutoff. A lane is never rebooted mid-transaction."),
  T("maintenance", "Lanes pick up a new image on reboot", "A rebuilt NFS root is adopted by the staggered reboots the window already plans, so no lane is touched by hand."),

  // --- Relay Deployment ---
  T("relay", "Relay .env file", "STORE_ID, RELAY_API_KEY, CLOUD_SYNC_URL, BIND_ADDRESS on the backend VIP, PORT 3000. Never put inline comments in this file — they are parsed as part of the value and produce NaN or invalid config."),
  T("relay", "Relay systemd unit", "sureflow-relay runs as the sureflow user from /srv/sureflow/relay with the .env as EnvironmentFile and Restart=on-failure."),
  T("relay", "Relay health endpoint", "curl http://127.0.0.1:3000/api/health on the box; the Infrastructure Command Center polls the store's relay_url, which must be the backend VIP."),
  T("relay", "Express catch-all route", "Express 5 rejects '*' route matching — use a catch-all app.use middleware, and guard res.headersSent or every page load throws ERR_HTTP_HEADERS_SENT."),

  // --- Cloud-Pushed Updates ---
  T("cloudupdate", "Pinned git ref releases", "A release pins a branch, tag or commit SHA. A tag or SHA is strongly preferred: a branch moves, and two stores updating on different nights would land on different code."),
  T("cloudupdate", "Health gate and rollback", "The controller checks out the ref during its own maintenance window, restarts and must pass a health gate; a failure restores the previous ref and reports rolled_back."),
  T("cloudupdate", "A store never updates outside its window", "An assignment stays pending until the nightly sweep folds it into the store's maintenance window. A store with no enabled window never receives a push."),

  // --- Relay Feature Update ---
  T("relayupdate", "Upgrading an existing relay", "Snapshot first, update the .env, drop in the new modules, patch server.js, rebuild and confirm the build stamp."),
  T("relayupdate", "npm build permission errors", "Never run npm install or npm run build with sudo in a root-owned checkout — it causes EACCES on Vite temporary files. Fix ownership and build as the unprivileged user."),

  // --- Cheque Station ---
  T("check", "MICR reading", "The TM-H6000 cheque reader returns the raw E-13B line including the T/o/d symbol markers; the routing number is validated with the ABA mod-10 checksum before the tender is accepted."),
  T("check", "Endorsement franking and paper source", "ESC c 0 n selects the station. n=4 is the required value for the slip station on the TM-H6000V fleet — proven by direct printer testing; the bitfield reading of n=2 is wrong."),
  T("check", "Cheque prints to the wrong printer", "Endorsement must go to the impact slip station, not the thermal receipt station. A cheque endorsement appearing on receipt paper means the station select never took."),
  T("check", "Slip station does not auto-cut", "Known behaviour on the impact printer — the slip station has no cutter, so the operator removes the document."),

  // --- Customer Pinpad ---
  T("pinpad", "Supported pinpad models", "Ingenico iSC Touch 250 is supported today over Ethernet or USB; Lane/7000 is a reserved profile. A blank model means every pinpad prompt is skipped silently."),
  T("pinpad", "USB pinpad on port 12000", "A USB pad is reached through the lane's ser2net serial bridge on port 12000, so pinpad_ip is the LANE's own address, not the pad's."),
  T("pinpad", "Signature capture and rating screen", "Cheque-writer signature capture, customer prompts, the cart mirror and the 1-5 rating screen are driven by the relay from the model's command profile in the driver library."),

  // --- Pole Display ---
  T("poledisplay", "Supported pole profiles", "Epson DM-D110 pass-through via the receipt printer is supported today. The IBM 4610 and Toshiba 4820 2x20 RS-485 chain profiles stay reserved until their frames are captured from a live unit."),
  T("poledisplay", "USB pole on port 9101", "A USB pole is published by the lane's serial bridge on port 9101, so pole_display_ip is the lane's own address. Printer-attached poles leave it blank and route through printer_ip."),

  // --- Lane Serial Bridge ---
  T("bridge", "ser2net and socat bridges", "USB pinpads and poles are published as TCP ports on the lane so the relay code is transport-agnostic: 9100 printer, 9101 pole, 9102 drawer, 12000 pinpad."),
  T("bridge", "Stable device symlinks", "udev rules give each USB serial device a stable /dev symlink and the right permissions, so a re-plug does not shuffle ttyUSB numbering."),

  // --- USB Printer Bridge ---
  T("printerbridge", "Single-cable lane", "The USB receipt printer (Epson UB-U06) is published on the lane's own IP on port 9100 by socat, so the lane needs one uplink cable."),
  T("printerbridge", "Printer Ethernet fallback", "The TM-H6000IV serves USB and Ethernet concurrently. Keep the Ethernet interface cabled and record it as printer_fallback_ip — recovery is pasting it into printer_ip, with no site visit."),

  // --- USB Drawer Bridge ---
  T("drawerbridge", "Drawer on the printer DK port", "The fleet standard: the drawer hangs off the printer's DK/RJ11 port and the printer fires the 24V pulse when the POS sends ESC p. Transport-agnostic and needs no profile."),
  T("drawerbridge", "Native USB drawer contingency", "Reserved path if the SDL drawer variant is discontinued: the drawer is published on the lane's bridge port 9102 and driven by the model's own open command, per lane, with no fleet-wide change."),

  // --- Barcode Scanner ---
  T("scanner", "Auto-Enter suffix programming", "Programming the scanner to append a CR so a scan rings the item up without an operator key press. Zebra DS4308 is the fleet default over USB HID keyboard wedge."),
  T("scanner", "Legacy scanner interfaces", "RS-232 serial and USB OCIA are legacy IBM interfaces that need extra driver setup; usb_hid needs none."),

  // --- Keyboard scan codes ---
  T("keyboard", "Capturing scancodes", "showkey does not reliably capture every key — some are consumed by the keyboard controller before the AT translation layer. Use evtest for those."),
  T("keyboard", "hwdb match line and product ID", "The hwdb match must carry the keyboard's real vendor and product ID: 04B3:3025 for the 3AA01194300, 04B3:4673 for the IBM 4820. A hardcoded 3025 breaks 4820 support."),
  T("keyboard", "4820 key 14 and 16 collision", "Both emit scancode 0x70057 over USB — a firmware-level collision in the 4820, not a mapping error, so the two keys cannot be distinguished."),
  T("keyboard", "Ctrl+S1 combinations over USB", "On USB HID these are ordinary modifier-plus-key events, not distinct scancodes as on the native PS/2 interface, so they cannot back custom POS functions."),
  T("keyboard", "Ctrl override and the robbery alarm", "KEYBOARD_KEY_70029=leftctrl keeps Ctrl+Action Code firing the silent robbery alarm — but it must be OFF for the 4820, where 70029 is the VENDOR COUPON key."),

  // --- Keyturn & MSR ---
  T("keyturnmsr", "Keyturn emits no scancode", "The barrel lock is a hardware position, not a key event, so it never appears in the remapper. It gates SOD at the register."),
  T("keyturnmsr", "MSR is not a remappable key", "The magstripe reader delivers a swipe as a data stream, not as function keys, so it has no slot in the keyboard layout."),

  // --- Driver Library ---
  T("library", "Per-model driver profiles", "Packages, kernel modules, boot args, udev rules and Xorg snippets applied to the diskless image at build time, matched on the exact model string from the register hardware profile."),
  T("library", "Adding a new pinpad model", "A pinpad profile carries its command sequences as JSON, so a new model is added by data rather than by changing POS or relay code."),
];

// Flattened lookup of section metadata, so a hit can report its full location.
const SECTION_META = Object.fromEntries(ALL_SECTIONS.map((s) => [s.id, s]));

function scoreHit(entry, terms) {
  const meta = SECTION_META[entry.section];
  const topic = entry.topic.toLowerCase();
  const label = (meta?.label || "").toLowerCase();
  const body = `${entry.text} ${meta?.keywords || ""}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (topic.includes(t)) score += 5;
    else if (label.includes(t)) score += 3;
    else if (body.includes(t)) score += 1;
    else return 0; // every term must appear somewhere
  }
  return score;
}

// Returns null for an empty query so callers can tell "not searching" from "no results".
export function searchDocumentation(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = q.split(/\s+/);
  return TOPIC_INDEX
    .map((e) => ({ entry: e, score: scoreHit(e, terms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry, score }) => {
      const meta = SECTION_META[entry.section] || {};
      return {
        sectionId: entry.section,
        sectionLabel: meta.label || entry.section,
        groupLabel: meta.groupLabel || "",
        topic: entry.topic,
        text: entry.text,
        score,
      };
    });
}

// Matches uploaded documents on the same query, so a search covers the sourced material
// as well as the written references.
export function searchDocuments(query, docs) {
  const q = query.trim().toLowerCase();
  if (!q || !docs?.length) return [];
  const terms = q.split(/\s+/);
  return docs.filter((d) => {
    const hay = [d.title, d.vendor, d.doc_number, d.revision, d.notes, (d.device_models || []).join(" "), (d.tags || []).join(" "), d.category]
      .filter(Boolean).join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}