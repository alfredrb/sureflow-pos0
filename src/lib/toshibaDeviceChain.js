// Toshiba/IBM RS-485 DEVICE CHAIN driver (aipdcs4) — the missing transport for the
// integrated 2x20 pole display on SurePOS 700 class lanes.
//
// WHY THIS EXISTS. On a live SurePOS 700 lane the green RS-485 pole sat at its idle
// self-test string ("U001") forever. Every UART on the box was ruled out by hand: the
// four 16550A ports are real, but writing IBM/ADX frames to them at 9600 and at 187500
// produced nothing, because none of them IS the RS-485 bus. Enumerating PCI straight from
// sysfs (lspci was not installed) found the real answer:
//
//   0000:11:06.1  1014:0297  class 070002  driver=serial   <- the PCI 16550 pair, ttyS2/ttyS3
//   0000:11:06.0  1014:0295  class 088000  driver=NONE     <- the DEVICE CHAIN controller
//
// An IBM function sitting on the bus with NOTHING bound to it. That is the RS-485
// controller the pole hangs off, and with no driver claiming it there is no device node
// anywhere on the lane and therefore no possible write path — which is exactly why the
// pole was powered, self-identified, and unreachable.
//
// The driver was never missing from the package. toshiba-vsp-linux ships complete DKMS
// trees at /opt/tgcs/vsp/dkms (aipdcs3, aipdcs4, aipeccd), and both aipdcs sources define
// SIO_4800_ID 0x0295 and include aiptc700.h — TC700 being this very terminal family. They
// were simply never compiled, because the image builder writes DKMS_DISABLED=1 before
// dpkg runs. That flag was added deliberately, on the reasoning that "the packaged modules
// target integrated Toshiba PCI peripherals that generic lanes do not have" — true for an
// Elo-class lane, and false for a SurePOS 700, which carries exactly such a peripheral.
// So the flag stays for the modern variant and is lifted only for legacy.

// WHICH MODULE. aipdcs3 and aipdcs4 both claim 1014:0295, so building both would put two
// drivers on one PCI function. They split by KERNEL generation, not by hardware:
//
//   aipdcs3  "Toshiba RS-485 Driver"                                  baseline V3.0.13
//   aipdcs4  "RS-485 Device Channel Server and FRAM driver"           baseline V5.10.78
//
// Lane kernel is 6.1.x, so aipdcs4 is the correct generation and aipdcs3 is deliberately
// left unbuilt. aipeccd is unrelated — it includes aiptc825.h, different hardware.
export const DEVICE_CHAIN_MODULE = "aipdcs4";
export const DEVICE_CHAIN_VERSION = "6.0.1";

// WHICH DEVICE NODE. Read straight out of the driver source rather than guessed:
//
//   aipdcs4.c:68  #define DEV_NAME  "aipdcs"
//
// The module registers its char device under that base name, so once it binds PCI
// 1014:0295 the node appears as /dev/aipdcs (single controller) or /dev/aipdcs0.
// Confirm which on a rebuilt lane before wiring the relay's pole transport to it —
// this is the write path the RS-485 pole has never had.
export const DEVICE_CHAIN_DEV_NAME = "aipdcs";
export const DEVICE_CHAIN_DEV_GLOB = "/dev/aipdcs*";

// Runs INSIDE the lane image chroot, legacy variant only, after the VSP .deb is installed.
//
// The kernel version is read from /lib/modules in the ROOT, never from uname -r: inside a
// chroot uname reports the CONTROLLER's running kernel, so a build keyed on it would
// compile against the wrong headers and install a module the lane can never load.
//
// Everything is best-effort and reports rather than aborting. A failed module build must
// not cost the store a bootable lane image — a lane with a dark pole still sells.
export const DEVICE_CHAIN_BUILD_STEPS = `set -uo pipefail
export DEBIAN_FRONTEND=noninteractive

# The kernel actually installed in THIS root — not the build host's.
KVER=$(ls /lib/modules 2>/dev/null | head -1)
if [ -z "$KVER" ]; then
  echo "aipdcs4: no kernel in /lib/modules — skipped"
  exit 0
fi

apt-get install -y --no-install-recommends dkms build-essential "linux-headers-$KVER" >/dev/null 2>&1 || {
  echo "aipdcs4: could not install dkms/headers for $KVER — skipped"; exit 0; }

# Lift the blanket disable for this variant only. Leaving it in place is what kept the
# RS-485 controller unclaimed on SurePOS 700 lanes.
rm -f /etc/default/tgcs-vsp

# DKMS needs the tree under /usr/src as <name>-<version>. The package ships it inside
# /opt, which is why it never appeared in /usr/src or in dkms status.
rm -rf "/usr/src/aipdcs4-6.0.1"
cp -r /opt/tgcs/vsp/dkms/aipdcs4 "/usr/src/aipdcs4-6.0.1" || {
  echo "aipdcs4: source tree not present in this image — skipped"; exit 0; }

dkms add -m aipdcs4 -v 6.0.1 >/dev/null 2>&1 || true
if dkms build -m aipdcs4 -v 6.0.1 -k "$KVER" >/tmp/aipdcs4-build.log 2>&1 &&
   dkms install -m aipdcs4 -v 6.0.1 -k "$KVER" >>/tmp/aipdcs4-build.log 2>&1; then
  # Autoload at boot. The module's PCI table matches 1014:0295, so on a lane WITHOUT the
  # device-chain controller it simply binds nothing and costs nothing.
  echo aipdcs4 > /etc/modules-load.d/sureflow-aipdcs4.conf
  echo "aipdcs4: built and installed for $KVER"
else
  echo "aipdcs4: BUILD FAILED for $KVER — $(tail -3 /tmp/aipdcs4-build.log | tr '\\n' ' ')"
fi
rm -f /tmp/aipdcs4-build.log
exit 0
`;

export const DEVICE_CHAIN_NOTES = [
  "The RS-485 pole on a SurePOS 700 is driven by the aipdcs4 kernel module, which claims the integrated IBM device-chain controller at PCI 1014:0295. Without it that controller sits on the bus with driver=NONE, no device node exists, and the pole idles at 'U001' no matter what is written to any UART.",
  "The four 16550A UARTs on the box are NOT the RS-485 bus. ttyS2/ttyS3 come from a separate IBM PCI serial function (1014:0297, bound to the stock 'serial' driver), which is why hand-testing them at 9600 and 187500 produced nothing and looked like dead hardware.",
  "The driver ships inside toshiba-vsp-linux already — the DKMS trees are at /opt/tgcs/vsp/dkms, not /usr/src, which is why 'dkms status' and a /usr/src check both came up empty and it looked absent. It was never registered because the image builder wrote DKMS_DISABLED=1 before dpkg ran.",
  "That disable is now lifted for the LEGACY variant only. It remains correct for modern Elo-class lanes, which genuinely have no integrated Toshiba PCI peripheral, and building a driver there would only add headers and build time for hardware that does not exist.",
  "aipdcs3 is deliberately NOT built. It claims the same PCI id as aipdcs4, so building both would leave two drivers racing for one function. They differ by kernel generation, not hardware: aipdcs3 baselines at V3.0.13, aipdcs4 at V5.10.78, and the lane runs 6.1.",
  "aipeccd is not built either — it includes aiptc825.h and targets different hardware entirely.",
  "The build reads its kernel version from /lib/modules inside the image root, never from uname -r. In a chroot uname reports the CONTROLLER's kernel, so a build keyed on it compiles against the wrong headers and installs a module the lane silently refuses to load.",
  "A failed module build never fails the image. The build logs the reason and carries on, because a lane with a dark pole still sells and a lane with no image does not.",
  "The device node base name is 'aipdcs', taken from DEV_NAME at aipdcs4.c line 68 — so the node lands at /dev/aipdcs or /dev/aipdcs0 once the module binds. That is the write path the RS-485 pole has never had, and the relay's pole transport is still not wired to it.",
  "Verify on a REBUILT LANE, not on the controller. The controller was never built from the lane image and has no SurePOS 700 peripheral, so 'lsmod | grep aipdcs4' returning nothing there is expected and means nothing — only the lane's own output counts. On the lane: lsmod | grep aipdcs4, re-run the sysfs PCI loop and confirm 0000:11:06.0 now reports driver=aipdcs4 instead of NONE, then ls -l /dev/aipdcs*.",
];