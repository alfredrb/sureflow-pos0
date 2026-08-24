// Packages the controller installer as a .tar.gz the technician downloads instead of
// pasting a script into nano.
//
// Built entirely in the browser from this app's own module exports, so the archive can
// never drift from the version of the app that produced it — there is no stored copy of
// the installer anywhere to go stale. Uses a hand-rolled POSIX/ustar writer and the
// platform's CompressionStream('gzip'), so no packages are added for this.

import { CONTROLLER_INSTALL_SCRIPT, buildStoreInstallSheet } from "@/lib/controllerInstaller";
import { CONTROLLER_MENU_SCRIPT, CONTROLLER_MENU_PROFILE } from "@/lib/controllerMenu";
import {
  LANE_REBOOT_AGENT_CODE,
  LANE_REBOOT_AGENT_UNIT,
  LANE_REBOOT_AGENT_BUILD_STEPS,
} from "@/lib/relayLaneReboot";

const BLOCK = 512;
const enc = new TextEncoder();

function padName(name) {
  // 100-byte name field. Every path we emit is short, so a name that overflows is a bug
  // in the caller rather than something to silently truncate.
  const bytes = enc.encode(name);
  if (bytes.length > 100) throw new Error(`Archive path too long for tar: ${name}`);
  return bytes;
}

function octal(value, width) {
  return enc.encode(value.toString(8).padStart(width - 1, "0") + "\0");
}

function header(name, size, mode) {
  const h = new Uint8Array(BLOCK);
  h.set(padName(name), 0);
  h.set(octal(mode, 8), 100); // mode
  h.set(octal(0, 8), 108); // uid
  h.set(octal(0, 8), 116); // gid
  h.set(octal(size, 12), 124);
  h.set(octal(Math.floor(Date.now() / 1000), 12), 136);
  h.set(enc.encode("        "), 148); // checksum placeholder: spaces
  h[156] = 0x30; // typeflag '0' = regular file
  h.set(enc.encode("ustar\0"), 257);
  h.set(enc.encode("00"), 263);

  let sum = 0;
  for (const b of h) sum += b;
  h.set(octal(sum, 8), 148);
  return h;
}

// entries: [{ name, body, mode }]
function buildTar(entries) {
  const chunks = [];
  for (const e of entries) {
    const body = enc.encode(e.body);
    chunks.push(header(e.name, body.length, e.mode ?? 0o644));
    chunks.push(body);
    const rem = body.length % BLOCK;
    if (rem) chunks.push(new Uint8Array(BLOCK - rem));
  }
  // Two zero blocks terminate the archive.
  chunks.push(new Uint8Array(BLOCK * 2));

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

// The pre-seeded answer sheet. RELAY_KEY is deliberately left as a placeholder: keys are
// generated per store on the Relay Ops card and must not be baked into a file that gets
// emailed around.
function buildControllerConf(store) {
  const ha = !!store.ha_enabled;
  return `# /etc/sureflow/controller.conf — pre-seeded for store ${store.store_number} (${store.name})
# Written by the SureFlow admin panel. The installer reads these as its DEFAULTS, so the
# technician confirms rather than types. Edit anything that is wrong before running.
#
# RELAY_KEY is intentionally blank: generate it on this store's Relay Ops card and paste
# it at the prompt (or fill it in here) before the wizard's confirm screen.
STORE_ID=${store.store_number}
ROLE=${ha ? "primary" : "standalone"}
PXE_IP=10.0.40.10
PXE_SUBNET=10.0.40.0/24
BACKEND_IP=${store.primary_controller_host || ""}
PXE_VIP=${ha ? "10.0.40.50" : "10.0.40.10"}
BACKEND_VIP=${store.controller_vip || store.primary_controller_host || ""}
PEER_IP=${ha ? store.secondary_controller_host || "" : ""}
RELAY_KEY=
CLOUD_SYNC_URL=${window.location.origin}
`;
}

const INSTALL_WRAPPER = `#!/bin/bash
# ./install — unpack-and-go entry point for the SureFlow controller tarball.
# Puts each file where the controller expects it, then hands over to the wizard.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo ./install"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"

install -d -m 755 /usr/local/sbin /usr/local/bin /etc/sureflow /srv/sureflow/lane-agent
install -m 755 "$HERE/sureflow-controller-install" /usr/local/sbin/sureflow-controller-install
install -m 755 "$HERE/sureflow-menu"              /usr/local/bin/sureflow-menu
install -m 644 "$HERE/sureflow-menu.sh"           /etc/profile.d/sureflow-menu.sh

# The lane agent is NOT for this box — it is staged here so the same tarball can build a
# lane root without a second download. See lane-agent/README-lane-agent.txt.
install -m 755 "$HERE/lane-agent/sureflow-lane-agent"          /srv/sureflow/lane-agent/sureflow-lane-agent
install -m 644 "$HERE/lane-agent/sureflow-lane-agent.service"  /srv/sureflow/lane-agent/sureflow-lane-agent.service
install -m 644 "$HERE/lane-agent/README-lane-agent.txt"        /srv/sureflow/lane-agent/README-lane-agent.txt

# A pre-seeded answer sheet, if this is a store-specific tarball. Never clobber a conf
# that is already on the box — a re-run must keep the values the box is actually using.
if [ -f "$HERE/controller.conf" ] && [ ! -f /etc/sureflow/controller.conf ]; then
  install -m 600 "$HERE/controller.conf" /etc/sureflow/controller.conf
  echo "Pre-seeded /etc/sureflow/controller.conf for this store."
elif [ -f "$HERE/controller.conf" ]; then
  echo "Kept the existing /etc/sureflow/controller.conf (this box is already configured)."
fi

echo
echo "Installed. Starting the wizard..."
exec /usr/local/sbin/sureflow-controller-install
`;

const LANE_AGENT_README = `SureFlow lane agent — staged, not installed on this box
=======================================================

These files belong INSIDE the diskless lane root, not on the controller. The tarball
carries them so building a lane root needs no second download.

  sureflow-lane-agent          -> <root>/usr/local/bin/sureflow-lane-agent   (mode 755)
  sureflow-lane-agent.service  -> <root>/etc/systemd/system/                 (mode 644)

The agent is what makes the controller menu's Lanes screen work at all: lanes sit on the
isolated PXE VLAN and cannot be reached inbound, so the agent polls the relay outbound
for a queued reboot and reports itself as seen. A root without the agent shows up as
"never seen" in the Lanes table and cannot be rebooted remotely.

Build steps (run on the controller, ROOT = the lane root you are building):

${LANE_REBOOT_AGENT_BUILD_STEPS}
`;

function buildReadme(store) {
  return `SureFlow Store Controller — installer bundle
${store ? `Pre-seeded for store ${store.store_number} (${store.name})` : "Generic bundle — every value is typed at the prompts"}
Generated ${new Date().toISOString()} from ${window.location.origin}

WHAT THIS IS
  A fresh Debian 12 box becomes a COMBINED store controller: PXE/TFTP + the NFS lane
  roots on the isolated boot VLAN 40, and the SureFlow Local Relay on the routed backend
  VLAN 25. Both interfaces must already be up and addressed before you start — the
  backend side is the only one with an internet route, and the wizard fetches packages
  and clones the relay through it.

RUN IT
  tar xzf sureflow-controller-*.tar.gz
  cd sureflow-controller-*
  sudo ./install

  ./install copies the wizard, the console menu and its login hook into place, stages the
  lane agent under /srv/sureflow/lane-agent, and then runs the wizard. Re-running is safe:
  saved answers come back as the defaults.

CONTENTS
  install                        this wrapper
  sureflow-controller-install    the guided wizard (installs to /usr/local/sbin)
  sureflow-menu                  the console menu (installs to /usr/local/bin)
  sureflow-menu.sh               login hook (installs to /etc/profile.d)
  lane-agent/                    for the diskless lane root, NOT this box — see its README
${store ? "  controller.conf                pre-seeded answers for this store\n" : ""}
${
  store
    ? `THIS STORE'S VALUES
${buildStoreInstallSheet(store)
  .split("\n")
  .map((l) => "  " + l)
  .join("\n")}
`
    : ""
}AFTER THE WIZARD
  * Set this store's relay URL in the Infrastructure Command Center to the BACKEND
    address on port 3000 — never the PXE address, which the cloud cannot reach.
  * Stage a lane root under /srv/sureflow/roots, installing the lane agent from
    lane-agent/ into it, then PXE boot one lane.
  * Log out and back in for the console menu.
`;
}

/** Builds the archive and returns { blob, filename }. */
export async function buildControllerTarball(store) {
  const slug = store ? `store-${store.store_number}` : "generic";
  const dir = `sureflow-controller-${slug}`;

  const entries = [
    { name: `${dir}/README.txt`, body: buildReadme(store) },
    { name: `${dir}/install`, body: INSTALL_WRAPPER, mode: 0o755 },
    { name: `${dir}/sureflow-controller-install`, body: CONTROLLER_INSTALL_SCRIPT, mode: 0o755 },
    { name: `${dir}/sureflow-menu`, body: CONTROLLER_MENU_SCRIPT, mode: 0o755 },
    { name: `${dir}/sureflow-menu.sh`, body: CONTROLLER_MENU_PROFILE },
    { name: `${dir}/lane-agent/sureflow-lane-agent`, body: LANE_REBOOT_AGENT_CODE, mode: 0o755 },
    { name: `${dir}/lane-agent/sureflow-lane-agent.service`, body: LANE_REBOOT_AGENT_UNIT },
    { name: `${dir}/lane-agent/README-lane-agent.txt`, body: LANE_AGENT_README },
  ];
  if (store) entries.push({ name: `${dir}/controller.conf`, body: buildControllerConf(store), mode: 0o600 });

  const blob = await gzip(buildTar(entries));
  return { blob, filename: `${dir}.tar.gz` };
}

export async function downloadControllerTarball(store) {
  const { blob, filename } = await buildControllerTarball(store);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}