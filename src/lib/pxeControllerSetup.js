// Build guide for a store's PXE / diskless boot controller — the Debian box (or
// Proxmox VM) that serves boot images to the lane terminals over an isolated VLAN.
// Consumed by PXEControllerGuide via the shared SetupStepDetail renderer.

const DNSMASQ_CONF = `# /etc/dnsmasq.d/sureflow-pxe.conf
# PXE/DHCP for the isolated boot VLAN only. The store's general network keeps
# its own DHCP server — this interface must never bridge to it.
interface=vmbr0.30
bind-interfaces
except-interface=lo

# Boot VLAN (30): terminals get an address only to boot.
dhcp-range=10.0.30.100,10.0.30.199,255.255.255.0,1h
dhcp-option=option:router,10.0.30.1
dhcp-option=option:dns-server,10.0.30.10

# TFTP root holding pxelinux + the kernels/initrds
enable-tftp
tftp-root=/srv/tftp
dhcp-boot=pxelinux.0

# Per-terminal reservations are appended by the Registers page PXE generator:
#   dhcp-host=<mac>,<register-id>,<ip>
`;

const NFS_EXPORTS = `# /etc/exports — read-only roots, per-terminal writable overlay
/srv/nfs/sureflow-legacy  10.0.30.0/24(ro,sync,no_subtree_check,no_root_squash)
/srv/nfs/sureflow-modern  10.0.30.0/24(ro,sync,no_subtree_check,no_root_squash)
/srv/nfs/overlay          10.0.30.0/24(rw,sync,no_subtree_check,no_root_squash)
`;

const BUILD_IMAGE_SH = `#!/bin/bash
# /usr/local/sbin/sureflow-build-image
# Builds a minimal Debian diskless root for the lane terminals.
# Usage: sureflow-build-image legacy|modern
set -e
VARIANT="\${1:?usage: sureflow-build-image legacy|modern}"
ROOT="/srv/nfs/sureflow-\$VARIANT"
SUITE="bookworm"

# Legacy (SurePOS 700 class) keeps the older i8042/no-KMS friendly package set.
if [ "\$VARIANT" = "legacy" ]; then
  EXTRA="xserver-xorg-video-fbdev"
else
  EXTRA="xserver-xorg-video-intel"
fi

debootstrap --arch=amd64 --variant=minbase "\$SUITE" "\$ROOT" http://deb.debian.org/debian

chroot "\$ROOT" /bin/bash -eux <<CHROOT
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y --no-install-recommends \\
    linux-image-amd64 nfs-common initramfs-tools systemd-sysv \\
    xserver-xorg xinit chromium udev usbutils cups-client \\
    ca-certificates curl iproute2 iputils-ping \$EXTRA
  # Xorg runs as the unprivileged 'sureflow' user via startx. Debian's Xwrapper
  # denies it the VT unless this file grants root rights — without it every start
  # dies with "xf86OpenConsole: Cannot open virtual console (Permission denied)"
  # and the lane falls back to the text login.
  printf 'allowed_users=anybody\\nneeds_root_rights=yes\\n' > /etc/X11/Xwrapper.config
  # Boot straight into the POS in kiosk mode against the store relay.
  useradd -m -s /bin/bash sureflow
  echo 'ALL: kiosk' > /etc/sureflow-role
  # NFS root needs the net drivers in the initramfs.
  echo 'MODULES=most' > /etc/initramfs-tools/conf.d/sureflow
  echo 'BOOT=nfs'    >> /etc/initramfs-tools/conf.d/sureflow
  update-initramfs -u -k all
CHROOT

# Publish kernel + initrd into the TFTP tree the boot entries point at.
install -d /srv/tftp/debian-\$VARIANT
cp "\$ROOT"/boot/vmlinuz-* /srv/tftp/debian-\$VARIANT/vmlinuz
cp "\$ROOT"/boot/initrd.img-* /srv/tftp/debian-\$VARIANT/initrd.img
echo "Built \$VARIANT image and published boot files."
`;

const KIOSK_SERVICE = `# \${ROOT}/etc/systemd/system/sureflow-kiosk.service
# Reads the sureflow.* kernel args the PXE entry passes in (register_id, store_id,
# relay URL) and opens the POS against this store's relay.
[Unit]
Description=SureFlow POS Kiosk
After=network-online.target
Wants=network-online.target

[Service]
User=sureflow
Environment=DISPLAY=:0
ExecStartPre=/usr/local/bin/sureflow-boot-env
ExecStart=/usr/bin/startx /usr/local/bin/sureflow-kiosk
Restart=always

[Install]
WantedBy=multi-user.target
`;

const BOOT_ENV_SH = `#!/bin/bash
# /usr/local/bin/sureflow-boot-env (inside the image)
# Turns the PXE APPEND args into an env file the kiosk reads.
set -e
OUT=/run/sureflow.env
: > "\$OUT"
for arg in \$(cat /proc/cmdline); do
  case "\$arg" in
    sureflow.*=*)
      key="\${arg%%=*}"; val="\${arg#*=}"
      echo "\${key#sureflow.}=\$val" | tr '[:lower:]' '[:upper:]' >> "\$OUT"
      ;;
  esac
done
cat "\$OUT"
`;

const KEEPALIVED_CONF = `# /etc/keepalived/keepalived.conf — controller A (MASTER)
# Both controllers share 10.0.30.10; terminals only ever know the virtual IP,
# so a failover is invisible to a booting lane.
vrrp_script chk_boot {
  script "/usr/bin/systemctl is-active dnsmasq && /usr/bin/systemctl is-active nfs-server"
  interval 2
  weight -20
}

vrrp_instance SUREFLOW_BOOT {
  state MASTER
  interface vmbr0.30
  virtual_router_id 30
  priority 150            # controller B uses 100 and state BACKUP
  advert_int 1
  authentication { auth_type PASS; auth_pass CHANGE_ME }
  virtual_ipaddress { 10.0.30.10/24 }
  track_script { chk_boot }
}
`;

const IBM_PERIPHERALS = `# /etc/X11/xorg.conf.d/10-ibm-surepoint.conf (inside the image)
# IBM SurePoint 4820 touch panel. Replace the matrix with the values
# xinput_calibrator prints for the panel revision in your fleet.
Section "InputClass"
    Identifier   "IBM SurePoint Touch"
    MatchProduct "SurePoint"
    MatchIsTouchscreen "on"
    Driver       "evdev"
    Option       "Calibration"       "108 3963 288 3846"
    Option       "SwapAxes"          "0"
    Option       "EmulateThirdButton" "1"
    Option       "EmulateThirdButtonTimeout" "750"
EndSection

# --- /etc/udev/rules.d/71-sureflow-ibm.rules ---
# Stable symlinks for the SurePOS 700 internal serial peripherals so the POS
# never has to guess a ttyS number.
SUBSYSTEM=="tty", KERNEL=="ttyS0", SYMLINK+="sureflow-linedisplay", MODE="0660", GROUP="dialout"
SUBSYSTEM=="tty", KERNEL=="ttyS1", SYMLINK+="sureflow-msr",         MODE="0660", GROUP="dialout"
# Touch panel: keep raw coords, let Xorg apply the calibration above.
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b3", ENV{SUREFLOW_TOUCH}="1"

# --- 2x20 line display init (9600 8N1) ---
# /usr/local/bin/sureflow-linedisplay-init
#   stty -F /dev/sureflow-linedisplay 9600 cs8 -cstopb -parenb raw
`;

export const PXE_CONTROLLER_STEPS = [
  {
    step_id: "pxe_network_design",
    label: "Design the controller network (VLAN plan)",
    instructions: [
      "Three VLANs per store, all trunked to the Proxmox host and terminated on the controller: VLAN 10 = general store/office traffic, VLAN 30 = PXE/diskless boot, VLAN 40 = backend (relay DB, sync, printing).",
      "The controller holds 10.0.30.10 on VLAN 30 and 10.0.40.10 on VLAN 40. Lane terminals get a boot address on VLAN 30 and their working address on VLAN 40.",
      "VLAN 30 must not route anywhere — no internet, no VLAN 10. A diskless terminal trusts whatever answers its DHCP boot request, so isolating that segment is the whole security model.",
      "VLAN 40 routes only to the relay and the receipt printers (port 9100). Register records carry pxe_vlan and backend_vlan so the generated configs match this plan.",
      "Switch ports for lanes: untagged/native VLAN 30 for the boot NIC, VLAN 40 tagged — or a second NIC per terminal if the hardware has one.",
    ],
    commands: [
      "# /etc/network/interfaces on the Proxmox host — VLAN-aware bridge\nauto vmbr0\niface vmbr0 inet manual\n    bridge-ports enp1s0\n    bridge-vlan-aware yes\n    bridge-vids 2-4094",
      "# Controller VLAN interfaces\nauto vmbr0.30\niface vmbr0.30 inet static\n    address 10.0.30.10/24\n\nauto vmbr0.40\niface vmbr0.40 inet static\n    address 10.0.40.10/24",
    ],
  },
  {
    step_id: "pxe_controller_vm",
    label: "Provision the controller VM on Proxmox",
    instructions: [
      "Create a Debian 12 (bookworm) VM: 2 vCPU, 4 GB RAM, 120 GB disk — the disk holds the NFS roots, so size it for two images plus per-terminal overlays.",
      "Attach two virtual NICs on vmbr0, tagged VLAN 30 and VLAN 40. Enable start-on-boot.",
      "Keep this VM separate from the store's Local Relay VM. The relay handles transactions and cloud sync; the controller only boots terminals. One can be rebuilt without touching the other.",
    ],
    commands: [
      "sudo apt update && sudo apt install -y dnsmasq nfs-kernel-server pxelinux syslinux-common debootstrap rsync",
      "sudo systemctl disable --now systemd-resolved   # frees port 53 for dnsmasq",
    ],
  },
  {
    step_id: "pxe_tftp_dhcp",
    label: "Serve PXE: dnsmasq DHCP + TFTP on the boot VLAN",
    instructions: [
      "dnsmasq provides DHCP, TFTP and the boot filename on VLAN 30 only — bound to vmbr0.30 so it can never answer the store's general network.",
      "Copy the pxelinux bootloader and its modules into the TFTP root, then drop in the config below.",
      "Per-terminal boot entries and DHCP reservations are generated on the Registers page: open a register, press PXE, and paste each block into the paths shown.",
    ],
    commands: [
      "sudo install -d /srv/tftp/pxelinux.cfg\nsudo cp /usr/lib/PXELINUX/pxelinux.0 /srv/tftp/\nsudo cp /usr/lib/syslinux/modules/bios/{ldlinux.c32,libcom32.c32,libutil.c32,menu.c32} /srv/tftp/",
      "sudo systemctl restart dnsmasq && sudo systemctl enable dnsmasq\njournalctl -u dnsmasq -n 30   # watch for DHCPDISCOVER from a booting lane",
    ],
    codeFiles: [{ name: "sureflow-pxe.conf", code: DNSMASQ_CONF }],
  },
  {
    step_id: "pxe_build_images",
    label: "Build the diskless Debian images (legacy + modern)",
    instructions: [
      "Two images cover the fleet: legacy for IBM SurePOS 700 class terminals (nomodeset, i8042 quirks, fbdev video) and modern for Elo EPS00E2 class hardware.",
      "Each is a minimal debootstrap root served read-only over NFS, so a terminal has no local state to corrupt — the 4690 resilience property.",
      "Run the builder once per variant. It also publishes each image's kernel and initrd into the TFTP tree at the paths the generated boot entries reference.",
      "Rebuild an image to patch the fleet; terminals pick up the change on their next reboot.",
    ],
    commands: [
      "sudo install -m 755 /dev/stdin /usr/local/sbin/sureflow-build-image  # paste the script below",
      "sudo sureflow-build-image legacy\nsudo sureflow-build-image modern",
      "sudo install -d /srv/nfs/overlay\nsudo systemctl restart nfs-server && sudo exportfs -ra\nsudo exportfs -v   # confirm both roots are exported",
    ],
    codeFiles: [
      { name: "sureflow-build-image", code: BUILD_IMAGE_SH },
      { name: "/etc/exports", code: NFS_EXPORTS },
    ],
  },
  {
    step_id: "pxe_terminal_identity",
    label: "Wire terminal identity and peripherals into the image",
    instructions: [
      "The PXE entry passes sureflow.register_id, sureflow.store_id, sureflow.printer_ip, sureflow.scanner_if and sureflow.relay on the kernel command line, so one shared image serves every lane — identity comes from the MAC-keyed boot file, not from local config.",
      "sureflow-boot-env converts those args into /run/sureflow.env, which the kiosk service reads to point the POS at this store's relay as the correct register.",
      "Peripheral rules (IBM 3AA01194300 hwdb scancodes, RS-232 / USB-OCIA scanner symlinks) are generated per register on the Registers page — install them into the image, then run systemd-hwdb update && udevadm trigger inside the chroot.",
    ],
    commands: [
      "sudo install -m 755 /dev/stdin /srv/nfs/sureflow-modern/usr/local/bin/sureflow-boot-env  # paste below, repeat for -legacy",
      "sudo chroot /srv/nfs/sureflow-modern systemctl enable sureflow-kiosk",
    ],
    codeFiles: [
      { name: "sureflow-boot-env", code: BOOT_ENV_SH },
      { name: "sureflow-kiosk.service", code: KIOSK_SERVICE },
    ],
  },
  {
    step_id: "pxe_ibm_peripherals",
    label: "Add IBM touchscreen, MSR and line display support",
    instructions: [
      "The displays stay IBM SurePoint (4820 class) on both terminal generations — the Elo EPS00E2 is only the compute unit, so no Elo touch driver is installed anywhere in the fleet.",
      "SurePoint panels attach as USB touch. Newer revisions come up on hid_multitouch; older resistive revisions need usbtouchscreen with hardware calibration disabled so the calibration matrix below applies instead.",
      "Calibrate once per panel model with xinput_calibrator, then bake the resulting matrix into the Xorg snippet in that model's driver-library profile — the read-only image means the terminal cannot save its own calibration.",
      "SurePOS 700 integrated peripherals hang off the internal serial ports: the MSR keyboard wedge needs i8042.nomux=1 and atkbd, and the 2x20 line display is a plain 9600-baud serial device reached through a stable /dev/sureflow-linedisplay symlink.",
      "Keep every module, boot arg and rule in the Hardware Driver Library rather than hand-editing the image — the builder reads those profiles so a rebuild never loses a quirk.",
    ],
    commands: [
      "sudo chroot /srv/nfs/sureflow-modern apt-get install -y --no-install-recommends xserver-xorg-input-evdev xinput-calibrator xinput inputattach",
      "# One-time calibration on a lane, then copy the matrix into the driver profile\nDISPLAY=:0 xinput_calibrator --output-type xorg.conf.d",
      "sudo chroot /srv/nfs/sureflow-legacy /bin/bash -c 'echo -e \"usbtouchscreen\\natkbd\\n8250\" > /etc/modules-load.d/sureflow-ibm.conf'",
      "sudo sureflow-build-image legacy && sudo sureflow-build-image modern   # rebuild so the profiles land in the image",
    ],
    codeFiles: [{ name: "10-ibm-surepoint.conf", code: IBM_PERIPHERALS }],
  },
  {
    step_id: "pxe_ha_failover",
    label: "Add controller high availability (failover pair)",
    instructions: [
      "A single controller is a store-wide outage on the next terminal reboot. Run two and share the boot address 10.0.30.10 with keepalived so terminals never learn which one answered.",
      "Controller A is MASTER (priority 150), controller B is BACKUP (priority 100). The health script demotes A if dnsmasq or nfs-server stops.",
      "Replicate the boot payload from A to B on a schedule — the images are large but change only when you rebuild them.",
      "Test failover deliberately: stop dnsmasq on A, confirm the virtual IP moves, then PXE-boot a lane before you rely on it.",
    ],
    commands: [
      "sudo apt install -y keepalived && sudo systemctl enable --now keepalived",
      "# On controller A: push the boot payload to B (cron nightly)\nrsync -aHAX --delete /srv/nfs/ 10.0.40.11:/srv/nfs/\nrsync -aHAX --delete /srv/tftp/ 10.0.40.11:/srv/tftp/",
      "ip -br addr show vmbr0.30   # the virtual IP appears on whichever node is MASTER",
    ],
    codeFiles: [{ name: "keepalived.conf", code: KEEPALIVED_CONF }],
  },
  {
    step_id: "pxe_kiosk_vt_permission",
    label: "Troubleshooting — Lane boots to the Linux text login instead of the POS",
    instructions: [
      "SYMPTOM: the lane finishes booting and shows a console login prompt. systemctl status sureflow-kiosk reports 'active (running)' but the timestamp is always a second or two old — the unit is crash-looping under Restart=always, and each death drops the screen back to getty on tty1.",
      "CONFIRM IT: read the Xorg log on the lane with sudo tail -40 /tmp/Xorg.0.log. The fatal line is 'xf86OpenConsole: Cannot open virtual console 7 (Permission denied)'.",
      "CAUSE: the kiosk unit runs Xorg as the unprivileged 'sureflow' user through startx. On Debian the Xorg binary is wrapped by /usr/lib/Xorg.wrap, which refuses to hand a non-root user a virtual console unless /etc/X11/Xwrapper.config allows it. The default image ships no such file, so X can never take vt7 no matter how many times systemd restarts it.",
      "FIX: write Xwrapper.config into both NFS roots on the controller, then reboot the lane. The image builder now creates this file, so a rebuild keeps the fix.",
      "The read-only NFS root means this cannot be fixed from the lane itself — always edit the image on the controller.",
      "While you are in the chroot, note that the base image also had no iproute2 or iputils-ping, which is why 'ip route' and 'ping' returned 'No such file or directory' on the lane. Both are now in the builder's package list so lanes are diagnosable.",
    ],
    commands: [
      "# On the LANE — confirm the cause first",
      "systemctl status sureflow-kiosk --no-pager   # 'active' but restarting constantly",
      "sudo tail -40 /tmp/Xorg.0.log               # look for 'Cannot open virtual console'",
      "# On the CONTROLLER — grant Xorg the VT in both images",
      "for V in legacy modern; do sudo tee /srv/nfs/sureflow-$V/etc/X11/Xwrapper.config > /dev/null <<'EOF'\nallowed_users=anybody\nneeds_root_rights=yes\nEOF\ndone",
      "# Add the missing network diagnostic tools to the existing images",
      "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V apt-get install -y --no-install-recommends iproute2 iputils-ping; done",
      "grep -r . /srv/nfs/sureflow-legacy/etc/X11/Xwrapper.config   # verify before rebooting",
    ],
    postInstructions: [
      "Reboot the lane. It should go straight from the boot messages into the POS with no console login in between.",
      "Still landing at the text login? Re-read /tmp/Xorg.0.log — with the VT permission fixed the next failure is usually '(EE) no screens found', which on SurePOS 700 video means the legacy image needs the fbdev driver and nomodeset (both already in the legacy boot entry — confirm with cat /proc/cmdline).",
      "If X starts but the screen stays black, the kiosk browser is the problem rather than Xorg: check that /run/sureflow.env holds the RELAY value and curl the relay's /kiosk URL from the lane.",
    ],
  },
  {
    step_id: "pxe_validate",
    label: "Validate a lane end to end",
    instructions: [
      "Confirm the register's hardware profile is complete first — the Registers page audit panel flags any terminal missing its MAC, models, printer IP or VLANs.",
      "Set the lane's BIOS to network boot first, then power it on and watch the controller: DHCP offer, TFTP fetch of pxelinux plus the kernel, then the NFS root mount.",
      "At the POS prompt, verify it came up as the right register and store, scan an item to prove the scanner mapping, and print a test receipt to prove the printer IP and drawer kick.",
      "Then pull the terminal's power mid-sale. It should boot straight back into the same lane with nothing to repair — that is the acceptance test for the diskless design.",
    ],
    commands: [
      "journalctl -u dnsmasq -f            # DHCP + TFTP activity while the lane boots",
      "sudo tail -f /var/log/syslog | grep -i nfsd   # root mount from the terminal",
      "cat /run/sureflow.env               # on the booted terminal: identity it received",
    ],
  },
];

export const DEFAULT_PXE_STEPS = PXE_CONTROLLER_STEPS.map((s) => ({ step_id: s.step_id, label: s.label }));