// sureflow-build-lane-image — builds a FULLY BOOTABLE diskless lane root on the
// controller itself, so a freshly installed box can PXE boot a lane end to end with no
// manual image editing afterwards.
//
// Three layers, in order, and each one matters:
//   1. BASE      debootstrap minimal Debian + the kiosk package set, initramfs for NFS root.
//   2. FLEET     sureflow-kiosk, sureflow-boot-env, the serial + printer bridges and the
//                lane agent. Without this layer a lane boots Debian but never opens the
//                POS, cannot print over USB, and shows as "never seen" in the Lanes table.
//   3. PROFILES  HardwareLibrary profiles pulled from the cloud with the store's relay API
//                key, so this store's actual terminal families get their scancode maps and
//                touch calibration baked in. Optional by necessity: a box with no key or no
//                cloud route still produces a BOOTABLE image, and re-running layers the
//                profiles in later.
//
// Paths are the combined installer's /srv/sureflow layout throughout — roots under
// /srv/sureflow/roots/sureflow-<variant>, TFTP under /srv/sureflow/tftp. The older
// /srv/nfs + /srv/tftp scheme is gone so only one layout lives on disk.
//
// NOT built here: per-lane pxelinux.cfg entries. Those are keyed to a MAC the controller
// cannot know at build time and stay generated per register on the Registers page.

import { SUREFLOW_KIOSK_SH, BOOT_ENV_SH, KIOSK_SERVICE } from "@/lib/pxeControllerSetup";
import {
  BRIDGE_UDEV_RULES,
  BRIDGE_SER2NET_CONFIG,
  BRIDGE_SYSTEMD_UNIT,
} from "@/lib/laneSerialBridge";
import {
  PRINTER_BRIDGE_UDEV_RULES,
  PRINTER_BRIDGE_SYSTEMD_UNIT,
} from "@/lib/lanePrinterBridge";
import { VSD_CONFIG_XML, VSP_DEB_PATH } from "@/lib/toshibaVsp";
import { LANE_PROFILE_SCRIPT, LANE_PROFILE_UNIT } from "@/lib/laneProfilePersist";
import {
  PLYMOUTH_THEME,
  PLYMOUTH_SCRIPT,
  BEEP_SCRIPT,
  BEEP_OK_UNIT,
  BEEP_FAIL_UNIT,
} from "@/lib/pxeBootSplash";

export const LANE_ROOTS_DIR = "/srv/sureflow/roots";
export const LANE_TFTP_DIR = "/srv/sureflow/tftp";

// Kernel/initrd only ever come from a built root, so the NFS exports are written by the
// builder rather than the wizard — the wizard has nothing to export yet.
const NFS_EXPORTS = `# /etc/exports — written by sureflow-build-lane-image
# Read-only lane roots plus one writable overlay, exported to the PXE VLAN only.
# A diskless lane has no local state, which is the whole resilience property: pulling
# its power mid-sale costs the sale and nothing else.
`;

export const LANE_IMAGE_BUILD_SCRIPT = `#!/bin/bash
# /usr/local/sbin/sureflow-build-lane-image
# Builds a bootable diskless lane root: base + fleet layer + cloud hardware profiles.
# Usage: sureflow-build-lane-image legacy|modern|both
# Safe to re-run — that is how the fleet is patched. Lanes pick the new root up on their
# next reboot (nightly maintenance window, or Lanes > Reboot from the console menu).
set -uo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin

[ "\$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }

WHICH="\${1:-}"
case "\$WHICH" in
  legacy|modern|both) ;;
  *) echo "usage: sureflow-build-lane-image legacy|modern|both"; exit 1 ;;
esac

CONF=/etc/sureflow/controller.conf
[ -r "\$CONF" ] || { echo "No \$CONF — run sureflow-controller-install first."; exit 1; }
# shellcheck disable=SC1090
. "\$CONF"

ROOTS=${LANE_ROOTS_DIR}
TFTP=${LANE_TFTP_DIR}
AGENT_SRC=/srv/sureflow/lane-agent
SUITE=bookworm
# The FULL relaySync endpoint, used verbatim. Appending a path here returned 405.
CLOUD_SYNC_URL="\${CLOUD_SYNC_URL:-https://sure-flow-pos.base44.app/functions/relaySync}"
PXE_SUBNET="\${PXE_SUBNET:-10.0.40.0/24}"
SUMMARY=/srv/sureflow/.lane-image-summary
# Normalized splash PNGs staged once per controller by sureflow-fetch-splash-assets.sh.
SPLASH_DIR=/srv/sureflow/splash
SPLASH_STATUS="not attempted"
# Technician credential baked into the lane image. Override per store by adding
# LANE_PASSWORD=... to /etc/sureflow/controller.conf before building.
LANE_PASSWORD="\${LANE_PASSWORD:-sureflow}"
WARNINGS=""
KEYBOARDS_BAKED=""

log() { echo "[\$(date +%H:%M:%S)] \$*"; }
warn() { WARNINGS="\$WARNINGS
  ! \$*"; log "WARNING: \$*"; }

# debootstrap mounts /proc, /sys and /dev for its own second stage and unmounts them when
# it finishes, so every LATER chroot ran without them. That is what produced the harmless
# but alarming "Is /dev/pts mounted?" and "/proc/ is not mounted" postinst noise — and it
# also meant systemd-tmpfiles silently skipped creating device and /run entries in the
# image. Mount them for the whole chroot phase instead.
MOUNTED_ROOT=""
chroot_mount() { # chroot_mount <root>
  local root="\$1"
  mount -t proc     proc     "\$root/proc"    2>/dev/null || true
  mount -t sysfs    sysfs    "\$root/sys"     2>/dev/null || true
  mount -o bind     /dev     "\$root/dev"     2>/dev/null || true
  mount -t devpts   devpts   "\$root/dev/pts" 2>/dev/null || true
  MOUNTED_ROOT="\$root"
}
chroot_umount() { # always lazy — a leftover bind mount under a root we later rm -rf
  local root="\${1:-\$MOUNTED_ROOT}"
  [ -n "\$root" ] || return 0
  umount -l "\$root/dev/pts" 2>/dev/null || true
  umount -l "\$root/dev"     2>/dev/null || true
  umount -l "\$root/sys"     2>/dev/null || true
  umount -l "\$root/proc"    2>/dev/null || true
  MOUNTED_ROOT=""
}
# An interrupted build must never leave /dev bind-mounted inside a root that the next
# pass deletes — that would take the controller's own /dev with it.
trap 'chroot_umount' EXIT INT TERM

# A missing tool used to be installed with every error suppressed, so a failed install
# surfaced 20 minutes later as "debootstrap: command not found" with no explanation.
# Now apt is refreshed first and a failure is reported with apt's own last words.
APT_REFRESHED=0
need() { # need <command> <package>
  command -v "\$1" >/dev/null 2>&1 && return 0
  if [ "\$APT_REFRESHED" = "0" ]; then
    log "Refreshing the package lists"
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null 2>&1 || \\
      warn "apt-get update failed — installing build tools may fail too."
    APT_REFRESHED=1
  fi
  log "Installing missing build tool: \$1 (\$2)"
  local out
  out=\$(DEBIAN_FRONTEND=noninteractive apt-get install -y "\$2" 2>&1)
  if command -v "\$1" >/dev/null 2>&1; then return 0; fi
  warn "Could not install \$2 — \$1 is still missing. apt said: \$(echo "\$out" | tail -3 | tr '\\n' ' ')"
  return 1
}
# debootstrap is not optional: with no debootstrap there is no image at all, so stop here
# rather than burning time and failing confusingly further in.
if ! need debootstrap debootstrap; then
  echo "FATAL: debootstrap is required to build a lane root and could not be installed." >&2
  exit 1
fi
need jq jq || true
need curl curl || true

# ---------------------------------------------------------------------------
# LAYER 3 helper — pull this store's HardwareLibrary profiles from the cloud.
# Writes nothing and returns non-zero when it cannot get them, so the caller can
# carry on with a base+fleet image rather than aborting a 25-minute build.
# ---------------------------------------------------------------------------
fetch_profiles() { # fetch_profiles <variant> <outfile>
  local variant="\$1" out="\$2" body
  if [ -z "\${RELAY_KEY:-}" ]; then
    warn "No relay API key in \$CONF — hardware profiles were SKIPPED for \$variant."
    return 1
  fi
  body=\$(curl -s --max-time 25 -X POST "\$CLOUD_SYNC_URL" \\
    -H 'Content-Type: application/json' \\
    -d "{\\"store_id\\":\\"\$STORE_ID\\",\\"api_key\\":\\"\$RELAY_KEY\\",\\"action\\":\\"hardware_profiles\\",\\"variant\\":\\"\$variant\\"}" 2>/dev/null)
  if [ -z "\$body" ] || ! echo "\$body" | jq -e '.profiles' >/dev/null 2>&1; then
    warn "Cloud unreachable or refused the key — hardware profiles were SKIPPED for \$variant. Re-run this build once the backend VLAN has a route."
    return 1
  fi
  echo "\$body" > "\$out"
  return 0
}

# ---------------------------------------------------------------------------
# LAYER 3 helper — bake this store's saved keyboard maps in as hwdb.
# A diskless root is read-only, so a scancode map that is not baked at build time can
# never be applied on the lane. Optional like the profiles above: no key or no route
# still yields a bootable image, it just keeps the stock USB-HID mapping.
# ---------------------------------------------------------------------------
apply_keyboards() { # apply_keyboards <root> <variant>
  local root="\$1" variant="\$2" body count i model slug hwdb keys
  [ -n "\${RELAY_KEY:-}" ] || { warn "No relay API key in \$CONF — keyboard maps were SKIPPED for \$variant."; return 0; }

  body=\$(curl -s --max-time 25 -X POST "\$CLOUD_SYNC_URL" \\
    -H 'Content-Type: application/json' \\
    -d "{\\"store_id\\":\\"\$STORE_ID\\",\\"api_key\\":\\"\$RELAY_KEY\\",\\"action\\":\\"keyboard_layouts\\",\\"variant\\":\\"\$variant\\"}" 2>/dev/null)
  if [ -z "\$body" ] || ! echo "\$body" | jq -e '.layouts' >/dev/null 2>&1; then
    warn "Could not fetch keyboard maps for \$variant — the lanes will use stock USB-HID mapping. Re-run once the backend VLAN has a route."
    return 0
  fi

  count=\$(echo "\$body" | jq -r '.layouts | length')
  if [ "\$count" = "0" ]; then
    warn "No saved keyboard map matched this store's \$variant registers. Check keyboard_model on the Registers page and save a layout in the Key Mapper."
    return 0
  fi

  install -d -m 755 "\$root/etc/udev/hwdb.d"
  i=0
  while [ "\$i" -lt "\$count" ]; do
    model=\$(echo "\$body" | jq -r ".layouts[\$i].keyboard_model")
    slug=\$(echo "\$body" | jq -r ".layouts[\$i].file_slug")
    keys=\$(echo "\$body" | jq -r ".layouts[\$i].mapped_keys")
    hwdb=\$(echo "\$body" | jq -r ".layouts[\$i].hwdb")
    printf '%s\\n' "\$hwdb" > "\$root/etc/udev/hwdb.d/70-sureflow-pos-keyboard-\$slug.hwdb"
    log "  keyboard map baked: \$model (\$keys key(s))"
    [ "\$keys" = "0" ] && warn "The saved map for \$model has no captured scancodes — its keys will not be remapped. Calibrate it in the Key Mapper."
    i=\$((i + 1))
  done
  # An hwdb file does nothing until the binary database is rebuilt inside the root.
  chroot "\$root" systemd-hwdb update >/dev/null 2>&1 || \\
    warn "systemd-hwdb update failed inside the \$variant root — the baked keyboard map will not load."
  KEYBOARDS_BAKED="\$KEYBOARDS_BAKED \$variant:\$count"
  return 0
}

apply_profiles() { # apply_profiles <root> <variant> <profilefile>
  local root="\$1" variant="\$2" pf="\$3" count pkgs mods rules xorg bargs
  count=\$(jq -r '.profiles | length' "\$pf" 2>/dev/null || echo 0)
  if [ "\$count" = "0" ]; then
    warn "The cloud returned no hardware profiles for \$variant. Check that this store's registers have their models filled in on the Registers page."
    return 0
  fi
  log "Applying \$count hardware profile(s) to the \$variant image"

  # Extra Debian packages a device needs (touch calibration, input drivers).
  pkgs=\$(jq -r '[.profiles[].packages // [] | .[]] | unique | join(" ")' "\$pf")
  if [ -n "\$pkgs" ]; then
    log "  packages: \$pkgs"
    chroot "\$root" apt-get install -y --no-install-recommends \$pkgs >/dev/null 2>&1 \\
      || warn "Some profile packages failed to install into the \$variant image: \$pkgs"
  fi

  # Kernel modules the device needs loaded (usbtouchscreen, atkbd, 8250...).
  mods=\$(jq -r '[.profiles[].kernel_modules // [] | .[]] | unique | .[]' "\$pf")
  if [ -n "\$mods" ]; then
    printf '%s\\n' "\$mods" > "\$root/etc/modules-load.d/sureflow-profiles.conf"
    log "  kernel modules: \$(echo \$mods | tr '\\n' ' ')"
  fi

  # udev / hwdb rules — scancode maps and stable device symlinks.
  rules=\$(jq -r '[.profiles[] | select((.udev_rules // "") != "") | "# " + .model + "\\n" + .udev_rules] | join("\\n\\n")' "\$pf")
  if [ -n "\$rules" ]; then
    printf '%s\\n' "\$rules" > "\$root/etc/udev/rules.d/70-sureflow-profiles.rules"
    # hwdb entries only take effect once the binary database is rebuilt.
    chroot "\$root" systemd-hwdb update >/dev/null 2>&1 || true
    log "  udev/hwdb rules written"
  fi

  # Xorg input snippets — the touch calibration matrix a read-only lane cannot save itself.
  xorg=\$(jq -r '[.profiles[] | select((.xorg_config // "") != "") | "# " + .model + "\\n" + .xorg_config] | join("\\n\\n")' "\$pf")
  if [ -n "\$xorg" ]; then
    mkdir -p "\$root/etc/X11/xorg.conf.d"
    printf '%s\\n' "\$xorg" > "\$root/etc/X11/xorg.conf.d/20-sureflow-profiles.conf"
    log "  Xorg input config written"
  fi

  # Boot args cannot be baked into a root — they belong on the kernel command line, which
  # the Registers page emits per lane. Publish them next to the kernel so the generator
  # and the technician read the same values.
  bargs=\$(jq -r '[.profiles[].boot_args // "" | select(. != "")] | unique | join(" ")' "\$pf")
  if [ -n "\$bargs" ]; then
    echo "\$bargs" > "\$TFTP/debian-\$variant/boot-args"
    log "  boot args published: \$bargs"
    warn "The \$variant image needs these kernel args: \$bargs — confirm the PXE entries generated on the Registers page carry them."
  fi
}

# ---------------------------------------------------------------------------
# LAYER 2 helper — the fleet layer. This is what turns a Debian root into a LANE.
# ---------------------------------------------------------------------------
apply_fleet_layer() { # apply_fleet_layer <root>
  local root="\$1"

  install -d -m 755 "\$root/usr/local/bin" "\$root/etc/systemd/system" "\$root/etc/udev/rules.d"

  # The kiosk launcher and its identity shim. Between them a lane reads its register_id,
  # store and relay address off the kernel command line and opens the POS — which is why
  # one shared image serves every lane with no per-lane config inside it.
  cat >"\$root/usr/local/bin/sureflow-kiosk" <<'SFKIOSK'
${SUREFLOW_KIOSK_SH}
SFKIOSK
  chmod 755 "\$root/usr/local/bin/sureflow-kiosk"

  cat >"\$root/usr/local/bin/sureflow-boot-env" <<'SFBOOTENV'
${BOOT_ENV_SH}
SFBOOTENV
  chmod 755 "\$root/usr/local/bin/sureflow-boot-env"

  cat >"\$root/etc/systemd/system/sureflow-kiosk.service" <<'SFKIOSKUNIT'
${KIOSK_SERVICE}
SFKIOSKUNIT

  # WRITABLE PATHS. This is the fix for "lane stops at the Linux login prompt": the
  # NFS root is exported READ-ONLY and nothing was mounted writable over it, so
  # startx could not create ~/.Xauthority, called Xorg with an EMPTY -auth argument,
  # and Xorg answered with its usage text and exited — a crash loop that looks like
  # X never trying. The same read-only root broke systemd-logind (no /var/lib state
  # dir), the journal, utmp and /tmp/.X11-unix.
  #
  # A diskless lane keeps no state by design, so every writable path is a tmpfs and
  # is deliberately discarded at power-off. /home/sureflow is mode 0777 rather than
  # uid-owned so it does not depend on the sureflow account landing on uid 1000.
  cat >"\$root/etc/fstab" <<'SFFSTAB'
# /etc/fstab — diskless lane. The root arrives read-only over NFS from the
# controller; these tmpfs mounts are the only writable storage on the lane and are
# intentionally lost on reboot.
tmpfs  /tmp               tmpfs  rw,nosuid,nodev,mode=1777,size=512M  0 0
tmpfs  /var/tmp           tmpfs  rw,nosuid,nodev,mode=1777,size=64M   0 0
tmpfs  /var/log           tmpfs  rw,nosuid,nodev,mode=0755,size=64M   0 0
tmpfs  /var/lib/systemd   tmpfs  rw,nosuid,nodev,mode=0755,size=16M   0 0
# Xorg's auth file and Chromium's whole profile live here — X cannot start without it.
tmpfs  /home/sureflow     tmpfs  rw,nosuid,nodev,mode=0777,size=512M  0 0
SFFSTAB

  # Xorg runs as the unprivileged 'sureflow' user through startx. Without BOTH the
  # setuid wrapper (xserver-xorg-legacy, in the package set) and this config, X can
  # never take vt7 and the lane crash-loops to a text login.
  install -d -m 755 "\$root/etc/X11"
  printf 'allowed_users=anybody\\nneeds_root_rights=yes\\n' > "\$root/etc/X11/Xwrapper.config"

  # Persistent browser profile. The POS sits behind the platform login and the home
  # directory is tmpfs, so without this a lane lost its session at every power-off and came
  # back to the login screen instead of the POS. Only Chromium's profile is persisted.
  cat >"\$root/usr/local/bin/sureflow-lane-profile" <<'SFPROFILE'
${LANE_PROFILE_SCRIPT}
SFPROFILE
  chmod 755 "\$root/usr/local/bin/sureflow-lane-profile"
  cat >"\$root/etc/systemd/system/sureflow-lane-profile.service" <<'SFPROFILEUNIT'
${LANE_PROFILE_UNIT}
SFPROFILEUNIT

  # DNS. debootstrap copies the BUILD HOST's /etc/resolv.conf into the root, so every lane
  # shipped with the controller's own backend-VLAN resolvers baked in — addresses a lane on
  # the isolated VLAN 40 cannot reach at all. Every lookup then failed and the kiosk showed
  # "This site can't be reached" even with egress working perfectly. The root is read-only,
  # so the DHCP dns-server offer cannot rewrite this file either; it must be baked. The
  # controller is the lane's gateway AND its scoped resolver, so that is the only entry.
  printf 'nameserver %s\\n' "\${PXE_VIP:-\${PXE_IP:-10.0.40.10}}" > "\$root/etc/resolv.conf"

  # Serial bridge — publishes a USB pinpad / pole display as TCP on the lane's own IP so
  # the relay's existing socket write reaches a peripheral that has no LAN address.
  cat >"\$root/etc/udev/rules.d/60-sureflow-serial.rules" <<'SFSERIALRULES'
${BRIDGE_UDEV_RULES}
SFSERIALRULES
  cat >"\$root/etc/ser2net.yaml" <<'SFSER2NET'
${BRIDGE_SER2NET_CONFIG}
SFSER2NET
  cat >"\$root/etc/systemd/system/sureflow-serial-bridge.service" <<'SFSERIALUNIT'
${BRIDGE_SYSTEMD_UNIT}
SFSERIALUNIT

  # Printer bridge — same idea for a USB receipt printer, on the port the relay already
  # prints to, so no relay configuration changes for a single-cable lane.
  cat >"\$root/etc/udev/rules.d/61-sureflow-printer.rules" <<'SFPRINTRULES'
${PRINTER_BRIDGE_UDEV_RULES}
SFPRINTRULES
  cat >"\$root/etc/systemd/system/sureflow-printer-bridge.service" <<'SFPRINTUNIT'
${PRINTER_BRIDGE_SYSTEMD_UNIT}
SFPRINTUNIT

  # usblp gives the UB-U06 a character device. Minimal roots blacklist it in favour of
  # CUPS' libusb backend, so force it back on or the printer bridge restarts forever.
  echo usblp > "\$root/etc/modules-load.d/sureflow-usblp.conf"
  rm -f "\$root"/etc/modprobe.d/*usblp*blacklist* 2>/dev/null

  # SureFlow boot splash. The theme FILES are always baked in, but the theme is only
  # SELECTED once the three PNG assets are present — Plymouth places sprites from each
  # image's own dimensions, so a theme with missing assets draws a bare status line on
  # a flat field, which looks worse than the stock spinner. Assets are staged once per
  # controller (sureflow-fetch-splash-assets.sh), same pattern as the vendor drop.
  install -d -m 755 "\$root/usr/share/plymouth/themes/sureflow"
  cat >"\$root/usr/share/plymouth/themes/sureflow/sureflow.plymouth" <<'SFPLYTHEME'
${PLYMOUTH_THEME}
SFPLYTHEME
  cat >"\$root/usr/share/plymouth/themes/sureflow/sureflow.script" <<'SFPLYSCRIPT'
${PLYMOUTH_SCRIPT}
SFPLYSCRIPT
  if [ -f "\$SPLASH_DIR/background.png" ] && [ -f "\$SPLASH_DIR/logo.png" ] && [ -f "\$SPLASH_DIR/dot.png" ]; then
    install -m 644 "\$SPLASH_DIR/background.png" "\$SPLASH_DIR/logo.png" "\$SPLASH_DIR/dot.png" \\
      "\$root/usr/share/plymouth/themes/sureflow/"
    # -R rebuilds the initramfs so the splash is present from the first second. The
    # initramfs is rebuilt again in step 5 for NFS root, which keeps the theme.
    if chroot "\$root" plymouth-set-default-theme -R sureflow >/dev/null 2>&1; then
      SPLASH_STATUS="SureFlow splash applied"
      log "  SureFlow boot splash applied (wave artwork, wordmark, cyclone spinner)"
    else
      SPLASH_STATUS="spinner fallback (theme selection failed)"
      warn "plymouth-set-default-theme could not select the sureflow theme — the lanes will boot the generic spinner."
      chroot "\$root" plymouth-set-default-theme -R spinner >/dev/null 2>&1 || true
    fi
  else
    SPLASH_STATUS="spinner fallback (assets missing)"
    warn "No splash assets at \$SPLASH_DIR — the lanes will boot the generic Debian spinner instead of the SureFlow splash. Run sureflow-fetch-splash-assets.sh on this controller, then rebuild."
  fi

  # PC speaker feedback. The 'beep' package and the pcspkr module were already
  # installed, but the helper and its units were never baked in — an installed
  # beeper with nothing to sound it. Both units go in now: a rising two-tone when
  # the kiosk comes up, a falling tone when it gives up (wired by OnFailure= on
  # the kiosk unit), so a dead lane is audible from the floor.
  cat >"\$root/usr/local/bin/sureflow-beep" <<'SFBEEP'
${BEEP_SCRIPT}
SFBEEP
  chmod 755 "\$root/usr/local/bin/sureflow-beep"
  cat >"\$root/etc/systemd/system/sureflow-beep-ok.service" <<'SFBEEPOK'
${BEEP_OK_UNIT}
SFBEEPOK
  cat >"\$root/etc/systemd/system/sureflow-beep-fail.service" <<'SFBEEPFAIL'
${BEEP_FAIL_UNIT}
SFBEEPFAIL

  # Toshiba VSP driver — the transport for the Toshiba TCx 2x20 USB pole (0f66:4524).
  # PROVEN WORKING on a live lane: the baked VSDConfig.xml assigns that pole a Line
  # Display port of /dev/ttyS20, vsd owns a real pty there and translates IBM/ADX
  # frames into the pole's HID reports, and the lane's serial bridge publishes it on
  # port 9101. Baking the assignment is what removes the per-lane GUI step (the config
  # tool needs GTK and a display, so it cannot be driven over plain SSH). On a lane
  # with no Toshiba pole vsd runs idle and harmless.
  if [ -f "${VSP_DEB_PATH}" ]; then
    install -D -m 644 "${VSP_DEB_PATH}" "\$root/tmp/toshiba-vsp-linux.deb"
    cat >"\$root/tmp/VSDConfig.xml" <<'SFVSDXML'
${VSD_CONFIG_XML}
SFVSDXML
    chroot "\$root" /bin/bash -s <<'VSPEOF' >/dev/null 2>&1
set -uo pipefail
export DEBIAN_FRONTEND=noninteractive
# DKMS off: the packaged modules target integrated Toshiba PCI peripherals that
# generic lanes do not have, and the USB pole needs no kernel module at all.
echo 'DKMS_DISABLED=1' > /etc/default/tgcs-vsp
# --force-depends skips libgtk-3-0, which only the GUI configurator needs — we
# ship a hand-written VSDConfig.xml instead (sanctioned by the vendor guide).
dpkg --force-depends -i /tmp/toshiba-vsp-linux.deb || true
dpkg --configure --force-depends -a || true
install -D -m 644 /tmp/VSDConfig.xml /opt/tgcs/vsp/VSDConfig.xml
systemctl enable vsd || true
rm -f /tmp/toshiba-vsp-linux.deb /tmp/VSDConfig.xml
VSPEOF
    if [ -x "\$root/opt/tgcs/vsp/bin/vsd" ]; then
      log "  Toshiba VSP driver baked in (idle — does NOT drive the TCx 2x20 USB pole)"
    else
      log "  Toshiba VSP driver did not install cleanly — no effect on supported hardware"
    fi
  fi

  # The lane agent. Lanes sit on the isolated PXE VLAN and cannot be reached inbound, so
  # the agent's outbound poll is the ONLY proof a lane is alive and the only way a remote
  # reboot ever arrives. A root without it reads as "never seen" and cannot be rebooted.
  if [ -f "\$AGENT_SRC/sureflow-lane-agent" ]; then
    install -m 755 "\$AGENT_SRC/sureflow-lane-agent" "\$root/usr/local/bin/sureflow-lane-agent"
    install -m 644 "\$AGENT_SRC/sureflow-lane-agent.service" "\$root/etc/systemd/system/sureflow-lane-agent.service"
    chroot "\$root" systemctl enable sureflow-lane-agent >/dev/null 2>&1 || true
  else
    warn "Lane agent not found at \$AGENT_SRC — this image's lanes will show as 'never seen' and cannot be rebooted remotely. Re-run ./install from the controller tarball, then rebuild."
  fi

  chroot "\$root" systemctl enable sureflow-kiosk sureflow-lane-profile sureflow-serial-bridge sureflow-printer-bridge sureflow-beep-ok >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
# LAYER 1 + orchestration
# ---------------------------------------------------------------------------
build_variant() {
  local variant="\$1" root extra pf
  root="\$ROOTS/sureflow-\$variant"

  # Legacy = IBM SurePOS 700 class (fbdev, no KMS). Modern = Elo EPS00E2 class.
  if [ "\$variant" = "legacy" ]; then extra="xserver-xorg-video-fbdev"; else extra="xserver-xorg-video-intel"; fi

  log "=== Building the \$variant lane image at \$root ==="
  if [ -d "\$root" ]; then
    log "Existing root found — removing it so this is a clean, reproducible build."
    # A previous interrupted build may still have /dev bind-mounted in here. Deleting the
    # root before unmounting would delete the controller's own /dev through the bind.
    chroot_umount "\$root"
    rm -rf "\$root"
  fi
  install -d -m 755 "\$root" "\$TFTP/debian-\$variant"

  log "[1/5] debootstrap \$SUITE (this is the slow part — 15 to 30 minutes)"
  if ! debootstrap --arch=amd64 --variant=minbase "\$SUITE" "\$root" http://deb.debian.org/debian; then
    warn "debootstrap FAILED for \$variant — no image was produced. Check this box's internet route on the BACKEND VLAN."
    return 1
  fi

  log "[2/5] Installing the kiosk package set"
  chroot_mount "\$root"
  chroot "\$root" /bin/bash -s <<CHROOTEOF
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \\
  linux-image-amd64 nfs-common initramfs-tools systemd-sysv \\
  xserver-xorg xserver-xorg-legacy xinit xauth openbox chromium udev usbutils cups-client \\
  dbus dbus-x11 fontconfig fonts-dejavu-core \\
  ca-certificates curl iproute2 iputils-ping sudo openssh-server \\
  evtest kbd ser2net setserial socat netcat-openbsd nodejs \\
  plymouth plymouth-themes beep \$extra >/dev/null
# Plymouth needs a theme SELECTED, not just installed. Without this the kernel's
# 'splash' arg hands the screen to Plymouth, which has no theme to draw and shows a
# flat grey field for the whole boot. This is only the FALLBACK — the branded
# SureFlow theme is selected in the fleet layer once its files and assets are in
# place, because plymouth-set-default-theme fails on an incomplete theme dir.
plymouth-set-default-theme -R spinner >/dev/null 2>&1 || true
# Motherboard beeper for pre-POS boot feedback; minbase roots blacklist pcspkr.
echo pcspkr > /etc/modules-load.d/sureflow-pcspkr.conf
rm -f /etc/modprobe.d/*pcspkr*blacklist* 2>/dev/null || true
# The kiosk user. Technicians log in as this account, so it needs sudo and the journal
# groups — without them a lane cannot be diagnosed at all.
id -u sureflow >/dev/null 2>&1 || useradd -m -s /bin/bash sureflow
usermod -aG sudo,adm,systemd-journal,dialout,video,tty sureflow
# useradd leaves the account PASSWORD-LOCKED, which locked a lane out of both SSH and
# its own console — a lane that cannot be logged into cannot be diagnosed at all.
# Set it here so every lane in the fleet has the same technician credential.
echo "sureflow:\${LANE_PASSWORD}" | chpasswd
systemctl enable ssh >/dev/null 2>&1 || true
echo 'sureflow ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/sureflow
chmod 440 /etc/sudoers.d/sureflow
echo 'ALL: kiosk' > /etc/sureflow-role
# The ser2net PACKAGE ships its own always-enabled service that binds the very
# ports our sureflow-serial-bridge unit binds, so both started and the loser
# logged "Unable to startup network port pinpad: Address already in use" every
# ten seconds forever. Only our unit may run.
systemctl disable ser2net >/dev/null 2>&1 || true
systemctl mask ser2net >/dev/null 2>&1 || true
# pam_env complains "Unable to open env file: /etc/default/locale" on every login
# and SSH session without this — minbase roots ship no locale default.
printf 'LANG=C.UTF-8\\n' > /etc/default/locale
# Without the local hostname in /etc/hosts, every sudo call stalls and prints
# "unable to resolve host <name>: Temporary failure in name resolution" — the lanes
# sit on an isolated VLAN with no DNS for their own name.
printf '127.0.0.1\\tlocalhost\\n' > /etc/hosts
H=\\\$(head -1 /etc/hostname 2>/dev/null)
[ -n "\\\$H" ] && printf '127.0.1.1\\t%s %s\\n' "\\\$H" "\\\$H" >> /etc/hosts
CHROOTEOF
  if [ \$? -ne 0 ]; then
    warn "The package install failed inside the \$variant root — the image is incomplete."
    chroot_umount "\$root"
    return 1
  fi

  log "[3/5] Applying the fleet layer (kiosk, bridges, lane agent)"
  apply_fleet_layer "\$root"

  log "[4/5] Fetching this store's hardware profiles and keyboard maps from the cloud"
  pf=\$(mktemp)
  if fetch_profiles "\$variant" "\$pf"; then apply_profiles "\$root" "\$variant" "\$pf"; fi
  rm -f "\$pf"
  apply_keyboards "\$root" "\$variant"

  log "[5/5] Rebuilding the initramfs for NFS root and publishing to TFTP"
  # MODULES=most puts the NIC drivers in the initramfs; BOOT=nfs is what lets the kernel
  # mount its root over the network at all.
  printf 'MODULES=most\\nBOOT=nfs\\n' > "\$root/etc/initramfs-tools/conf.d/sureflow"
  chroot "\$root" update-initramfs -u -k all >/dev/null 2>&1 || \\
    chroot "\$root" update-initramfs -c -k all >/dev/null 2>&1 || \\
    warn "Could not rebuild the initramfs for \$variant — the lane will not mount its NFS root."

  # Every chroot for this variant is done — release the mounts before touching the root
  # as plain files again.
  chroot_umount "\$root"

  if ! cp "\$root"/boot/vmlinuz-* "\$TFTP/debian-\$variant/vmlinuz" 2>/dev/null; then
    warn "No kernel found in the \$variant root — nothing was published to TFTP."
    return 1
  fi
  cp "\$root"/boot/initrd.img-* "\$TFTP/debian-\$variant/initrd.img" 2>/dev/null \\
    || warn "No initrd found in the \$variant root."

  log "=== \$variant image built and published to \$TFTP/debian-\$variant ==="
  return 0
}

# --- exports: written here because only a built root is worth exporting ------
write_exports() {
  {
    cat <<'SFEXPORTSHEAD'
${NFS_EXPORTS}
SFEXPORTSHEAD
    for v in legacy modern; do
      [ -d "\$ROOTS/sureflow-\$v" ] && echo "\$ROOTS/sureflow-\$v  \$PXE_SUBNET(ro,sync,no_subtree_check,no_root_squash)"
    done
    echo "/srv/sureflow/overlay  \$PXE_SUBNET(rw,sync,no_subtree_check,no_root_squash)"
  } > /etc/exports
  install -d -m 777 /srv/sureflow/overlay
  exportfs -ra 2>/dev/null || true
  systemctl restart nfs-kernel-server >/dev/null 2>&1 || true
}

BUILT=""
FAILED=""
case "\$WHICH" in
  both)   VARIANTS="legacy modern" ;;
  *)      VARIANTS="\$WHICH" ;;
esac
for v in \$VARIANTS; do
  if build_variant "\$v"; then BUILT="\$BUILT \$v"; else FAILED="\$FAILED \$v"; fi
done

write_exports
# NEVER chown /srv/sureflow recursively — that walks INTO the lane roots and gives every
# file in the image to uid 995, which strips the setuid bit from /usr/bin/sudo and
# Xorg.wrap. The lane then refuses every sudo with "must be owned by uid 0" and X can
# never take its VT. Only the relay/agent payload is the sureflow user's to own.
for d in relay lane-agent overlay; do
  [ -e "/srv/sureflow/\$d" ] && chown -R sureflow:sureflow "/srv/sureflow/\$d" 2>/dev/null
done
# The roots are a Debian filesystem and must stay root-owned.
for v in \$BUILT; do chown root:root "\$ROOTS/sureflow-\$v" 2>/dev/null; done
true

# Remember what this box built so the menu and the wizard default to it next time.
sed -i '/^LANE_IMAGE_VARIANT=/d' "\$CONF" 2>/dev/null
echo "LANE_IMAGE_VARIANT=\$WHICH" >> "\$CONF"

{
  echo "Lane image build — store \${STORE_ID:-unknown} — \$(date)"
  echo "Built:  \${BUILT:- none}"
  [ -n "\$FAILED" ] && echo "FAILED:\$FAILED"
  echo
  echo "Boot splash: \$SPLASH_STATUS"
  echo "Keyboard maps baked:\${KEYBOARDS_BAKED:- none}"
  echo
  echo "Published:"
  for v in \$BUILT; do
    echo "  \$TFTP/debian-\$v/vmlinuz + initrd.img"
    [ -f "\$TFTP/debian-\$v/boot-args" ] && echo "    boot args: \$(cat "\$TFTP/debian-\$v/boot-args")"
  done
  if [ -n "\$WARNINGS" ]; then echo; echo "Warnings:\$WARNINGS"; fi
  echo
  echo "Next: generate each lane's PXE entry on the Registers page (open a register, press"
  echo "PXE) — those are keyed to a MAC and are never built here. Then PXE boot one lane."
} > "\$SUMMARY"

# Record it centrally, best effort — a build is a fleet change and belongs in the audit trail.
if [ -n "\${RELAY_KEY:-}" ]; then
  curl -s --max-time 10 -X POST "\$CLOUD_SYNC_URL" \\
    -H 'Content-Type: application/json' \\
    -d "{\\"store_id\\":\\"\$STORE_ID\\",\\"api_key\\":\\"\$RELAY_KEY\\",\\"action\\":\\"lanes\\",\\"op\\":\\"audit\\",\\"lane_action\\":\\"Built lane image(s):\${BUILT:- none}\\",\\"detail\\":\\"Ran sureflow-build-lane-image \$WHICH on the controller. Keyboard maps baked:\${KEYBOARDS_BAKED:- none}.\${WARNINGS:+ Warnings were reported.}\${FAILED:+ FAILED:\$FAILED}\\"}" >/dev/null 2>&1 || true
fi

echo
cat "\$SUMMARY"
[ -z "\$FAILED" ] || exit 1
exit 0
`;

// Shown in the Technical Docs so a technician understands what the build produces before
// spending half an hour on it.
export const LANE_IMAGE_BUILD_NOTES = [
  "Two variants cover the fleet: legacy for IBM SurePOS 700 class terminals (fbdev video, i8042 quirks) and modern for Elo EPS00E2 class hardware. Build only the ones the store actually has.",
  "Budget 15 to 30 minutes per variant. debootstrap pulls a full Debian root over the BACKEND VLAN, which is the only side with an internet route — a box whose backend address is not up yet cannot build an image at all.",
  "Re-running is how the fleet is patched. The build is destructive by design: the existing root is removed first, so every build is reproducible rather than an accumulation of hand edits. Lanes pick up the new root on their next reboot.",
  "The cloud profile step is optional on purpose. With no relay API key or no cloud route the build still produces a bootable base + fleet image and says so on the summary; re-run once the route is up to layer the profiles in.",
  "Hardware profiles come from this store's own registers: the models filled in on the Registers page decide which HardwareLibrary profiles are fetched. A register with blank models contributes nothing, which is the usual reason a build reports zero profiles.",
  "Saved keyboard maps are baked in automatically. The build renders each active Key Mapper layout whose model appears on this store's registers into /etc/udev/hwdb.d inside the root and rebuilds the hwdb database — a read-only lane cannot apply a scancode map at runtime, so this is the only way it can take effect. An uncalibrated layout is reported as a warning rather than silently baked as a no-op.",
  "/proc, /sys, /dev and /dev/pts are mounted for the whole chroot phase and released afterwards. debootstrap mounts them only for its own second stage, so without this the package postinst scripts printed 'Is /dev/pts mounted?' and '/proc/ is not mounted' warnings and systemd-tmpfiles silently skipped creating device and /run entries. The mounts are torn down on interrupt too — deleting a root with /dev still bind-mounted inside it would take the controller's own /dev with it.",
  "Kernel boot args cannot live inside a root — they belong on the command line the Registers page emits per lane. The build publishes them to /srv/sureflow/tftp/debian-<variant>/boot-args and warns, so the two can be reconciled.",
  "The branded SureFlow boot splash is baked in by the build: the theme files are always written, and the theme is selected only when the three normalized PNGs are staged at /srv/sureflow/splash (run sureflow-fetch-splash-assets.sh once per controller). Without them the build keeps the generic spinner rather than a half-drawn theme, and the summary's 'Boot splash:' line says which one a given image got.",
  "The Toshiba VSP driver is baked into every image when its vendor .deb is present at /srv/sureflow/vendor/toshiba-vsp-linux.deb. It is what makes the Toshiba TCx 2x20 USB pole display work at all: the pole is a HID device no udev tty rule can match, and vsd turns it into a virtual serial tty the lane's serial bridge publishes on port 9101. Installed with DKMS disabled and --force-depends, because only the GUI configurator needs GTK and the USB pole path needs no kernel module. A lane with no Toshiba pole runs vsd idle with no effect.",
  "The root arrives read-only over NFS, so the image now carries an /etc/fstab that mounts tmpfs over /tmp, /var/tmp, /var/log, /var/lib/systemd and /home/sureflow. Without those the lane stops at the Linux login prompt: startx cannot create ~/.Xauthority, so it calls Xorg with an empty -auth argument and Xorg answers with its usage text and exits, while systemd-logind, the journal and utmp fail for the same reason. Everything written to those paths is deliberately discarded at power-off, which is the diskless property.",
  "dbus, dbus-x11, fontconfig and fonts-dejavu-core are in the package set for the kiosk browser. Without fontconfig and a font, Chromium logged 'Cannot load default config file' and could not draw text at all; without dbus it failed every bus call on startup. Both are recommends rather than depends, so --no-install-recommends left them out.",
  "xauth is named explicitly in the package set. xinit only RECOMMENDS it and the build installs with --no-install-recommends, so it was absent: startx ran xauth to create the auth cookie, xauth did not exist, and startx then called Xorg with an empty -auth argument. Xorg answered with its usage text and exited, which is the second half of the 'lane stops at the Linux login prompt' failure and looks identical to the read-only-root cause.",
  "nodejs is in the package set because the lane agent is a node program — without it the agent failed EXEC on /usr/bin/node every five seconds and the lane read as 'never seen' in the Lanes table.",
  "The ser2net package's own service is disabled and masked in the image. It binds the same ports as sureflow-serial-bridge, so leaving it enabled meant whichever lost the race logged 'Address already in use' every ten seconds forever.",
  "Per-lane pxelinux.cfg entries are still generated on the Registers page. They are keyed to each terminal's MAC, which the controller has no way of knowing at build time.",
];