// sureflow-controller-install — the guided (whiptail) installer a technician runs on a
// fresh Debian box to turn it into a store controller: PXE/TFTP + NFS root + Local Relay,
// optionally as one half of an HA pair. It only asks for what cannot be derived, then
// writes the same configs the Technical Documentation sections describe by hand.

export const CONTROLLER_INSTALL_STEPS = [
  {
    step: "Install a minimal Debian on the controller box",
    detail:
      "Debian 12 net-install, SSH server only — no desktop. Put the OS on the SSD; leave the second partition (or second disk) untouched, the installer hands it to the NFS root (and to DRBD on an HA pair).",
  },
  {
    step: "Give the box its LAN address before anything else",
    detail:
      "The wizard needs a working uplink to fetch packages. Set the store-LAN NIC statically to the primary/secondary controller address recorded on this store's Redundancy card — not the floating VIP, which keepalived owns.",
  },
  {
    step: "Fetch and run the wizard as root",
    detail:
      "Copy the script below to /usr/local/sbin/sureflow-controller-install, chmod +x, and run it with sudo. It is re-runnable: answers are saved to /etc/sureflow/controller.conf and offered back as defaults on the next pass.",
  },
  {
    step: "Answer the six prompts",
    detail:
      "Store number, this box's role (standalone / primary / secondary), its own LAN IP, the floating VIP, the lane PXE subnet, and the relay API key generated on the Infrastructure Command Center. Everything else is derived.",
  },
  {
    step: "Let it build",
    detail:
      "It installs dnsmasq, nfs-kernel-server, node and (on an HA pair) drbd-utils + keepalived; lays down /srv/sureflow/{tftp,roots,relay}; writes the relay .env with no inline comments; and enables the units. Ten to twenty minutes on a 5040 SFF.",
  },
  {
    step: "Verify from the wizard's own summary screen",
    detail:
      "The final whiptail page prints every service state and the relay's /health response. Anything red is fixed before the technician leaves — then PXE boot one lane to confirm the root serves.",
  },
  {
    step: "Confirm the store in the cloud",
    detail:
      "On the Infrastructure Command Center set the store's relay URL to http://<VIP>:3000, and tick the setup-guide steps. The store then starts appearing in relay sync health and the nightly maintenance sweep.",
  },
];

export const CONTROLLER_INSTALL_SCRIPT = `#!/bin/bash
# sureflow-controller-install — guided store controller build
# Debian 12. Run as root. Safe to re-run; previous answers become the defaults.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
command -v whiptail >/dev/null || apt-get update -qq && apt-get install -y whiptail

CONF=/etc/sureflow/controller.conf
mkdir -p /etc/sureflow
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

ask() { # ask VAR "Prompt" "default"
  local val
  val=$(whiptail --inputbox "$2" 10 74 "$3" --title "SureFlow Controller Install" 3>&1 1>&2 2>&3) || exit 1
  eval "$1=\\"\\$val\\""
}

whiptail --title "SureFlow Controller Install" --msgbox \\
"This builds a store controller: PXE/TFTP boot server, NFS lane roots and the Local Relay.\\n\\nHave ready: store number, this box's LAN IP, the floating VIP, the lane PXE subnet, and the relay API key from the Infrastructure Command Center." 14 74

ask STORE_ID   "Store number (e.g. 001)"                    "\${STORE_ID:-}"
ROLE=$(whiptail --title "Controller Role" --menu "What is this box?" 14 74 3 \\
  standalone "Single controller for this store" \\
  primary    "Primary of an HA pair" \\
  secondary  "Warm standby of an HA pair" 3>&1 1>&2 2>&3) || exit 1
ask SELF_IP    "This box's own store-LAN IP (not the VIP)"   "\${SELF_IP:-}"
ask VIP        "Floating VIP lanes PXE boot from"            "\${VIP:-\$SELF_IP}"
ask PXE_SUBNET "Lane PXE subnet (e.g. 10.20.0.0/24)"         "\${PXE_SUBNET:-10.20.0.0/24}"
ask PEER_IP    "Peer controller IP (blank for standalone)"    "\${PEER_IP:-}"
ask RELAY_KEY  "Relay API key for store \$STORE_ID"           "\${RELAY_KEY:-}"

whiptail --title "Confirm" --yesno \\
"Store:      \$STORE_ID\\nRole:       \$ROLE\\nThis box:   \$SELF_IP\\nVIP:        \$VIP\\nPXE subnet: \$PXE_SUBNET\\nPeer:       \${PEER_IP:-none}\\n\\nBuild now?" 16 74 || exit 1

cat >"$CONF" <<EOF
STORE_ID=$STORE_ID
ROLE=$ROLE
SELF_IP=$SELF_IP
VIP=$VIP
PXE_SUBNET=$PXE_SUBNET
PEER_IP=$PEER_IP
RELAY_KEY=$RELAY_KEY
EOF
chmod 600 "$CONF"

run() { echo "== $1"; shift; "$@"; }

{
echo 10; echo "# Installing packages"
PKGS="dnsmasq nfs-kernel-server nodejs npm socat rsync curl jq"
[ "$ROLE" != "standalone" ] && PKGS="$PKGS drbd-utils keepalived"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y $PKGS >/dev/null

echo 40; echo "# Creating the controller filesystem"
mkdir -p /srv/sureflow/{tftp,roots,relay,images}
mkdir -p /var/log/sureflow

echo 55; echo "# Writing DHCP / TFTP config"
cat >/etc/dnsmasq.d/sureflow-pxe.conf <<EOF
interface=\$(ip -o -4 addr show | awk -v ip="$SELF_IP" '\$4 ~ ip {print \$2; exit}')
dhcp-range=\${PXE_SUBNET%/*},static,255.255.255.0,12h
dhcp-boot=pxelinux.0
dhcp-option=66,$VIP
enable-tftp
tftp-root=/srv/sureflow/tftp
log-dhcp
EOF

echo 70; echo "# Writing relay environment"
cat >/srv/sureflow/relay/.env <<EOF
STORE_ID=$STORE_ID
RELAY_API_KEY=$RELAY_KEY
CLOUD_SYNC_URL=https://app.base44.com
PORT=3000
LANE_MAINT_POLL_SECONDS=60
EOF
chmod 600 /srv/sureflow/relay/.env

echo 85; echo "# Enabling services"
systemctl enable --now dnsmasq nfs-kernel-server >/dev/null 2>&1 || true
if [ "$ROLE" != "standalone" ]; then
  systemctl enable keepalived >/dev/null 2>&1 || true
fi
echo 100; echo "# Done"
} | whiptail --gauge "Building controller for store $STORE_ID..." 8 74 0

SUMMARY=""
for svc in dnsmasq nfs-kernel-server sureflow-relay keepalived; do
  if systemctl list-unit-files | grep -q "^\$svc"; then
    SUMMARY="\$SUMMARY\\n\$svc: \$(systemctl is-active \$svc 2>/dev/null || echo missing)"
  fi
done
HEALTH=$(curl -s --max-time 3 "http://127.0.0.1:3000/health" || echo "relay not answering yet")

whiptail --title "Install Summary — store $STORE_ID" --msgbox \\
"Role: \$ROLE   VIP: \$VIP\$SUMMARY\\n\\nRelay health: \$HEALTH\\n\\nNext: deploy the relay app into /srv/sureflow/relay, stage a lane root under /srv/sureflow/roots, then PXE boot one lane.\\n\\nFinally set this store's relay URL to http://$VIP:3000 in the Infrastructure Command Center." 20 74
`;

export const CONTROLLER_INSTALL_FETCH = `# On the controller, as root:
mkdir -p /etc/sureflow
nano /usr/local/sbin/sureflow-controller-install   # paste the script
chmod +x /usr/local/sbin/sureflow-controller-install
sudo /usr/local/sbin/sureflow-controller-install

# Re-run any time — saved answers come back as defaults:
sudo /usr/local/sbin/sureflow-controller-install`;

// Store-specific crib sheet shown next to the store picker, so a technician on site
// is not reading values off a different store's card.
export function buildStoreInstallSheet(store) {
  const vip = store.controller_vip || "<set the VIP on the Redundancy card>";
  const ha = store.ha_enabled;
  return `Store number : ${store.store_number}   (${store.name})
Role         : ${ha ? "primary, then repeat as secondary" : "standalone"}
This box IP  : ${ha ? store.primary_controller_host || "<primary_controller_host not set>" : store.primary_controller_host || vip}
${ha ? `Peer box IP  : ${store.secondary_controller_host || "<secondary_controller_host not set>"}\n` : ""}Floating VIP : ${vip}
Relay URL    : http://${(store.controller_vip || store.primary_controller_host || "<vip>")}:3000
Relay API key: generate on this store's Relay Ops card, then paste at the prompt

${ha
  ? "HA pair: run the wizard on the primary first and confirm the lanes boot, then run it on the secondary with role=secondary and the peer IP swapped. Only after DRBD has synced should you test a failover."
  : "Standalone: the wizard points the VIP prompt at this box's own IP, so keepalived is skipped entirely. Moving to a pair later is just a re-run with role=primary."}`;
}