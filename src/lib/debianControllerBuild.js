// Debian 12 bare-metal build reference for a SureFlow store controller.
// Everything here is fleet-identical on purpose: the same disk layout and the same last
// octets at every store, so a technician who has built one controller has built them all,
// and so the cloud never has to store per-store network trivia.

// ---------------------------------------------------------------------------
// FLEET IP STANDARD
// Keeps the lab's existing numbers (10.0.40.10 PXE, 10.0.25.12 backend) as the primary
// controller, and fills in the rest of the scheme around them so every store matches.
// ---------------------------------------------------------------------------
export const IP_STANDARD = {
  pxe: {
    vlan: "VLAN 40 — PXE / lanes (ISOLATED, no internet, untagged native on the lane trunk)",
    subnet: "10.0.40.0/24",
    rows: [
      { role: "Primary controller", addr: "10.0.40.10", note: "Serves DHCP/TFTP/NFS to the lanes. This is the lab's existing address." },
      { role: "Secondary controller", addr: "10.0.40.11", note: "HA stores only. Warm standby; holds DRBD secondary." },
      { role: "Floating PXE VIP", addr: "10.0.40.50", note: "What lanes actually boot from (dhcp next-server). Reserved even at a standalone store." },
      { role: "Lane DHCP pool", addr: "10.0.40.100 – 10.0.40.200", note: "Diskless lanes. Reservations by MAC from the register record." },
      { role: "Reserved", addr: "10.0.40.201 – 10.0.40.254", note: "Bench / spare lanes during a rollout." },
    ],
  },
  backend: {
    vlan: "VLAN 25 — backend (ROUTED, internet-facing: cloud sync, printers, pinpads)",
    subnet: "10.0.25.0/24",
    rows: [
      { role: "Primary controller / relay", addr: "10.0.25.12", note: "The relay binds here and syncs to the cloud. This is the lab's existing address." },
      { role: "Secondary controller / relay", addr: "10.0.25.13", note: "HA stores only." },
      { role: "Floating backend VIP", addr: "10.0.25.50", note: "The store's relay_url is http://10.0.25.50:3000 — always the VIP, never a box's own address." },
      { role: "Receipt printers (Ethernet)", addr: "10.0.25.60 – 10.0.25.79", note: "Lane N's printer = .60 + N. Entered on the register's printer_ip." },
      { role: "Customer pinpads (Ethernet)", addr: "10.0.25.80 – 10.0.25.99", note: "Lane N's pinpad = .80 + N." },
      { role: "Gateway", addr: "10.0.25.1", note: "Store router. Only this VLAN has a default route." },
    ],
  },
};

export const IP_STANDARD_RULES = [
  "The same last octets at every store. Store 001 and store 137 both have their primary controller on 10.0.40.10 and 10.0.25.12 — only the store number in the config differs. That is what lets one answer sheet, one script and one troubleshooting habit cover the whole fleet.",
  "Reserve the .50 VIPs even at a standalone store. The wizard points the VIP prompts at the box's own addresses when role=standalone, so nothing uses .50 yet — but the address is free when that store is later given a second controller, and no lane, printer or relay URL has to be renumbered.",
  "Controllers are STATIC, never DHCP. A controller that moves address takes the whole store's boot and printing down with it.",
  "Only VLAN 25 gets a default route. VLAN 40 has no gateway line at all — that single omission is what keeps the lane network isolated, and it is worth more than any firewall rule.",
  "Never point the store's relay_url at a PXE address. The cloud reaches the store on the backend VLAN; a relay URL on 10.0.40.x reads as permanently unreachable on the Infrastructure Command Center.",
  "Two NICs, never one with sub-interfaces on a standalone box. Physical separation means a misconfigured tag cannot bridge the isolated lane VLAN onto the routed one.",
];

// ---------------------------------------------------------------------------
// DISK
// ---------------------------------------------------------------------------
export const DISK_PLAN = {
  target: "Dell OptiPlex 5040 SFF — 1x SSD (240GB+) for the OS, 1x SSD (480GB+) for lane roots. Prioritise RAM (16GB+) over CPU: the NFS root cache is what makes lanes feel fast.",
  standalone: [
    { part: "/dev/sda1", size: "512 MB", fs: "EFI (fat32)", mount: "/boot/efi", why: "UEFI boot. Legacy BIOS boxes get a 1MB bios_grub instead." },
    { part: "/dev/sda2", size: "40 GB", fs: "ext4", mount: "/", why: "Debian itself. 40GB is generous — the OS uses under 6GB." },
    { part: "/dev/sda3", size: "8 GB", fs: "swap", mount: "swap", why: "Small. If the box is swapping, NFS latency is already hurting the lanes." },
    { part: "/dev/sda4", size: "rest", fs: "ext4", mount: "/var/log", why: "Separate, so a runaway dnsmasq or relay log can never fill / and wedge the store." },
    { part: "/dev/sdb1", size: "all of the 2nd SSD", fs: "ext4", mount: "/srv/sureflow", why: "Lane NFS roots, TFTP tree, relay app and images. On its own disk so lane boot I/O never competes with the OS." },
  ],
  ha: [
    { part: "/dev/sda1-4", size: "same as standalone", fs: "—", mount: "—", why: "The OS disk is local and NOT mirrored. Each box boots itself." },
    { part: "/dev/sdb1", size: "all of the 2nd SSD", fs: "unformatted", mount: "(DRBD backing device)", why: "Left RAW. DRBD owns it; formatting it here is the classic mistake that costs a rebuild." },
    { part: "/dev/drbd0", size: "= sdb1", fs: "ext4", mount: "/srv/sureflow", why: "Mounted ONLY on the box holding the primary role. keepalived mounts and unmounts it — never put it in fstab, or both boxes will fight over it at boot." },
  ],
  notes: [
    "Identical disks and identical partition sizes on both boxes of an HA pair. DRBD refuses to sync onto a smaller backing device, and finding that out at 2am is miserable.",
    "No LVM. It buys flexibility this box never needs and adds a layer between DRBD and the disk when you are trying to reason about a failed sync.",
    "SSD, not spinning disk, for /srv/sureflow. Every lane reads its root over NFS from this volume; seek latency here is felt on every lane at once.",
    "No encryption on /srv/sureflow. An unattended reboot must come all the way back with no one to type a passphrase — a store that needs a human to finish booting is not redundant.",
  ],
};

// ---------------------------------------------------------------------------
// SCRIPTS / CONFIG
// ---------------------------------------------------------------------------
export const DEBIAN_INSTALL_ANSWERS = `Debian 12 (bookworm) netinst — installer choices

Hostname            : sfc-<store>-a        (secondary: sfc-<store>-b)
Domain              : leave blank
Root password       : set it, and record it in the store's asset record
Primary user        : sureflowadmin        (this is the login the console menu greets)
Timezone            : the STORE's local time, not head office
Network             : the installer will find two NICs — pick the one cabled to
                      VLAN 25 (backend) as the primary. It is the only one with a
                      route out, so it is the only one that can fetch packages.
Partitioning        : Manual. Follow the disk table; do NOT let the guided mode
                      touch the second SSD.
Software selection  : UNTICK "Debian desktop environment" and "print server".
                      TICK only "SSH server" and "standard system utilities".
                      A controller has no GUI — the console menu is the interface.
GRUB                : install to /dev/sda (the OS disk)

After first boot, as root:
  apt-get update && apt-get -y upgrade
  apt-get install -y sudo vim curl
  usermod -aG sudo sureflowadmin
  # confirm both NICs are present before going further:
  ip -br link`;

export const NIC_NETPLAN_STANDALONE = `# /etc/network/interfaces  — STANDALONE controller
# Two physical NICs. enp0s31f6 = backend (routed), enp1s0 = PXE (isolated).
# Rename to match 'ip -br link' on your box.

source /etc/network/interfaces.d/*
auto lo
iface lo inet loopback

# --- VLAN 25: backend. The ONLY interface with a gateway. ---
auto enp0s31f6
iface enp0s31f6 inet static
    address 10.0.25.12/24
    gateway 10.0.25.1
    dns-nameservers 10.0.25.1 1.1.1.1

# --- VLAN 40: PXE / lanes. Deliberately NO gateway line. ---
# Omitting the gateway is the isolation: this box will answer lanes on this
# interface and will never route them anywhere.
auto enp1s0
iface enp1s0 inet static
    address 10.0.40.10/24

# Apply, then verify there is exactly ONE default route, on the backend NIC:
#   systemctl restart networking
#   ip route            # expect: default via 10.0.25.1 dev enp0s31f6
#   ping -c2 10.0.25.1  # backend reaches the store router
#   ping -c2 1.1.1.1    # backend reaches the internet`;

export const NIC_NETPLAN_HA = `# /etc/network/interfaces  — HA PAIR
# The boxes are identical apart from their last octets. keepalived adds the
# .50 VIPs on top of these at runtime; they are NEVER configured statically.

# ---------- PRIMARY  (sfc-<store>-a) ----------
auto enp0s31f6
iface enp0s31f6 inet static
    address 10.0.25.12/24
    gateway 10.0.25.1
    dns-nameservers 10.0.25.1 1.1.1.1

auto enp1s0
iface enp1s0 inet static
    address 10.0.40.10/24

# ---------- SECONDARY (sfc-<store>-b) ----------
auto enp0s31f6
iface enp0s31f6 inet static
    address 10.0.25.13/24
    gateway 10.0.25.1
    dns-nameservers 10.0.25.1 1.1.1.1

auto enp1s0
iface enp1s0 inet static
    address 10.0.40.11/24

# DRBD replicates over the BACKEND VLAN (10.0.25.12 <-> 10.0.25.13), not the
# PXE VLAN: a lane storm must never be able to starve the disk mirror.

# Both boxes need this so a service can bind the VIP before keepalived has
# finished bringing it up:
cat >/etc/sysctl.d/99-sureflow.conf <<EOF
net.ipv4.ip_nonlocal_bind = 1
EOF
/sbin/sysctl --system`;

export const SWITCH_PORT_CONFIG = `Switch side — get this right before touching the controller.

Controller BACKEND port   : access/untagged VLAN 25
Controller PXE port       : access/untagged VLAN 40
Lane ports                : trunk with VLAN 40 as the UNTAGGED NATIVE vlan
                            (a PXE ROM cannot tag a frame, so the lane's boot
                            request must arrive untagged — this is the single
                            most common cause of "lane won't PXE boot")

VLAN 40 must have NO layer-3 interface / SVI and no DHCP relay on the store
router. If the lane VLAN can route, the isolation the whole design leans on is
gone, and the lanes will happily try to reach the internet directly instead of
through the relay.

Verify from the controller before the wizard:
  ip -br addr                       # one address per NIC, correct VLANs
  ip route                          # exactly one default, via 10.0.25.1
  tcpdump -i <pxe-nic> -n port 67   # power a lane: you should see its DHCP DISCOVER`;

export const VERIFY_STEPS = [
  {
    step: "Confirm the two NICs are on the right VLANs",
    detail:
      "ip -br addr shows 10.0.25.12 on the backend NIC and 10.0.40.10 on the PXE NIC. If they are swapped, the relay will be unreachable from the cloud and the lanes will get DHCP from the store router instead of the controller — both symptoms of the same crossed cable.",
  },
  {
    step: "Confirm exactly one default route",
    detail:
      "ip route must show a single default, via 10.0.25.1 on the backend NIC. Two defaults means someone put a gateway on the PXE interface, and lane traffic will start leaking out of the isolated VLAN intermittently — the worst kind of fault to chase.",
  },
  {
    step: "Confirm the second disk is where you think it is",
    detail:
      "lsblk should show /srv/sureflow on the second SSD (standalone) or sdb1 raw with no filesystem (HA). A controller that quietly put the lane roots on the OS disk works fine until the store grows and then fills / at the worst possible moment.",
  },
  {
    step: "Confirm a lane's DHCP request reaches this box",
    detail:
      "tcpdump on the PXE NIC on port 67 while powering one lane. No DISCOVER means the lane port's native VLAN is wrong; a DISCOVER with no reply means dnsmasq is not up yet, which the wizard fixes.",
  },
  {
    step: "Only now run the controller installer",
    detail:
      "The wizard assumes both interfaces are already up and addressed — it configures services, not networking. Its defaults match this guide exactly (10.0.40.10, 10.0.40.0/24, 10.0.25.12, VIPs on .50), so on a box built this way you can accept every prompt.",
  },
  {
    step: "HA only — build the primary completely first",
    detail:
      "Bring the primary all the way up and PXE boot one real lane from it before you touch the secondary. Debugging DRBD and keepalived on top of an unproven boot path means you cannot tell which layer is lying to you.",
  },
];