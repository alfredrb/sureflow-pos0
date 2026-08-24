// sureflow-controller-install — the guided (whiptail) installer a technician runs on a
// fresh Debian box to turn it into a COMBINED store controller: PXE/TFTP + NFS root AND
// the Local Relay on the same dual-homed box, optionally as one half of an HA pair.
//
// The box is dual-homed on purpose, matching the fleet VLAN plan:
//   VLAN 40 — PXE / diskless boot. Isolated, no internet. dnsmasq + NFS bind here.
//             It is the lane trunk's UNTAGGED NATIVE vlan.
//   VLAN 25 — backend. Internet-routed. The relay binds here for cloud sync, and the
//             receipt printers and pinpads live on this side.
// That is why the wizard asks for two addresses rather than one.

import { CONTROLLER_MENU_SCRIPT, CONTROLLER_MENU_PROFILE } from "@/lib/controllerMenu";
import { LANE_IMAGE_BUILD_SCRIPT } from "@/lib/laneImageBuilder";

// Repo the relay application is deployed from. The wizard clones its DEFAULT branch;
// the Cloud-Pushed Updates system then reconciles the box onto the pinned release ref
// on the store's first maintenance window.
//
// FUTURE HOOK (deliberately not built yet): the wizard could instead read the store's
// assigned RelayUpdateAssignment.git_ref from the relaySync pull response's
// pending_update and check that out directly, so a fresh box lands on the intended
// release with no one-night reconciliation lag. relaySync already returns it.
export const RELAY_REPO_URL = "https://github.com/your-org/sureflow-store-controller.git";

export const CONTROLLER_INSTALL_STEPS = [
  {
    step: "Install a minimal Debian on the controller box",
    detail:
      "Debian 12 net-install, SSH server only — no desktop. Put the OS on the SSD; leave the second partition (or second disk) untouched, the installer hands it to the NFS root (and to DRBD on an HA pair).",
  },
  {
    step: "Cable and address BOTH VLANs before anything else",
    detail:
      "The box needs its VLAN 25 backend address up first — that is the only side with an internet route, and the wizard fetches packages and clones the relay through it. Then bring up the VLAN 40 PXE address. Both are static; neither is the floating VIP, which keepalived owns.",
  },
  {
    step: "Fetch and run the wizard as root",
    detail:
      "Download the installer bundle, extract it on the box and run 'sudo ./install' — it lays down the wizard, the console menu and the lane agent, then starts the wizard. A store-specific bundle arrives with its answers pre-seeded. It is re-runnable: answers are saved to /etc/sureflow/controller.conf and offered back as defaults on the next pass. Pasting the script by hand still works if the box cannot receive a file.",
  },
  {
    step: "Answer the prompts — two addresses, not one",
    detail:
      "Store number, this box's role (standalone / primary / secondary), its PXE-VLAN IP, its backend-VLAN IP, the PXE subnet, and on an HA pair both floating VIPs plus the peer's backend IP. Last is the relay API key generated on the Infrastructure Command Center.",
  },
  {
    step: "Let it build the controller and deploy the relay",
    detail:
      "It installs dnsmasq, nfs-kernel-server, node, git and (on an HA pair) drbd-utils + keepalived; lays down /srv/sureflow/{tftp,roots,relay}; clones the relay's default branch and runs npm install/build; writes the relay .env bound to the backend address with no inline comments; and installs the console menu. Ten to twenty minutes on a 5040 SFF.",
  },
  {
    step: "Choose whether to build the lane images now",
    detail:
      "The wizard then offers to build the diskless lane roots: both variants, legacy only, modern only, or skip. A build is bootable end to end — Debian base, then the kiosk launcher, serial and printer bridges and lane agent, then this store's hardware profiles pulled from the cloud with the relay key. Allow 15-30 minutes PER VARIANT; it downloads a full Debian root over the backend VLAN. Skip it on a cutover night where an existing root can be rsynced from the old controller — the builder is installed either way and re-runnable from the console menu.",
  },
  {
    step: "Verify from the wizard's own summary screen",
    detail:
      "The final page prints both interfaces, every service state, the relay's /health response and the git ref that was checked out. Anything red is fixed before the technician leaves — then PXE boot one lane to confirm the root serves.",
  },
  {
    step: "Confirm the store in the cloud",
    detail:
      "On the Infrastructure Command Center set the store's relay URL to http://<backend IP or backend VIP>:3000 — never the PXE address, which the cloud cannot reach — and tick the setup-guide steps.",
  },
  {
    step: "Log out and back in to get the console menu",
    detail:
      "The next login drops straight into sureflow-menu: relay health, restart, PXE/boot status, the relay log, and full add/edit/remove of this store's operators against the cloud.",
  },
];

export const CONTROLLER_INSTALL_SCRIPT = `#!/bin/bash
# sureflow-controller-install — guided COMBINED controller + relay build
# Debian 12. Run as root. Safe to re-run; previous answers become the defaults.
set -euo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
command -v whiptail >/dev/null || { apt-get update -qq; apt-get install -y whiptail; }

CONF=/etc/sureflow/controller.conf
mkdir -p /etc/sureflow
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

RELAY_REPO_URL="\${RELAY_REPO_URL:-${RELAY_REPO_URL}}"
RELAY_DIR=/srv/sureflow/relay

ask() { # ask VAR "Prompt" "default"
  local val
  val=$(whiptail --inputbox "$2" 10 74 "$3" --title "SureFlow Controller Install" 3>&1 1>&2 2>&3) || exit 1
  eval "$1=\\"\\$val\\""
}

whiptail --title "SureFlow Controller Install" --msgbox \\
"This builds a COMBINED store controller on this one box:\\n  * PXE/TFTP + NFS lane roots   on the ISOLATED boot VLAN (40)\\n  * SureFlow Local Relay        on the ROUTED backend VLAN (25)\\n\\nBoth interfaces must already be up and addressed.\\n\\nHave ready: store number, this box's PXE IP and backend IP, the PXE subnet, the floating VIPs if this is an HA pair, and the relay API key from the Infrastructure Command Center." 18 74

ask STORE_ID    "Store number (e.g. 001)"                          "\${STORE_ID:-}"
ROLE=$(whiptail --title "Controller Role" --menu "What is this box?" 14 74 3 \\
  standalone "Single controller for this store" \\
  primary    "Primary of an HA pair" \\
  secondary  "Warm standby of an HA pair" 3>&1 1>&2 2>&3) || exit 1

ask PXE_IP      "This box's PXE-VLAN 40 IP (isolated, serves lanes)"    "\${PXE_IP:-10.0.40.10}"
ask PXE_SUBNET  "Lane PXE subnet on VLAN 40"                            "\${PXE_SUBNET:-10.0.40.0/24}"
ask BACKEND_IP  "This box's backend-VLAN 25 IP (routed, relay + cloud)" "\${BACKEND_IP:-10.0.25.12}"

if [ "$ROLE" = "standalone" ]; then
  # No keepalived: the box's own addresses are the service addresses.
  PXE_VIP="$PXE_IP"; BACKEND_VIP="$BACKEND_IP"; PEER_IP=""
else
  ask PXE_VIP     "Floating PXE VIP lanes boot from (VLAN 40)"     "\${PXE_VIP:-10.0.40.50}"
  ask BACKEND_VIP "Floating backend VIP the relay binds (VLAN 25)" "\${BACKEND_VIP:-10.0.25.50}"
  ask PEER_IP     "Peer controller's backend IP"                   "\${PEER_IP:-}"
fi

ask RELAY_KEY   "Relay API key for store \$STORE_ID"                "\${RELAY_KEY:-}"
ask CLOUD_SYNC_URL "Cloud base URL"                                "\${CLOUD_SYNC_URL:-https://app.base44.com}"

whiptail --title "Confirm" --yesno \\
"Store:        \$STORE_ID\\nRole:         \$ROLE\\n\\nPXE  (v40):   \$PXE_IP    subnet \$PXE_SUBNET\\nBackend(v25): \$BACKEND_IP\\nPXE VIP:      \$PXE_VIP\\nBackend VIP:  \$BACKEND_VIP\\nPeer:         \${PEER_IP:-none}\\n\\nRelay repo:   \$RELAY_REPO_URL (default branch)\\n\\nBuild now?" 20 74 || exit 1

cat >"$CONF" <<EOF
STORE_ID=$STORE_ID
ROLE=$ROLE
PXE_IP=$PXE_IP
PXE_SUBNET=$PXE_SUBNET
BACKEND_IP=$BACKEND_IP
PXE_VIP=$PXE_VIP
BACKEND_VIP=$BACKEND_VIP
PEER_IP=$PEER_IP
RELAY_KEY=$RELAY_KEY
CLOUD_SYNC_URL=$CLOUD_SYNC_URL
RELAY_REPO_URL=$RELAY_REPO_URL
EOF
chmod 600 "$CONF"

RELAY_REF="unknown"

{
echo 8; echo "# Installing packages"
PKGS="dnsmasq nfs-kernel-server nodejs npm git socat rsync curl jq whiptail"
[ "$ROLE" != "standalone" ] && PKGS="$PKGS drbd-utils keepalived"
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y $PKGS >/dev/null

echo 22; echo "# Creating the controller filesystem"
mkdir -p /srv/sureflow/{tftp,roots,relay,images}
mkdir -p /var/log/sureflow
id -u sureflow >/dev/null 2>&1 || useradd -r -s /usr/sbin/nologin -d /srv/sureflow sureflow

echo 32; echo "# Writing DHCP / TFTP config (PXE VLAN only)"
# Bound to the PXE interface so it can never answer the routed backend VLAN.
PXE_IF=$(ip -o -4 addr show | awk -v ip="$PXE_IP" '\$4 ~ "^"ip"/" {print \$2; exit}')
cat >/etc/dnsmasq.d/sureflow-pxe.conf <<EOF
interface=\${PXE_IF:-eth0}
bind-interfaces
except-interface=lo
dhcp-range=\${PXE_SUBNET%/*},static,255.255.255.0,12h
dhcp-boot=pxelinux.0
dhcp-option=66,$PXE_VIP
enable-tftp
tftp-root=/srv/sureflow/tftp
log-dhcp
EOF

echo 45; echo "# Cloning the relay application"
if [ -d "$RELAY_DIR/.git" ]; then
  git -C "$RELAY_DIR" fetch --all --quiet || true
  git -C "$RELAY_DIR" pull --ff-only --quiet || true
else
  rm -rf "$RELAY_DIR"; mkdir -p "$RELAY_DIR"
  git clone --quiet "$RELAY_REPO_URL" "$RELAY_DIR" || echo "CLONE FAILED" > /srv/sureflow/.relay-clone-failed
fi
if [ -d "$RELAY_DIR/.git" ]; then
  RELAY_REF=$(git -C "$RELAY_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)
fi

echo 60; echo "# Building the relay"
if [ -f "$RELAY_DIR/package.json" ]; then
  ( cd "$RELAY_DIR" && npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1 || true )
  ( cd "$RELAY_DIR" && npm run build >/dev/null 2>&1 || true )
fi

echo 72; echo "# Writing relay environment"
# NO inline comments in this file — they are parsed as part of the value.
cat >"$RELAY_DIR/.env" <<EOF
STORE_ID=$STORE_ID
RELAY_API_KEY=$RELAY_KEY
CLOUD_SYNC_URL=$CLOUD_SYNC_URL
BIND_ADDRESS=$BACKEND_VIP
PORT=3000
LANE_MAINT_POLL_SECONDS=60
CURRENT_REF=$RELAY_REF
EOF
chmod 600 "$RELAY_DIR/.env"
chown -R sureflow:sureflow /srv/sureflow
# Record the running ref so the console menu and the update system agree on it.
sed -i '/^CURRENT_REF=/d' "$CONF"; echo "CURRENT_REF=$RELAY_REF" >> "$CONF"

echo 82; echo "# Installing the relay service"
cat >/etc/systemd/system/sureflow-relay.service <<EOF
[Unit]
Description=SureFlow Local Relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=sureflow
WorkingDirectory=$RELAY_DIR
EnvironmentFile=$RELAY_DIR/.env
ExecStart=/usr/bin/node $RELAY_DIR/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo 90; echo "# Installing the console menu"
cat >/usr/local/bin/sureflow-menu <<'SFMENUEOF'
${CONTROLLER_MENU_SCRIPT}
SFMENUEOF
chmod 755 /usr/local/bin/sureflow-menu
cat >/etc/profile.d/sureflow-menu.sh <<'SFPROFEOF'
${CONTROLLER_MENU_PROFILE}
SFPROFEOF
chmod 644 /etc/profile.d/sureflow-menu.sh

echo 93; echo "# Installing the lane image builder"
# Installed unconditionally, even when the technician skips the build below — this is how
# the fleet is patched later, from the console menu.
cat >/usr/local/sbin/sureflow-build-lane-image <<'SFLANEIMGEOF'
${LANE_IMAGE_BUILD_SCRIPT}
SFLANEIMGEOF
chmod 755 /usr/local/sbin/sureflow-build-lane-image

echo 96; echo "# Enabling services"
systemctl daemon-reload
systemctl enable --now dnsmasq nfs-kernel-server >/dev/null 2>&1 || true
if [ "$ROLE" = "standalone" ]; then
  # Standalone owns its own relay lifecycle.
  systemctl enable --now sureflow-relay >/dev/null 2>&1 || true
else
  # HA pair: keepalived's role script starts and stops the relay. An ENABLED unit
  # would run it on both boxes and double every cloud sync.
  systemctl disable sureflow-relay >/dev/null 2>&1 || true
  systemctl enable keepalived >/dev/null 2>&1 || true
fi
echo 100; echo "# Done"
} | whiptail --gauge "Building combined controller for store $STORE_ID..." 8 74 0

# shellcheck disable=SC1090
. "$CONF"

# --- optional: build the diskless lane images now -----------------------------
# Deliberately OUTSIDE the gauge and deliberately optional. debootstrap pulls a full
# Debian root per variant, so this turns a 20-minute install into an hour — worth it on a
# new store, wrong on a cutover night where the old controller's root can just be rsynced
# across. Skipping changes nothing else: the builder is installed either way.
LANE_IMAGE_NOTE="\\n\\nLane images: skipped. Build them any time with 'sureflow-build-lane-image both' or Lanes > Build a lane image in the console menu."
IMG=$(whiptail --title "Build the lane images now?" --menu \\
"A lane image is the diskless root the terminals PXE boot. The builder makes it bootable\\nend to end: Debian base, then the kiosk / bridges / lane agent, then this store's\\nhardware profiles pulled from the cloud.\\n\\nAllow 15-30 MINUTES PER VARIANT — it downloads a full Debian root over the backend\\nVLAN. Only build the variants this store actually has.\\n\\nSkip if you are rsyncing an existing root from another controller." 22 74 4 \\
  skip   "Skip for now (build later from the menu)" \\
  both   "Both variants (legacy + modern)" \\
  legacy "Legacy only — IBM SurePOS 700 class" \\
  modern "Modern only — Elo EPS00E2 class" 3>&1 1>&2 2>&3) || IMG=skip

if [ "$IMG" != "skip" ]; then
  clear
  echo "Building lane image(s): $IMG. This is slow — leave it running."
  echo
  if /usr/local/sbin/sureflow-build-lane-image "$IMG"; then
    LANE_IMAGE_NOTE="\\n\\nLane images: built ($IMG). See /srv/sureflow/.lane-image-summary for the detail."
  else
    LANE_IMAGE_NOTE="\\n\\nLane images: the build reported PROBLEMS. Read /srv/sureflow/.lane-image-summary before you leave — a warning about skipped hardware profiles still leaves a bootable image, a failed debootstrap does not."
  fi
  echo
  read -r -p "Press Enter for the install summary. " _
  # shellcheck disable=SC1090
  . "$CONF"
fi

SUMMARY=""
for svc in dnsmasq nfs-kernel-server sureflow-relay keepalived; do
  if systemctl list-unit-files | grep -q "^\$svc"; then
    SUMMARY="\$SUMMARY\\n\$svc: \$(systemctl is-active \$svc 2>/dev/null || echo inactive)"
  fi
done
HEALTH=$(curl -s --max-time 3 "http://127.0.0.1:3000/api/health" || echo "relay not answering yet")
CLONE_NOTE=""
[ -f /srv/sureflow/.relay-clone-failed ] && CLONE_NOTE="\\n\\nWARNING: the relay clone failed. Check the repo URL and this box's internet route on the BACKEND VLAN, then re-run."

whiptail --title "Install Summary — store $STORE_ID" --msgbox \\
"Role: \$ROLE\\nPXE  (v40): \$PXE_IP  -> VIP \$PXE_VIP\\nBackend(v25): \$BACKEND_IP  -> VIP \$BACKEND_VIP\\nRelay ref: \${CURRENT_REF:-unknown}\$SUMMARY\\n\\nRelay health: \$HEALTH\$CLONE_NOTE\$LANE_IMAGE_NOTE\\n\\nNext: generate each lane's PXE entry on the Registers page (they are keyed to a MAC, so the builder never makes them), then PXE boot one lane.\\n\\nSet this store's relay URL to http://\$BACKEND_VIP:3000 in the Infrastructure Command Center — the BACKEND address, never the PXE one.\\n\\nLog out and back in for the controller console menu." 24 74
`;

export const CONTROLLER_INSTALL_FETCH = `# PREFERRED — the downloadable bundle (wizard + console menu + lane agent):
tar xzf sureflow-controller-*.tar.gz
cd sureflow-controller-*
sudo ./install          # puts every file in place, then runs the wizard

# FALLBACK — paste by hand, for a box with no way to receive a file:
mkdir -p /etc/sureflow
nano /usr/local/sbin/sureflow-controller-install   # paste the script
chmod +x /usr/local/sbin/sureflow-controller-install
sudo /usr/local/sbin/sureflow-controller-install

# Re-run any time — saved answers come back as defaults:
sudo /usr/local/sbin/sureflow-controller-install

# After it finishes, the console menu is on every login (or run it directly):
sureflow-menu

# Build or patch the diskless lane images at any time — same builder the wizard offers:
sudo sureflow-build-lane-image both      # or: legacy | modern
cat /srv/sureflow/.lane-image-summary    # what was built, and any warnings`;

// Store-specific crib sheet shown next to the store picker, so a technician on site
// is not reading values off a different store's card.
export function buildStoreInstallSheet(store) {
  const backendVip = store.controller_vip || "<set the VIP on the Redundancy card>";
  const ha = store.ha_enabled;
  return `Store number  : ${store.store_number}   (${store.name})
Role          : ${ha ? "primary, then repeat as secondary" : "standalone"}

VLAN 40 (PXE, isolated — serves lanes)
  This box IP : 10.0.40.10${ha ? " (secondary: 10.0.40.11)" : ""}
  PXE subnet  : 10.0.40.0/24
  ${ha ? "PXE VIP     : 10.0.40.50" : "PXE VIP     : same as this box (standalone)"}

VLAN 25 (backend, internet-routed — relay, cloud, printers)
  This box IP : ${ha ? store.primary_controller_host || "<primary_controller_host not set>" : store.primary_controller_host || backendVip}
${ha ? `  Peer box IP : ${store.secondary_controller_host || "<secondary_controller_host not set>"}\n` : ""}  Backend VIP : ${backendVip}

Relay URL     : http://${store.controller_vip || store.primary_controller_host || "<backend vip>"}:3000
Relay API key : generate on this store's Relay Ops card, then paste at the prompt

${ha
  ? "HA pair: run the wizard on the primary first and confirm the lanes boot, then run it on the secondary with role=secondary and the peer IP swapped. The wizard leaves the relay unit DISABLED on an HA box — keepalived's role script owns it. Only after DRBD has synced should you test a failover."
  : "Standalone: the wizard points both VIP prompts at this box's own addresses, so keepalived is skipped entirely and the relay unit is enabled directly. Moving to a pair later is just a re-run with role=primary."}

Remember: the cloud and the Infrastructure Command Center poll the BACKEND address.
A store whose relay URL points at the PXE address will always read as unreachable.`;
}