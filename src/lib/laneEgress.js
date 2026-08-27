// Scoped egress for the isolated PXE boot VLAN 40.
//
// THE PROBLEM THIS SOLVES: VLAN 40 was designed to route nowhere, which is the right
// instinct for a segment where a terminal trusts whatever answers its DHCP boot request.
// But the POS is a CLOUD app — a lane that cannot reach it loads nothing at all (white
// screen, and no offline mode either, because offline mode needs a first online load).
//
// So VLAN 40 is not opened to the internet; it is opened to exactly TWO destinations:
//   1. the cloud POS, matched by HOSTNAME (dnsmasq populates an ipset as it resolves,
//      so the rule follows the cloud host to a new IP with no rule edit), and
//   2. this store's relay, on its one port.
// Everything else on the backend VLAN — printers, pinpads, other store systems — stays
// unreachable from a lane, so the isolation property that mattered is kept.
//
// Consumed by controllerTarball (installed + run by ./install) and by the Technical Docs
// PXE guide as a numbered step.

export const POS_EGRESS_HOST = "sure-flow-pos.base44.app";
export const POS_EGRESS_IPSET = "sureflow_pos";

export const LANE_EGRESS_SCRIPT = `#!/bin/bash
# /usr/local/sbin/sureflow-lane-egress
# Applies scoped egress for the PXE lane VLAN. Idempotent — safe to re-run, and it is
# re-run on every boot by sureflow-lane-egress.service.
#
# Reads /etc/sureflow/controller.conf so an HA store's floating VIP keeps working and
# nothing about the store is hardcoded here.
set -uo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[ "\$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }

CONF=/etc/sureflow/controller.conf
[ -r "\$CONF" ] || { echo "No \$CONF — run sureflow-controller-install first."; exit 1; }
# shellcheck disable=SC1090
. "\$CONF"

POS_HOST="\${POS_HOST:-${POS_EGRESS_HOST}}"
SET=${POS_EGRESS_IPSET}
PXE_SUBNET="\${PXE_SUBNET:-10.0.40.0/24}"
PXE_IP="\${PXE_IP:-10.0.40.10}"
# The relay a lane talks to for printing, the drawer kick and the offline sale queue.
# RELAY_HOST in controller.conf wins; otherwise the store's backend VIP, then this box's
# own backend address — which is correct for the combined controller build.
RELAY_HOST="\${RELAY_HOST:-\${BACKEND_VIP:-\${BACKEND_IP:-}}}"
RELAY_PORT="\${RELAY_PORT:-3000}"

[ -n "\$RELAY_HOST" ] || { echo "No RELAY_HOST / BACKEND_VIP / BACKEND_IP in \$CONF — cannot scope relay egress."; exit 1; }

# Which interface carries which VLAN, derived from the addresses rather than guessed:
# interface names differ per box (ens6, vmbr0.40, eno1.40...) and a wrong guess produces
# rules that silently match nothing.
iface_for() { ip -o -4 addr show | awk -v ip="\$1" '\$4 ~ "^"ip"/" {print \$2; exit}'; }
PXE_IF="\$(iface_for "\$PXE_IP")"
WAN_IF="\$(ip -o -4 route show default | awk '{print \$5; exit}')"
[ -n "\$PXE_IF" ] || { echo "No interface holds \$PXE_IP — check the VLAN 40 address."; exit 1; }
[ -n "\$WAN_IF" ] || { echo "No default route on this box — the backend VLAN has no internet route yet."; exit 1; }

echo "PXE VLAN on \$PXE_IF (\$PXE_SUBNET) -> egress via \$WAN_IF"
echo "Allowed: \$POS_HOST (tcp 443, hostname-scoped) and \$RELAY_HOST:\$RELAY_PORT"

command -v ipset >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y ipset >/dev/null 2>&1
command -v iptables >/dev/null || DEBIAN_FRONTEND=noninteractive apt-get install -y iptables >/dev/null 2>&1

# The hostname-scoped allow-list. dnsmasq ADDS to this set every time it resolves the POS
# hostname for a lane, so the rule tracks the cloud host's current addresses by itself.
# timeout 86400 lets a retired address age out instead of accumulating forever.
ipset create "\$SET" hash:ip timeout 86400 2>/dev/null || true

# --- dnsmasq: serve DNS to the lanes, resolve ONLY the POS -------------------
# option 6 (dns-server) points lanes at this controller. Only the POS hostname is
# forwarded upstream; every other name is answered 0.0.0.0, so a lane cannot use the
# controller as a general resolver to reach anything else by name.
install -d -m 755 /etc/dnsmasq.d
cat >/etc/dnsmasq.d/sureflow-lane-egress.conf <<DNSEOF
# Written by sureflow-lane-egress — do not hand-edit; re-run the script instead.
dhcp-option=option:dns-server,\$PXE_IP
# Resolve the cloud POS, and record its addresses into the ipset the firewall matches.
server=/\$POS_HOST/1.1.1.1
server=/\$POS_HOST/8.8.8.8
ipset=/\$POS_HOST/\$SET
# Everything else: answered 0.0.0.0 rather than forwarded. A lane has no business
# resolving anything but the POS.
address=/#/
DNSEOF
systemctl restart dnsmasq >/dev/null 2>&1 || echo "WARNING: dnsmasq did not restart — lanes will have no DNS."

# --- forwarding + NAT -------------------------------------------------------
sysctl -qw net.ipv4.ip_forward=1
sed -i '/^net.ipv4.ip_forward/d' /etc/sysctl.d/99-sureflow-egress.conf 2>/dev/null || true
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-sureflow-egress.conf

# A dedicated chain, flushed on every run, so re-running never stacks duplicate rules and
# nothing else on the box is disturbed.
iptables -N SUREFLOW_LANE_EGRESS 2>/dev/null || true
iptables -F SUREFLOW_LANE_EGRESS
iptables -C FORWARD -i "\$PXE_IF" -j SUREFLOW_LANE_EGRESS 2>/dev/null || \\
  iptables -I FORWARD 1 -i "\$PXE_IF" -j SUREFLOW_LANE_EGRESS

# Return traffic for connections a lane opened.
iptables -A SUREFLOW_LANE_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# 1. the cloud POS over https, matched by the dnsmasq-maintained set.
iptables -A SUREFLOW_LANE_EGRESS -s "\$PXE_SUBNET" -p tcp --dport 443 -m set --match-set "\$SET" dst -j ACCEPT
# 2. this store's relay, on its one port.
iptables -A SUREFLOW_LANE_EGRESS -s "\$PXE_SUBNET" -p tcp -d "\$RELAY_HOST" --dport "\$RELAY_PORT" -j ACCEPT
# Everything else a lane tries to reach off its own VLAN is refused. REJECT rather than
# DROP so a misconfigured lane fails fast instead of hanging for a timeout.
iptables -A SUREFLOW_LANE_EGRESS -j REJECT --reject-with icmp-admin-prohibited

# NAT only the two allowed destinations, for the same reason.
iptables -t nat -C POSTROUTING -s "\$PXE_SUBNET" -o "\$WAN_IF" -p tcp --dport 443 -m set --match-set "\$SET" dst -j MASQUERADE 2>/dev/null || \\
  iptables -t nat -A POSTROUTING -s "\$PXE_SUBNET" -o "\$WAN_IF" -p tcp --dport 443 -m set --match-set "\$SET" dst -j MASQUERADE
iptables -t nat -C POSTROUTING -s "\$PXE_SUBNET" -p tcp -d "\$RELAY_HOST" --dport "\$RELAY_PORT" -j MASQUERADE 2>/dev/null || \\
  iptables -t nat -A POSTROUTING -s "\$PXE_SUBNET" -p tcp -d "\$RELAY_HOST" --dport "\$RELAY_PORT" -j MASQUERADE

# Warm the set so the FIRST lane to boot is not waiting on a resolution it has not made
# yet — without this the very first request can be rejected before dnsmasq has populated
# the set, which reads as an intermittent white screen on a cold controller.
getent ahostsv4 "\$POS_HOST" 2>/dev/null | awk '{print \$1}' | sort -u | while read -r a; do
  [ -n "\$a" ] && ipset add "\$SET" "\$a" timeout 86400 2>/dev/null
done

echo
echo "Applied. Current allow-list for \$POS_HOST:"
ipset list "\$SET" | sed -n '/Members/,\$p'
echo
echo "Verify FROM A LANE:"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' https://\$POS_HOST/pos/login    # expect 200"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://\$RELAY_HOST:\$RELAY_PORT/api/connectivity"
echo "  curl -m 3 http://<any other backend host>/                            # expect refused"
`;

export const LANE_EGRESS_UNIT = `# /etc/systemd/system/sureflow-lane-egress.service
# Re-applies the scoped egress rules on every boot. This is the persistence mechanism:
# ipset contents and iptables rules do not survive a reboot, and re-running the script is
# both idempotent and always consistent with the current controller.conf — which an
# iptables-save snapshot is not once a store's relay address changes.
[Unit]
Description=SureFlow lane VLAN scoped egress
After=network-online.target dnsmasq.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/sureflow-lane-egress

[Install]
WantedBy=multi-user.target
`;

export const LANE_EGRESS_STEP = {
  step_id: "pxe_lane_egress",
  label: "Give the lane VLAN scoped egress (cloud POS + relay only)",
  instructions: [
    "WHY THIS EXISTS: VLAN 40 is isolated by design, but the POS is a CLOUD app — a lane that cannot reach it shows a white screen and never loads, and there is no offline mode either, because offline mode needs a first successful online load. This step opens VLAN 40 to exactly two destinations and nothing else.",
    `ALLOWED: the cloud POS (${POS_EGRESS_HOST}) over tcp 443, and this store's relay on port 3000. REFUSED: every other backend-VLAN host — printers, pinpads, other store systems — so a compromised lane still cannot probe the backend. That was the isolation property worth keeping.`,
    `HOSTNAME-SCOPED, not IP-scoped: dnsmasq adds the POS's addresses to an ipset (${POS_EGRESS_IPSET}) as it resolves them, and the firewall matches that set. If the cloud host moves to a new IP the rule follows it with no edit — an IP allow-list would silently break the whole fleet the day that happened.`,
    "The lanes get this controller as their DNS server (DHCP option 6), and it resolves ONLY the POS hostname — every other name is answered 0.0.0.0. So a lane cannot use the controller as a general resolver to reach something else by name.",
    "The relay address is read from /etc/sureflow/controller.conf (RELAY_HOST, else BACKEND_VIP, else BACKEND_IP), never hardcoded, so an HA store's floating VIP keeps working across a failover. Set RELAY_HOST explicitly when the relay is a separate VM from the controller.",
    "Interfaces are derived from the addresses rather than guessed — box to box the PXE interface is ens6, vmbr0.40 or eno1.40, and a guessed name produces rules that match nothing while looking correct in iptables -L.",
    "Re-running is the repair path: the rules live in a dedicated SUREFLOW_LANE_EGRESS chain that is flushed each run, so nothing stacks up and nothing else on the box is touched.",
    "Persistence is the systemd unit, not iptables-save. ipset contents and rules are lost on reboot, and a saved snapshot goes stale the moment a store's relay address changes — re-applying from controller.conf on every boot is always correct.",
    "The controller tarball's ./install now applies this automatically, so a freshly installed box is egress-ready. The commands below are the manual path for an existing controller.",
  ],
  commands: [
    "# Apply (or re-apply) on an existing controller",
    "sudo apt-get install -y ipset iptables",
    "sudo sureflow-lane-egress",
    "sudo systemctl enable --now sureflow-lane-egress",
    "# Confirm on the CONTROLLER",
    `sudo ipset list ${POS_EGRESS_IPSET}          # the POS's current addresses`,
    "sudo iptables -L SUREFLOW_LANE_EGRESS -n -v  # accept POS + relay, then REJECT",
    "sudo iptables -t nat -L POSTROUTING -n       # MASQUERADE only those two",
    "# Confirm FROM A LANE",
    `curl -s -o /dev/null -w '%{http_code}\\n' https://${POS_EGRESS_HOST}/pos/login   # expect 200`,
    "curl -s -o /dev/null -w '%{http_code}\\n' http://<relay_ip>:3000/api/connectivity",
    "curl -m 3 http://<other backend host>/       # expect 'No route' / refused",
  ],
  codeFiles: [
    { name: "sureflow-lane-egress", code: LANE_EGRESS_SCRIPT },
    { name: "sureflow-lane-egress.service", code: LANE_EGRESS_UNIT },
  ],
  postInstructions: [
    "Reboot a lane: it should now load the POS login instead of a white screen, with its register already selected.",
    "Lane still white? Check DNS first — on the lane, getent hosts the POS name. No answer means dnsmasq did not restart or option 6 never reached the lane (renew its lease by rebooting, not by editing the lane).",
    "DNS resolves but the page still fails? The ipset was empty at the moment of the request. Run sureflow-lane-egress on the controller to warm it, then retry — the script seeds the set for exactly this reason.",
    "POS loads but the lane prints through the browser dialog instead of the printer? That is the relay leg, not this step — confirm RELAY_HOST/BACKEND_VIP in controller.conf matches the address the lane's boot entry passes as sureflow.relay.",
    "Deliberately test the refusal too: from a lane, curl another backend host and confirm it is rejected. If it succeeds, the FORWARD jump landed on the wrong interface — re-run the script and check the 'PXE VLAN on ...' line it prints.",
  ],
};