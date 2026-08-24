// Boot-time diagnostic status codes on the lane's pole display.
//
// The problem this solves: between power-on and the kiosk, a diskless lane can only
// talk through the splash screen — and a lane that never gets a framebuffer, never
// mounts its NFS root, or never gets a DHCP lease shows nothing at all. The 4690
// terminals answered this with a numeric code on the operator display, and a
// technician read the code rather than guessing.
//
// The pole display is the one device that is alive before the OS is useful: it is a
// dumb serial/TCP writer, so a two-line code can be pushed from a shell script at
// any point in the boot with nothing but bash. So each boot stage writes its code to
// the pole, and the LAST code shown is where the lane stopped.
//
// Codes are deliberately short and stable: B-codes are progress, E-codes are faults.
// A technician reads the code off the glass from the floor without a keyboard.

export const BOOT_STATUS_CODES = [
  {
    code: "B10",
    stage: "Firmware handoff",
    line1: "SUREFLOW  B10",
    line2: "NETWORK BOOT",
    written_by: "pxelinux (via the pole preload in the initrd hook)",
    meaning: "The terminal took a DHCP lease and pulled kernel + initrd from the controller over TFTP.",
    remedy: "Stuck here means TFTP served the kernel but the initramfs never ran — check the controller's tftp log and the pxelinux entry for this MAC.",
  },
  {
    code: "B20",
    stage: "Initramfs",
    line1: "SUREFLOW  B20",
    line2: "LOADING SYSTEM",
    written_by: "initramfs local-top hook",
    meaning: "The initramfs is up and about to bring the NIC up for the root mount.",
    remedy: "Stuck here is almost always a missing NIC driver in the initramfs for this terminal model.",
  },
  {
    code: "B30",
    stage: "Root filesystem",
    line1: "SUREFLOW  B30",
    line2: "MOUNTING ROOT",
    written_by: "initramfs local-bottom hook",
    meaning: "The NFS root export was mounted read-only and the system is about to switch onto it.",
    remedy: "Stuck here means the controller's NFS export is unreachable or refused this lane — check the export list and the VIP.",
  },
  {
    code: "B40",
    stage: "System services",
    line1: "SUREFLOW  B40",
    line2: "STARTING SERVICES",
    written_by: "sureflow-bootstatus@B40.service (After=basic.target)",
    meaning: "systemd reached basic.target on the NFS root; the lane's own bridges and tmpfs overlays are starting.",
    remedy: "Stuck here is a failed unit on the read-only root — journalctl -b -p err on the lane.",
  },
  {
    code: "B50",
    stage: "Peripherals",
    line1: "SUREFLOW  B50",
    line2: "CHECKING DEVICES",
    written_by: "sureflow-bootstatus@B50.service (After=sureflow-bridges.target)",
    meaning: "The printer, drawer, serial and pinpad bridges are published on their lane ports.",
    remedy: "Stuck here means a bridge unit is retrying — usually a peripheral that is unplugged or powered off.",
  },
  {
    code: "B60",
    stage: "Relay handshake",
    line1: "SUREFLOW  B60",
    line2: "CONTACTING STORE",
    written_by: "sureflow-bootstatus@B60.service (Before=sureflow-kiosk.service)",
    meaning: "The lane resolved its store relay and is waiting on a healthy answer before opening the POS.",
    remedy: "Stuck here is the relay, not the lane — check the store controller and, on an HA store, which box holds the VIP.",
  },
  {
    code: "B90",
    stage: "Lane ready",
    line1: "SUREFLOW  B90",
    line2: "TERMINAL READY",
    written_by: "sureflow-bootstatus@B90.service (After=sureflow-kiosk.service)",
    meaning: "The kiosk has the screen. This code is immediately replaced by the POS welcome message, so seeing it linger means the browser started but the app never took the pole over.",
    remedy: "B90 held on the glass = the POS loaded no register identity; check the lane's register_id in the boot URL.",
  },
  {
    code: "E01",
    stage: "Fault — no lease",
    line1: "SUREFLOW  E01",
    line2: "NO NETWORK",
    written_by: "initramfs hook (DHCP timeout)",
    meaning: "No DHCP lease on the PXE VLAN. The lane cannot find the controller at all.",
    remedy: "Untagged native VLAN on the lane port, controller's dnsmasq running, link light on the terminal NIC.",
    fault: true,
  },
  {
    code: "E02",
    stage: "Fault — no root",
    line1: "SUREFLOW  E02",
    line2: "ROOT MOUNT FAILED",
    written_by: "initramfs hook (NFS mount failure)",
    meaning: "The lane got a lease and the kernel, but the NFS root refused or timed out.",
    remedy: "Check /etc/exports and the boot profile's root path on the controller; on an HA store confirm DRBD is primary on the acting box.",
    fault: true,
  },
  {
    code: "E03",
    stage: "Fault — services",
    line1: "SUREFLOW  E03",
    line2: "SERVICE FAILURE",
    written_by: "OnFailure= on the lane's own units",
    meaning: "A required lane unit failed after the root mounted.",
    remedy: "journalctl -b -p err on the lane, or read the failure from the controller's lane log.",
    fault: true,
  },
  {
    code: "E04",
    stage: "Fault — no relay",
    line1: "SUREFLOW  E04",
    line2: "STORE OFFLINE",
    written_by: "sureflow-bootstatus (relay probe timeout)",
    meaning: "The relay never answered. The lane will still open the POS in offline mode.",
    remedy: "Store controller or VIP problem — the lane itself is healthy.",
    fault: true,
  },
  {
    code: "E05",
    stage: "Fault — kiosk",
    line1: "SUREFLOW  E05",
    line2: "POS START FAILED",
    written_by: "OnFailure=sureflow-bootstatus-fail@E05.service on the kiosk unit",
    meaning: "The browser kiosk gave up. This is the code that pairs with the falling beep tone.",
    remedy: "Check the kiosk unit's log; usually X failed to take the panel or the app URL is unreachable.",
    fault: true,
  },
];

export const PROGRESS_CODES = BOOT_STATUS_CODES.filter((c) => !c.fault);
export const FAULT_CODES = BOOT_STATUS_CODES.filter((c) => c.fault);

// The writer. Deliberately bash + /dev/tcp with no dependencies: it has to run inside
// the initramfs, where there is no node, no python and often no netcat.
export const BOOTSTATUS_SCRIPT = `#!/bin/bash
# /usr/local/bin/sureflow-bootstatus (inside the image AND the initramfs)
#
# Writes a two-line boot status code to this lane's pole display.
#
# Transport is resolved from the lane's own provisioning file, which the PXE
# controller writes per MAC — the lane never has to know the store's topology:
#
#   /etc/sureflow/pole.conf
#     POLE_HOST=192.168.1.60     # printer IP for pass-through poles, lane IP for USB
#     POLE_PORT=9100             # 9100 pass-through/chain, 9101 lane serial bridge
#     POLE_MODE=passthrough      # passthrough | direct
#
# Rules learned from the pole work:
#  * pass-through poles are reached THROUGH the receipt printer, so the write is
#    wrapped in ESC = 2 (select display) and closed with ESC = 1 (reselect printer).
#    Skipping the reselect leaves the printer deaf and the lane prints nothing.
#  * every write is fire-and-forget with a hard timeout. A lane must NEVER fail to
#    boot because its pole is missing, unplugged or a reserved model.
set -u
CONF=/etc/sureflow/pole.conf
[ -r "$CONF" ] || exit 0
. "$CONF"
[ -n "\${POLE_HOST:-}" ] || exit 0
PORT="\${POLE_PORT:-9100}"
MODE="\${POLE_MODE:-passthrough}"

CODE="\${1:-B10}"
L1="\${2:-SUREFLOW  $CODE}"
L2="\${3:-}"

pad() { printf '%-20.20s' "$1"; }   # the pole is exactly 20 columns per line

frame() {
  ESC=$'\\x1b'
  # Select the display when the pole hangs off the printer.
  [ "$MODE" = passthrough ] && printf '%s=\\x02' "$ESC"
  printf '%s' "$ESC"; printf '@'              # initialize display
  printf '%s' "$(pad "$L1")"
  printf '\\x0a\\x0d'                          # LF+CR -> second line
  printf '%s' "$(pad "$L2")"
  # Hand the port back to the printer, or receipts stop working.
  [ "$MODE" = passthrough ] && printf '%s=\\x01' "$ESC"
}

# 2s ceiling: a dead pole costs the boot two seconds, never the boot itself.
if exec 3<>/dev/tcp/"$POLE_HOST"/"$PORT" 2>/dev/null; then
  frame >&3 2>/dev/null || true
  exec 3>&- 2>/dev/null || true
fi &
BG=$!
( sleep 2; kill -9 $BG 2>/dev/null ) >/dev/null 2>&1 &
wait $BG 2>/dev/null || true

# Leave a breadcrumb the controller can read after the fact, so a lane that has no
# pole fitted is still diagnosable from the store side.
echo "$(date -Is) $CODE $L1 | $L2" >> /run/sureflow-bootstatus.log 2>/dev/null || true
exit 0
`;

// One templated unit per code keeps the wiring declarative: a new stage is a new
// Before=/After= drop-in, never an edit to a script.
export const BOOTSTATUS_UNITS = `# \${ROOT}/etc/systemd/system/sureflow-bootstatus@.service
# Progress code writer. Instance name IS the code: sureflow-bootstatus@B40.service.
[Unit]
Description=SureFlow lane boot status %i
DefaultDependencies=no

[Service]
Type=oneshot
RemainAfterExit=no
ExecStart=/usr/local/bin/sureflow-bootstatus %i

# --- \${ROOT}/etc/systemd/system/sureflow-bootstatus-fail@.service ---
# Fault code writer, wired with OnFailure= so a failing unit names its own E-code.
[Unit]
Description=SureFlow lane boot fault %i

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sureflow-bootstatus %i
ExecStartPost=/usr/local/bin/sureflow-beep fail

# --- Wiring (drop-ins, so the shipped units stay untouched) -----------------
# \${ROOT}/etc/systemd/system/basic.target.d/sureflow-b40.conf
#   [Unit]
#   Wants=sureflow-bootstatus@B40.service
#
# \${ROOT}/etc/systemd/system/sureflow-kiosk.service.d/sureflow-status.conf
#   [Unit]
#   Wants=sureflow-bootstatus@B60.service
#   After=sureflow-bootstatus@B60.service
#   OnFailure=sureflow-bootstatus-fail@E05.service
#
# \${ROOT}/etc/systemd/system/sureflow-bootstatus@B90.service.d/after-kiosk.conf
#   [Unit]
#   After=sureflow-kiosk.service
#   [Install]
#   WantedBy=multi-user.target
`;

// The initramfs half. This is the part that actually earns the feature: B10/B20/B30
// and E01/E02 all happen BEFORE there is a root filesystem, which is exactly the
// window where a lane is otherwise a black screen.
export const BOOTSTATUS_INITRAMFS_HOOK = `#!/bin/sh
# /etc/initramfs-tools/hooks/sureflow-bootstatus (inside the image)
# Copies the writer, its config and bash into the initramfs.
. /usr/share/initramfs-tools/hook-functions
copy_exec /usr/local/bin/sureflow-bootstatus /usr/local/bin
copy_exec /bin/bash /bin
copy_exec /usr/bin/timeout /usr/bin
mkdir -p "\${DESTDIR}/etc/sureflow"
cp /etc/sureflow/pole.conf "\${DESTDIR}/etc/sureflow/" 2>/dev/null || true
exit 0

# --- /etc/initramfs-tools/scripts/local-top/sureflow-bootstatus ------------
# #!/bin/sh
# [ "$1" = prereqs ] && { echo; exit 0; }
# /usr/local/bin/sureflow-bootstatus B20 "SUREFLOW  B20" "LOADING SYSTEM"

# --- /etc/initramfs-tools/scripts/local-bottom/sureflow-bootstatus ---------
# #!/bin/sh
# [ "$1" = prereqs ] && { echo; exit 0; }
# if [ -d /root/etc ]; then
#   /usr/local/bin/sureflow-bootstatus B30 "SUREFLOW  B30" "MOUNTING ROOT"
# else
#   /usr/local/bin/sureflow-bootstatus E02 "SUREFLOW  E02" "ROOT MOUNT FAILED"
# fi
`;

// Per-lane provisioning. Generated from the register's own hardware profile, so the
// pole address the boot writer uses is the same one the relay uses at runtime.
export function poleConfForRegister(register) {
  const usesLaneBridge = register?.pole_display_model === "toshiba_usb_2x20";
  const host = register?.pole_display_ip || register?.printer_ip || "";
  return [
    `# /etc/sureflow/pole.conf — lane ${register?.register_id || "?"} (${register?.name || ""})`,
    `# Written by the controller per MAC ${register?.mac_address || "??:??:??:??:??:??"}.`,
    `POLE_HOST=${host}`,
    `POLE_PORT=${usesLaneBridge ? 9101 : 9100}`,
    `POLE_MODE=${usesLaneBridge ? "direct" : "passthrough"}`,
  ].join("\n");
}