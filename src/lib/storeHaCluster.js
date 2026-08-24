// Redundant store-local stack — config generators for the controller pair.
//
// Each store runs TWO commodity controller boxes. Every box runs BOTH roles:
//   * PXE/TFTP/DHCP + NFS root  (lanes boot from it)
//   * SureFlow Local Relay      (printers, pinpads, offline sales, cloud sync)
//
// The diskless root lives on a DRBD device mirrored between the two boxes, and a
// keepalived VIP fronts the pair. Lanes and the cloud only ever talk to the VIP,
// so a promotion is invisible to both.
//
// Deliberately NOT here: any lane-side local-disk cache. The IBM terminals in this
// fleet have no drive backplane, so a running lane still hangs on the next NFS
// access if its controller dies mid-transaction. A lane REBOOT recovers onto the
// surviving box — that is the resilience this design buys.

export const HA_DRBD_RESOURCE = "sfroot";
export const HA_DRBD_DEVICE = "/dev/drbd0";
export const HA_EXPORT_PATH = "/srv/sureflow";
export const HA_VRRP_ID = 51;

const ip = (v, fb) => (v && String(v).trim()) || fb;

/** keepalived — the floating VIP plus the promote/demote hooks. */
export function haKeepalivedConf(store = {}, role = "primary") {
  const isPrimary = role === "primary";
  const vip = ip(store.controller_vip, "192.168.1.50");
  const self = ip(isPrimary ? store.primary_controller_host : store.secondary_controller_host, isPrimary ? "192.168.1.51" : "192.168.1.52");
  const peer = ip(isPrimary ? store.secondary_controller_host : store.primary_controller_host, isPrimary ? "192.168.1.52" : "192.168.1.51");
  return `# /etc/keepalived/keepalived.conf  —  ${role.toUpperCase()} controller, store ${store.store_number || "NNN"}
# Both boxes run this file; only priority and the addresses differ.

vrrp_script chk_relay {
    script  "/usr/local/bin/sureflow-ha-check"
    interval 5
    fall     3          # 3 straight failures (15s) before giving up the VIP
    rise     2
    weight  -40         # drop below the peer's priority instead of hard-failing
}

vrrp_instance SFCTRL {
    state           ${isPrimary ? "MASTER" : "BACKUP"}
    interface       eth0
    virtual_router_id ${HA_VRRP_ID}
    priority        ${isPrimary ? 150 : 100}
    advert_int      1
    unicast_src_ip  ${self}
    unicast_peer    { ${peer} }

    authentication {
        auth_type PASS
        auth_pass sfha${store.store_number || "000"}
    }

    virtual_ipaddress {
        ${vip}/24 dev eth0
    }

    track_script { chk_relay }

    # Promotion order matters: DRBD must be primary and mounted BEFORE nfs-kernel-server
    # starts, or lanes get an empty export and hang exactly as if the box were dead.
    notify_master "/usr/local/bin/sureflow-ha-role master"
    notify_backup "/usr/local/bin/sureflow-ha-role backup"
    notify_fault  "/usr/local/bin/sureflow-ha-role backup"
}`;
}

/** DRBD resource — block-level mirror of the diskless root + relay database. */
export function haDrbdResource(store = {}) {
  const p = ip(store.primary_controller_host, "192.168.1.51");
  const s = ip(store.secondary_controller_host, "192.168.1.52");
  return `# /etc/drbd.d/${HA_DRBD_RESOURCE}.res
# Mirrors the diskless root, TFTP tree and the relay's SQLite database, so the
# standby box is byte-for-byte identical and can serve lanes immediately.

resource ${HA_DRBD_RESOURCE} {
    protocol C;                     # synchronous — a committed offline sale is on BOTH boxes

    disk {
        on-io-error   detach;
        resync-rate   40M;
    }

    net {
        # Single-primary. Two primaries on a non-cluster filesystem corrupts the root.
        allow-two-primaries no;
        after-sb-0pri discard-zero-changes;
        after-sb-1pri discard-secondary;
        after-sb-2pri disconnect;    # never auto-resolve a real split brain
        verify-alg    sha1;
    }

    on ctrl-a {
        device   ${HA_DRBD_DEVICE};
        disk     /dev/sdb1;
        address  ${p}:7788;
        meta-disk internal;
    }
    on ctrl-b {
        device   ${HA_DRBD_DEVICE};
        disk     /dev/sdb1;
        address  ${s}:7788;
        meta-disk internal;
    }
}`;
}

/** The role script keepalived calls — the whole promotion sequence lives here. */
export function haRoleScript(store = {}) {
  return `#!/bin/bash
# /usr/local/bin/sureflow-ha-role   —   sureflow-ha-role master|backup
# Called by keepalived on every VIP transition. Idempotent: safe to run twice.
set -euo pipefail
RES=${HA_DRBD_RESOURCE}
MNT=${HA_EXPORT_PATH}

case "\${1:-}" in
  master)
    # Order is load-bearing. Storage first, then the services that read it.
    drbdadm primary $RES
    mountpoint -q "$MNT" || mount ${HA_DRBD_DEVICE} "$MNT"
    exportfs -ra
    systemctl start nfs-kernel-server
    systemctl start tftpd-hpa
    systemctl start isc-dhcp-server
    systemctl start sureflow-relay
    logger -t sureflow-ha "PROMOTED to acting primary (store ${store.store_number || "NNN"})"
    ;;
  backup)
    # Stop top-down so nothing holds the mount open when DRBD is demoted.
    systemctl stop sureflow-relay      || true
    systemctl stop isc-dhcp-server     || true
    systemctl stop tftpd-hpa           || true
    systemctl stop nfs-kernel-server   || true
    umount "$MNT"                      || true
    drbdadm secondary $RES             || true
    logger -t sureflow-ha "DEMOTED to warm standby (store ${store.store_number || "NNN"})"
    ;;
  *) echo "usage: $0 master|backup" >&2; exit 2 ;;
esac`;
}

/** Health probe keepalived scores the node with. */
export const HA_CHECK_SCRIPT = `#!/bin/bash
# /usr/local/bin/sureflow-ha-check
# Scored by keepalived every 5s. Any failure sheds priority so the peer takes over.
set -uo pipefail

# 1. The relay must actually answer, not merely be "active" in systemd.
curl -fsS --max-time 3 http://127.0.0.1:3000/api/health >/dev/null || exit 1

# 2. DRBD must not be disconnected — serving lanes from an unmirrored root means
#    the next failover silently loses whatever was written here.
drbdadm cstate ${HA_DRBD_RESOURCE} | grep -q '^Connected' || exit 1

# 3. The export must be mounted, or lanes get an empty root and hang.
mountpoint -q ${HA_EXPORT_PATH} || exit 1

exit 0`;

/** NFS export — identical on both boxes; only the acting primary has it mounted. */
export function haNfsExports(store = {}) {
  return `# /etc/exports   (identical on both controllers)
# Subnet-wide so a lane boots from whichever box holds the VIP without re-keying.
# no_root_squash is required: the diskless root is mounted as root by the lane kernel.
${HA_EXPORT_PATH}/root  192.168.1.0/255.255.255.0(rw,sync,no_subtree_check,no_root_squash)
${HA_EXPORT_PATH}/home  192.168.1.0/255.255.255.0(rw,sync,no_subtree_check)

# Store ${store.store_number || "NNN"} — lanes point at the VIP ${ip(store.controller_vip, "192.168.1.50")}, never at a box address.`;
}

/** Relay unit — same on both nodes, started only by the role script. */
export const HA_RELAY_UNIT = `# /etc/systemd/system/sureflow-relay.service   (identical on both controllers)
[Unit]
Description=SureFlow Local Relay
# No WantedBy/enable: keepalived's role script owns start/stop. An enabled unit
# would run the relay on BOTH boxes and double every cloud sync.
After=network-online.target
Requires=network-online.target

[Service]
Type=simple
User=sureflow
WorkingDirectory=/opt/sureflow-relay
EnvironmentFile=/etc/sureflow/relay.env
ExecStart=/usr/bin/node /opt/sureflow-relay/server.js
Restart=on-failure
RestartSec=5

[Install]
# Intentionally empty — do NOT systemctl enable this unit.`;

/** DHCP next-server must be the VIP, or failover only half works. */
export function haDhcpSnippet(store = {}) {
  const vip = ip(store.controller_vip, "192.168.1.50");
  return `# /etc/dhcp/dhcpd.conf  (identical on both controllers)
# next-server is the VIP. Point it at a box address and lanes keep trying a dead
# controller after a failover even though the relay moved.
next-server ${vip};
filename "pxelinux.0";

# The kernel append line must also use the VIP for the NFS root:
#   nfsroot=${vip}:${HA_EXPORT_PATH}/root
#
# Both boxes serve DHCP, but only the acting primary has isc-dhcp-server running
# (the role script starts it), so there is never a competing offer.`;
}

export const HA_ENV_NOTE = `/etc/sureflow/relay.env is IDENTICAL on both controllers — same STORE_ID and same
CLOUD_API_KEY from the store's relay credential. The cloud authenticates the store,
not the box, so a promoted secondary keeps syncing with no key rotation.
Remember: no inline comments in this file — they are parsed as part of the value.`;

export const HA_BUILD_STEPS = [
  {
    step: "Provision both boxes identically",
    detail:
      "Same Debian build, same package set, same /etc/sureflow layout, hostnames ctrl-a and ctrl-b (the DRBD resource matches on hostname). A second disk or partition on each box becomes the DRBD backing device.",
  },
  {
    step: "Bring up the DRBD mirror",
    detail:
      "drbdadm create-md sfroot on both, then drbdadm up sfroot on both, then force one side primary once with --force to seed the initial sync. Wait for Connected UpToDate/UpToDate before going further — promoting mid-sync serves lanes a half-copied root.",
  },
  {
    step: "Move the boot tree onto the mirror",
    detail:
      "Copy the existing diskless root, TFTP tree and the relay's data directory into /srv/sureflow on the primary, then mount the DRBD device there. From now on both boxes see the same content and image updates are made once.",
  },
  {
    step: "Install the role and health scripts",
    detail:
      "sureflow-ha-role and sureflow-ha-check into /usr/local/bin, chmod +x, on BOTH boxes. Disable nfs-kernel-server, tftpd-hpa, isc-dhcp-server and sureflow-relay from boot — the role script owns their lifecycle, and an enabled relay on both nodes double-syncs to the cloud.",
  },
  {
    step: "Start keepalived and confirm the VIP",
    detail:
      "Primary gets priority 150, secondary 100, same virtual_router_id and auth_pass. ip addr show should list the VIP on exactly one box. Two boxes holding it means unicast_peer is wrong and the pair cannot see each other.",
  },
  {
    step: "Repoint the store at the VIP",
    detail:
      "Set the store's Relay URL and Controller VIP to the VIP address, and update DHCP next-server plus the kernel nfsroot= to match. A store left pointing at a box address fails over on paper only.",
  },
];

export const HA_VALIDATION_STEPS = [
  {
    step: "Verify the mirror is clean",
    detail:
      "drbdadm status sfroot on both boxes must read Connected with UpToDate on each side. Anything else (Inconsistent, StandAlone, WFConnection) means a failover would lose data — fix before testing.",
  },
  {
    step: "Boot a lane through the VIP",
    detail:
      "PXE boot one lane and confirm it pulls its kernel and NFS root via the VIP, not a box address. Check the lane's mount output — it should show the VIP as the NFS server.",
  },
  {
    step: "Run a planned failover",
    detail:
      "systemctl stop keepalived on the primary. The VIP should appear on the secondary within ~5 seconds, DRBD should promote, and NFS/TFTP/DHCP/relay should come up in that order. journalctl -t sureflow-ha shows the promotion.",
  },
  {
    step: "Confirm the store still works on the secondary",
    detail:
      "Reboot a lane — it must boot fully off the secondary. Ring a sale and print a receipt to prove the relay took over printers and the cloud sync resumed under the same API key.",
  },
  {
    step: "Confirm the running-lane gap honestly",
    detail:
      "A lane that was mid-transaction when the primary died will hang on its next NFS access — expected, since these terminals have no local disk. Reboot it; it recovers on the secondary. Do not report this as a bug.",
  },
  {
    step: "Fail back under control",
    detail:
      "Start keepalived on the recovered primary and wait for DRBD to reach UpToDate/UpToDate BEFORE the VIP moves back. Then clear the failback flag in the Infrastructure Command Center so the cloud state matches reality.",
  },
];