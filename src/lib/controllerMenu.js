// sureflow-menu — the whiptail console menu an admin lands on when they log into a
// store controller. It is deliberately a thin client: every cloud action is a plain
// curl to the relaySync endpoint using the per-store API key already sitting in
// /etc/sureflow/controller.conf, so the relay app needs no changes and the menu keeps
// working even when the local relay process is down.
//
// Scope: this store only. The API key IS the identity, and relaySync scopes every
// operator read and write to the store that key belongs to.

export const CONTROLLER_MENU_SCRIPT = `#!/bin/bash
# /usr/local/bin/sureflow-menu — store controller console menu
# Reads its identity from the installer's answer sheet; never prompts for a key.
set -uo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

CONF=/etc/sureflow/controller.conf
if [ ! -r "$CONF" ]; then
  echo "No /etc/sureflow/controller.conf — run sureflow-controller-install first."
  exit 1
fi
# shellcheck disable=SC1090
. "$CONF"
CLOUD_SYNC_URL="\${CLOUD_SYNC_URL:-https://app.base44.com}"
SYNC="\$CLOUD_SYNC_URL/api/apps/functions/relaySync"

# --- cloud call helper -------------------------------------------------------
# sync '<extra json>'  -> merges store_id/api_key in and returns the raw body.
sync() {
  curl -s --max-time 20 -X POST "\$SYNC" \\
    -H 'Content-Type: application/json' \\
    -d "{\\"store_id\\":\\"\$STORE_ID\\",\\"api_key\\":\\"\$RELAY_KEY\\",\$1}"
}

msg()  { whiptail --title "SureFlow — store \$STORE_ID" --msgbox "\$1" 20 74; }
ask()  { whiptail --inputbox "\$1" 10 74 "\${2:-}" --title "SureFlow — store \$STORE_ID" 3>&1 1>&2 2>&3; }

# --- operators ---------------------------------------------------------------
op_list_raw() { sync '"action":"operator_manage","op":"list"'; }

op_list() {
  local body table
  body=$(op_list_raw)
  table=$(echo "\$body" | jq -r '
    if .operators then
      (.operators | if length == 0 then "No operators assigned to this store yet."
       else map("\\(.operator_id)  \\(.full_name)  [\\(.role)]  \\(.status)\\(if .pos_access == false then "  (no POS)" else "" end)") | join("\\n") end)
    else "Error: \\(.error // "unexpected response")" end')
  msg "Operators — store \$STORE_ID\\n\\n\$table"
}

op_add() {
  local id name pin role body
  id=$(ask "New operator ID") || return
  [ -n "\$id" ] || return
  name=$(ask "Full name for \$id") || return
  pin=$(ask "Login PIN for \$id") || return
  role=$(whiptail --title "Role for \$id" --menu "Role" 16 74 6 \\
    cashier "Cashier" csm "Customer Service Manager" manager "Manager" \\
    technician "Technician" loss_prevention "Loss Prevention" vendor "Vendor" 3>&1 1>&2 2>&3) || return
  body=$(sync "\\"action\\":\\"operator_manage\\",\\"op\\":\\"add\\",\\"operator\\":{\\"operator_id\\":\\"\$id\\",\\"full_name\\":\\"\$name\\",\\"pin\\":\\"\$pin\\",\\"role\\":\\"\$role\\"}")
  msg "\$(echo "\$body" | jq -r '.message // .error // "No response"')"
}

op_edit() {
  local id field value body role
  id=$(ask "Operator ID to edit") || return
  [ -n "\$id" ] || return
  field=$(whiptail --title "Edit \$id" --menu "Which field?" 16 74 5 \\
    full_name "Full name" pin "Login PIN" role "Role" \\
    status "Active / inactive" pos_access "POS access on/off" 3>&1 1>&2 2>&3) || return
  case "\$field" in
    role)
      value=$(whiptail --title "Role for \$id" --menu "Role" 16 74 6 \\
        cashier "Cashier" csm "Customer Service Manager" manager "Manager" \\
        technician "Technician" loss_prevention "Loss Prevention" vendor "Vendor" 3>&1 1>&2 2>&3) || return ;;
    status)
      value=$(whiptail --title "Status for \$id" --menu "Status" 12 74 2 \\
        active "Active" inactive "Inactive" 3>&1 1>&2 2>&3) || return ;;
    pos_access)
      if whiptail --title "POS access for \$id" --yesno "Allow POS login and override approval?" 10 74; then value=true; else value=false; fi ;;
    *)
      value=$(ask "New \$field for \$id") || return ;;
  esac
  if [ "\$field" = "pos_access" ]; then
    body=$(sync "\\"action\\":\\"operator_manage\\",\\"op\\":\\"edit\\",\\"operator\\":{\\"operator_id\\":\\"\$id\\",\\"pos_access\\":\$value}")
  else
    body=$(sync "\\"action\\":\\"operator_manage\\",\\"op\\":\\"edit\\",\\"operator\\":{\\"operator_id\\":\\"\$id\\",\\"\$field\\":\\"\$value\\"}")
  fi
  msg "\$(echo "\$body" | jq -r '.message // .error // "No response"')"
}

op_remove() {
  local id body
  id=$(ask "Operator ID to REMOVE") || return
  [ -n "\$id" ] || return
  whiptail --title "Confirm removal" --yesno \\
    "Permanently remove operator \$id from store \$STORE_ID?\\n\\nTheir past transactions and time clock records are kept." 12 74 || return
  body=$(sync "\\"action\\":\\"operator_manage\\",\\"op\\":\\"remove\\",\\"operator\\":{\\"operator_id\\":\\"\$id\\"}")
  msg "\$(echo "\$body" | jq -r '.message // .error // "No response"')"
}

operators_menu() {
  while true; do
    CHOICE=$(whiptail --title "Operators — store \$STORE_ID" --menu "" 16 74 5 \\
      list   "List this store's operators" \\
      add    "Add a new operator" \\
      edit   "Edit an operator" \\
      remove "Remove an operator" \\
      back   "Back" 3>&1 1>&2 2>&3) || return
    case "\$CHOICE" in
      list) op_list ;; add) op_add ;; edit) op_edit ;; remove) op_remove ;; back) return ;;
    esac
  done
}

# --- lanes -------------------------------------------------------------------
# The relay's own token, needed for the lane routes. It lives in the relay .env that
# systemd reads, NOT in this login shell, so it must be read out each time.
RELAY_DIR=\${RELAY_DIR:-/srv/sureflow/relay}
relay_token() { grep -E '^RELAY_ACCESS_TOKEN=' "\$RELAY_DIR/.env" 2>/dev/null | cut -d= -f2-; }
relay_get()  { curl -s --max-time 5 -H "X-Relay-Token: \$(relay_token)" "http://127.0.0.1:3000\$1"; }

lane_audit() { # lane_audit "<what>" "<detail>"
  sync "\\"action\\":\\"lanes\\",\\"op\\":\\"audit\\",\\"lane_action\\":\\"\$1\\",\\"detail\\":\\"\${2:-}\\"" >/dev/null 2>&1 || true
}

# Merges the three things that each know part of the answer:
#   cloud   -> which registers this store HAS, and their names
#   relay   -> which lanes have actually checked in (agent polls) and pending reboots
#   dnsmasq -> which MACs hold a PXE lease right now
lane_table() {
  local cloud relay leases
  cloud=$(sync '"action":"lanes","op":"list"')
  relay=$(relay_get /lane/seen)
  leases=$(awk '{print toupper(\$2)}' /var/lib/misc/dnsmasq.leases 2>/dev/null | sort -u | tr '\\n' ' ')
  echo "\$cloud" | jq -r --argjson relay "\${relay:-{}}" --arg leases "\$leases" '
    if .lanes then
      (["REGISTER      NAME                 SEEN            REBOOT   LEASE"] +
       (.lanes | map(
          . as \$l |
          (\$relay.lanes // [] | map(select(.register_id == (\$l.register_id | ascii_upcase))) | first) as \$s |
          "\\(\$l.register_id | .[0:13] | . + (" " * (14 - length)))" +
          "\\(\$l.name // "" | .[0:20] | . + (" " * (21 - length)))" +
          "\\(if \$s then (if \$s.seconds_ago < 60 then "\\(\$s.seconds_ago)s ago" else "\\((\$s.seconds_ago/60|floor))m ago" end) else "never seen" end | .[0:15] | . + (" " * (16 - length)))" +
          "\\(if \$s and \$s.reboot_pending then "queued " else "-      " end)" +
          "\\(if (\$leases | ascii_upcase | contains(\$l.mac_address | ascii_upcase)) and (\$l.mac_address != "") then "yes" else "-" end)"
        ))) | join("\\n")
    else "Error: \\(.error // "cloud unreachable")" end' 2>/dev/null \\
    || echo "Could not build the lane table (is the relay up and is jq installed?)"
}

lane_list() {
  msg "Lanes — store \$STORE_ID\\n\\n\$(lane_table)\\n\\nSEEN is the lane agent's last outbound poll — the only proof a lane is alive, since\\nthe PXE VLAN cannot be probed inbound. 'never seen' = powered off, still booting,\\nor running a root without the lane agent installed."
}

lane_pick() { # echoes a chosen register_id, or nothing
  local cloud args
  cloud=$(sync '"action":"lanes","op":"list"')
  args=$(echo "\$cloud" | jq -r '.lanes // [] | map("\\(.register_id) \\"\\(.name // "lane")\\"") | join(" ")')
  [ -n "\$args" ] || { msg "No registers are assigned to store \$STORE_ID in the cloud."; return 1; }
  eval "whiptail --title 'Pick a lane' --menu 'Which lane?' 20 74 10 \$args 3>&1 1>&2 2>&3"
}

lane_reboot_one() {
  local id body
  id=$(lane_pick) || return
  [ -n "\$id" ] || return
  whiptail --title "Reboot \$id" --yesno "Reboot lane \$id now?\\n\\nThe lane's agent collects this within about 10 seconds. A lane mid-sale will lose\\nthat sale — check the lane is clear first." 12 74 || return
  body=$(curl -s --max-time 5 -X POST http://127.0.0.1:3000/lane/reboot \\
    -H 'Content-Type: application/json' -H "X-Relay-Token: \$(relay_token)" \\
    -d "{\\"register_id\\":\\"\$id\\",\\"requested_by\\":\\"controller console (\$(whoami))\\"}")
  lane_audit "Rebooted lane \$id" "Queued from the console menu; the lane agent collects within ~10s."
  msg "\$(echo "\$body" | jq -r 'if .queued then "Reboot queued for \\(.register_id). It will collect within ~10s." else "Error: \\(.error // "relay did not accept the request")" end' 2>/dev/null || echo "\$body")"
}

# Batched on purpose: releasing every lane at once hammers the NFS root and leaves the
# store dark. Same reasoning as the nightly maintenance window's stagger.
lane_reboot_all() {
  local ids batch interval count=0 token
  ids=$(sync '"action":"lanes","op":"list"' | jq -r '.lanes // [] | map(.register_id) | join(" ")')
  [ -n "\$ids" ] || { msg "No registers found for store \$STORE_ID."; return; }
  batch=$(ask "How many lanes per batch?" "2") || return
  interval=$(ask "Seconds between batches?" "60") || return
  whiptail --title "Reboot ALL lanes" --yesno \\
    "Reboot every lane at store \$STORE_ID, \$batch at a time, \$interval seconds apart?\\n\\nLanes: \$ids\\n\\nAny lane mid-sale WILL lose that sale. This is a maintenance action." 15 74 || return
  token=$(relay_token)
  clear
  echo "Rebooting lanes in batches of \$batch, \$interval s apart. Ctrl+C stops between batches."
  for id in \$ids; do
    curl -s --max-time 5 -X POST http://127.0.0.1:3000/lane/reboot \\
      -H 'Content-Type: application/json' -H "X-Relay-Token: \$token" \\
      -d "{\\"register_id\\":\\"\$id\\",\\"requested_by\\":\\"controller console batch\\"}" >/dev/null
    echo "  queued \$id"
    count=\$((count + 1))
    if [ \$((count % batch)) -eq 0 ]; then echo "  ...waiting \$interval s"; sleep "\$interval"; fi
  done
  lane_audit "Rebooted all lanes in batches" "\$count lane(s), \$batch per batch, \${interval}s apart."
  echo; read -r -p "Queued \$count lane(s). Press Enter to return to the menu. " _
}

# A diskless lane has no local state: it pulls its root from NFS, so republishing the
# root and rebooting IS the update. There is no way to patch a running lane in place.
lane_rebuild_image() {
  local root out
  root=$(ask "Lane root to republish" "\${LANE_ROOT:-/srv/sureflow/roots/sureflow-legacy}") || return
  if [ ! -d "\$root" ]; then msg "No such root: \$root\\n\\nStage a lane root there first — see the PXE Controller docs."; return; fi
  whiptail --title "Republish lane image" --yesno \\
    "Republish the kernel and initrd from\\n  \$root\\ninto the TFTP tree, then reboot the lanes so they pick it up?\\n\\nThis does NOT modify the root itself — build changes into it first." 14 74 || return
  out=$( { cp "\$root"/boot/vmlinuz-*    /srv/sureflow/tftp/debian-legacy/vmlinuz    && \\
           cp "\$root"/boot/initrd.img-* /srv/sureflow/tftp/debian-legacy/initrd.img && \\
           echo "Published kernel and initrd from \$root."; } 2>&1 )
  # Remember the answer so the next pass defaults to the root this store actually uses.
  sed -i '/^LANE_ROOT=/d' "\$CONF" 2>/dev/null; echo "LANE_ROOT=\$root" >> "\$CONF"
  lane_audit "Republished the lane image" "Root \$root -> TFTP tree."
  msg "\$out\\n\\nNow reboot the lanes (Lanes > Reboot all lanes) so they boot the new root."
}

# Builds the diskless root from scratch: Debian base, the fleet layer (kiosk, bridges,
# lane agent) and this store's hardware profiles from the cloud. This is the FLEET PATCH
# path — re-running is expected. Republish above only moves an already-built root's kernel
# into the TFTP tree; it cannot change what is inside the root.
lane_build_image() {
  local which
  [ -x /usr/local/sbin/sureflow-build-lane-image ] || {
    msg "The lane image builder is not installed on this box.\\n\\nRe-run the installer (main menu > Re-run the installer) to lay it down, then come back."
    return
  }
  which=$(whiptail --title "Build a lane image" --menu \\
"Which variant?\\n\\nAllow 15-30 MINUTES PER VARIANT — it downloads a full Debian root over the backend\\nVLAN. The existing root is REPLACED, so every build is reproducible rather than a pile\\nof hand edits.\\n\\nLanes keep running on the old root until they reboot." 20 74 4 \\
    both   "Both variants (legacy + modern)" \\
    legacy "Legacy only — IBM SurePOS 700 class" \\
    modern "Modern only — Elo EPS00E2 class" \\
    back   "Back" 3>&1 1>&2 2>&3) || return
  [ "\$which" = "back" ] && return

  whiptail --title "Confirm build" --yesno \\
    "Rebuild the \$which lane image(s) for store \$STORE_ID now?\\n\\nRunning lanes are NOT touched — they pick the new root up on their next reboot, either\\nfrom the nightly maintenance window or Lanes > Reboot here." 13 74 || return

  clear
  echo "Building \$which. Leave this running; progress prints as it goes."
  echo
  /usr/local/sbin/sureflow-build-lane-image "\$which"
  echo
  read -r -p "Press Enter to return to the menu. " _
  # The builder writes its own summary and files its own audit entry.
  [ -f /srv/sureflow/.lane-image-summary ] && msg "\$(cat /srv/sureflow/.lane-image-summary)"
}

lane_ssh_note() {
  msg "SSH to a lane is not possible — by design.\\n\\nLanes sit on the ISOLATED PXE VLAN (40). The controller NATs them outbound only:\\n  * nothing on the backend VLAN can open a connection INTO a lane — no SSH, no HTTP;\\n  * the relay sees the CONTROLLER's address as the source of every lane request, so a\\n    lane's real IP is never known to it.\\nThis is what keeps the lane network unreachable from the rest of the store.\\n\\nWhat to use instead:\\n  * Lanes table here — the agent's last poll tells you if a lane is alive.\\n  * On the lane itself: curl http://127.0.0.1:3099/health (loopback only).\\n  * Remote action: queue a reboot; the lane's agent collects it outbound.\\n  * Anything deeper needs the physical lane, or a change to the VLAN design."
}

lanes_menu() {
  while true; do
    CHOICE=$(whiptail --title "Lanes — store \$STORE_ID" --menu "" 19 74 7 \\
      list    "Lane status table" \\
      reboot  "Reboot one lane" \\
      all     "Reboot all lanes (batched)" \\
      build   "Build a lane image (full rebuild)" \\
      image   "Republish the lane image (kernel only)" \\
      ssh     "SSH to a lane?" \\
      back    "Back" 3>&1 1>&2 2>&3) || return
    case "\$CHOICE" in
      list) lane_list ;; reboot) lane_reboot_one ;; all) lane_reboot_all ;;
      build) lane_build_image ;; image) lane_rebuild_image ;; ssh) lane_ssh_note ;; back) return ;;
    esac
  done
}

# --- local controller actions ------------------------------------------------
relay_health() {
  local h s
  h=$(curl -s --max-time 3 http://127.0.0.1:3000/api/health || echo "relay not answering on 127.0.0.1:3000")
  s=$(systemctl is-active sureflow-relay 2>/dev/null || echo missing)
  msg "sureflow-relay: \$s\\nBind address: \${BACKEND_IP:-unknown} (backend VLAN)\\nRunning ref: \${CURRENT_REF:-unknown}\\n\\n/api/health:\\n\$h"
}

relay_restart() {
  whiptail --title "Restart relay" --yesno "Restart sureflow-relay now?\\n\\nAny lane mid-print will fail that print and retry." 11 74 || return
  systemctl restart sureflow-relay 2>/dev/null || msg "Could not restart — on an HA pair keepalived owns the relay; use the role script instead."
  sleep 2; relay_health
}

boot_status() {
  local d n leases
  d=$(systemctl is-active dnsmasq 2>/dev/null || echo missing)
  n=$(systemctl is-active nfs-kernel-server 2>/dev/null || echo missing)
  leases=$(grep -c . /var/lib/misc/dnsmasq.leases 2>/dev/null || echo 0)
  msg "PXE boot services\\n\\ndnsmasq (PXE VLAN \${PXE_IP:-?}): \$d\\nnfs-kernel-server: \$n\\nLanes holding a DHCP lease: \$leases\\n\\nPXE subnet: \${PXE_SUBNET:-unknown}\\nExports:\\n\$(exportfs -s 2>/dev/null | head -5)"
}

tail_log() {
  clear
  echo "journalctl -u sureflow-relay -f   (Ctrl+C to return to the menu)"
  trap 'trap - INT; return' INT
  journalctl -u sureflow-relay -f -n 60 || true
  trap - INT
}

# --- main menu ---------------------------------------------------------------
while true; do
  CHOICE=$(whiptail --title "SureFlow Controller — store \$STORE_ID (\${ROLE:-standalone})" \\
    --menu "" 20 74 8 \\
    relay     "Relay health" \\
    restart   "Restart the relay" \\
    lanes     "Manage lanes" \\
    operators "Manage operators" \\
    boot      "PXE / boot status" \\
    log       "Tail the relay log" \\
    install   "Re-run the installer" \\
    shell     "Exit to a shell" 3>&1 1>&2 2>&3) || exit 0
  case "\$CHOICE" in
    relay)     relay_health ;;
    restart)   relay_restart ;;
    lanes)     lanes_menu ;;
    operators) operators_menu ;;
    boot)      boot_status ;;
    log)       tail_log ;;
    install)   clear; sudo /usr/local/sbin/sureflow-controller-install; ;;
    shell)     clear; exit 0 ;;
  esac
done
`;

// Launched on login for interactive shells only, so scp/rsync and the maintenance
// automations are never trapped in the menu.
export const CONTROLLER_MENU_PROFILE = `# /etc/profile.d/sureflow-menu.sh
# Drop an admin straight into the controller menu on console or SSH login.
# Interactive shells only — a non-interactive session (scp, rsync, remote command)
# must never be swallowed by whiptail.
case "$-" in
  *i*)
    if [ -z "\${SUREFLOW_MENU_SHOWN:-}" ] && [ -x /usr/local/bin/sureflow-menu ]; then
      export SUREFLOW_MENU_SHOWN=1
      /usr/local/bin/sureflow-menu
    fi
    ;;
esac
`;

export const CONTROLLER_MENU_ITEMS = [
  {
    item: "Relay health",
    detail:
      "systemctl state plus the relay's own /api/health, the backend-VLAN address it binds, and the git ref the box is running — the same ref the Cloud-Pushed Updates page reconciles against.",
  },
  {
    item: "Restart the relay",
    detail:
      "Standalone boxes restart the unit directly. On an HA pair keepalived's role script owns the relay lifecycle, so the menu says so rather than fighting it.",
  },
  {
    item: "Manage lanes",
    detail:
      "A status table merging three sources that each know only part of the answer: the cloud lists which registers the store has, the relay reports which lane agents have actually polled in (the only proof a lane is alive), and dnsmasq shows which MACs hold a PXE lease. From there: reboot one lane, reboot all in batches, build a lane image from scratch, or republish an already-built root's kernel. SSH is a deliberate dead end and the menu explains why rather than offering an option that times out.",
  },
  {
    item: "Build a lane image",
    detail:
      "The fleet patch path, and the same builder the installer offers. Rebuilds the diskless root end to end — Debian base, the kiosk launcher and serial / printer bridges and lane agent, then this store's HardwareLibrary profiles pulled from the cloud with the relay API key. Re-running is expected and the root is replaced rather than edited, so a build is always reproducible. Running lanes are untouched; they pick the new root up on their next reboot. A box with no cloud route still gets a bootable image and says on the summary that the hardware profiles were skipped.",
  },
  {
    item: "Manage operators",
    detail:
      "List, add, edit and remove this store's operators against the cloud. Runs through relaySync with the store's API key, so it is scoped to this store and every write lands in the audit trail.",
  },
  {
    item: "PXE / boot status",
    detail:
      "dnsmasq and nfs-kernel-server state, the PXE subnet in use, current DHCP leases (how many lanes are up) and the live NFS exports.",
  },
  {
    item: "Tail the relay log",
    detail: "journalctl -u sureflow-relay -f, with Ctrl+C returning to the menu instead of dropping to a shell.",
  },
  {
    item: "Re-run the installer",
    detail: "Re-runs the wizard with the saved answers as defaults — how a box is re-addressed or promoted into an HA pair.",
  },
];