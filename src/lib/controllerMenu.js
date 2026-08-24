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
    --menu "" 18 74 7 \\
    relay     "Relay health" \\
    restart   "Restart the relay" \\
    operators "Manage operators" \\
    boot      "PXE / boot status" \\
    log       "Tail the relay log" \\
    install   "Re-run the installer" \\
    shell     "Exit to a shell" 3>&1 1>&2 2>&3) || exit 0
  case "\$CHOICE" in
    relay)     relay_health ;;
    restart)   relay_restart ;;
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