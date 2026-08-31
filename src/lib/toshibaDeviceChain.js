// IBM RS-485 DEVICE CHAIN (PCI 1014:0295) — CLOSED: NO DRIVER EXISTS FOR IT.
//
// This file is a findings record, not a build step. It exists so the integrated 2x20 pole
// on SurePOS 700 class lanes is never chased again on the same false trail.
//
// WHAT WAS CHASED. The green RS-485 pole sat at its idle self-test string ("U001") on a
// live lane. Every UART was ruled out by hand at 9600 and at 187500. Enumerating PCI
// straight from sysfs (lspci was not installed) found:
//
//   0000:11:06.1  1014:0297  class 070002  driver=serial   <- PCI 16550 pair, ttyS2/ttyS3
//   0000:11:06.0  1014:0295  class 088000  driver=NONE     <- the DEVICE CHAIN controller
//
// An IBM function on the bus with nothing bound to it. The vendor package
// (toshiba-vsp-linux) ships DKMS trees for aipdcs3 and aipdcs4 at /opt/tgcs/vsp/dkms, both
// of which #define SIO_4800_ID 0x0295 and include aiptc700.h — TC700 being this terminal
// family. That looked conclusive. It was not.
//
// WHY IT IS A DEAD END. Three findings from the live lane, in order:
//
//   1. NEITHER MODULE IS A PCI BUS DRIVER. /sys/bus/pci/drivers/aipdcs4 does not exist,
//      so a manual bind is impossible and the missing driver symlink on 0000:11:06.0 was
//      never a failure to fix — it is simply how these drivers work.
//
//   2. THEY LOOK UP THE WRONG VENDOR ENTIRELY. Both call exactly one device lookup:
//         pci_get_device(TCX_VENDOR_ID, SIO_4900_ID, ...)     TCX_VENDOR_ID = 0x11D9
//      0x11D9 is Toshiba. Our controller is IBM 0x1014. aipdcs4 additionally looks for a
//      FRAM device, which also is not present. dmesg said so plainly:
//         aipdcs4: Model=0xfc, Submodel=0xcd
//         aipdcs4(get_fram_device): Failure to get FRAM PCI device
//         aipdcs4(get_4900_device): Failure to get 4900 PCI device
//
//   3. SIO_4800_ID 0x0295 IS NEVER USED IN A LOOKUP. In both sources every use of it
//      (aipdcs4.c lines 2273 / 2291 / 2353, aipdcs3.c lines 1786 / 1804 / 1888) only
//      REPORTS an AdapterID back through an ioctl parameter block. Its presence in the
//      source is a legacy leftover and proves nothing about support.
//
// So no module in the vendor package can ever claim IBM 1014:0295 — not on any kernel, not
// with any headers, not with any bind. Building one taints the kernel and adds DKMS,
// headers and build minutes for a driver that provably cannot attach. The build step was
// therefore reverted out of the legacy lane image.
//
// FALSE INFERENCES THIS INVESTIGATION PRODUCED, recorded because each one cost a cycle:
//   - "SIO_4800_ID is defined, so 0x0295 is supported."  A defined constant says nothing
//     about whether the lookup path uses it.
//   - "aipdcs4 over aipdcs3 because the lane runs 6.1 and aipdcs4 baselines at V5.10.78."
//     The two differ by which HARDWARE generation they search for. Both search for the
//     same wrong one, so the kernel baseline was never the discriminator.
//   - "Building both would race two drivers for one PCI function."  Moot — neither
//     registers on the PCI bus, so there is no contention to avoid.
//   - "/dev/aipdcs exists, so the controller was claimed."  The char major is registered
//     at module_init unconditionally; the node appeared with no hardware behind it and
//     every write returned EINVAL.
//
// WHAT TO DO INSTEAD. Fit a USB pole. The Toshiba TCx 2x20 USB pole (0f66:4524) is proven
// working end to end on a live lane through the VSP driver's virtual tty at /dev/ttyS20 and
// the lane's serial bridge on port 9101 — see @/lib/toshibaVsp. The integrated RS-485 pole
// on SurePOS 700 hardware should be treated as unsupported.

export const DEVICE_CHAIN_PCI_ID = "1014:0295";
export const DEVICE_CHAIN_SUPPORTED = false;

// Kept so a technician can confirm the finding on any lane rather than trusting this note.
export const DEVICE_CHAIN_VERIFY_STEPS = `# The controller is present and unclaimed — expected, and NOT the fault:
ls -l /sys/bus/pci/devices/0000:11:06.0/driver     # No such file or directory

# Neither vendor module registers as a PCI driver, so there is nothing to bind to:
ls /sys/bus/pci/drivers/ | grep -i aip            # no output

# Both modules look up Toshiba 0x11D9 / SIO_4900_ID, never IBM 0x1014 / 0x0295:
grep -n "pci_get_device" /opt/tgcs/vsp/dkms/aipdcs3/aipdcs3.c
grep -n "pci_get_device" /usr/src/aipdcs4-6.0.1/aipdcs4.c 2>/dev/null
grep -n "TCX_VENDOR_ID" /opt/tgcs/vsp/dkms/aipdcs3/aipdcs3.c   # 0x11D9

# Note dmesg is restricted for unprivileged users on a lane — use sudo, and note that
# 'modinfo' lives in /usr/sbin and is not on the sureflow user's PATH.
sudo dmesg | grep -i aipdcs
`;

export const DEVICE_CHAIN_NOTES = [
  "The integrated RS-485 pole on IBM SurePOS 700 class hardware is UNSUPPORTED and no longer chased. Fit a USB pole instead — the Toshiba TCx 2x20 USB pole is proven working through the VSP virtual tty and the lane's serial bridge.",
  "The device-chain controller is real and present at PCI 1014:0295 (class 088000), separate from the 16550A pair at 1014:0297 that provides ttyS2/ttyS3. That is why hand-testing every UART at 9600 and 187500 produced nothing and looked like dead hardware.",
  "No driver in the vendor package can claim it. Both aipdcs3 and aipdcs4 perform exactly one device lookup — pci_get_device(TCX_VENDOR_ID 0x11D9, SIO_4900_ID) — searching for Toshiba TCx hardware. Our controller is IBM vendor 0x1014, which neither module ever looks for.",
  "SIO_4800_ID 0x0295 IS defined in both sources, which is what made them look promising, but every use of it only reports an AdapterID back through an ioctl parameter block. It is never passed to a lookup, so its presence proves nothing.",
  "Neither module registers as a PCI bus driver at all — /sys/bus/pci/drivers/aipdcs4 does not exist. So the absent driver symlink on 0000:11:06.0 was never a failure to fix, and a manual bind is not possible.",
  "A /dev/aipdcs node appearing does NOT mean the hardware was claimed. The char major is registered at module_init unconditionally; on this lane the node existed with nothing behind it and every write returned EINVAL ('Invalid argument').",
  "The driver says so itself in dmesg: 'aipdcs4: Model=0xfc, Submodel=0xcd' followed by 'Failure to get FRAM PCI device' and 'Failure to get 4900 PCI device'. Model=0xfc/Submodel=0xcd is this terminal family's BIOS signature.",
  "aipdcs4 was briefly built into the legacy lane image on the theory that driver=NONE meant a missing module. It built and loaded cleanly and changed nothing. That build step has been reverted — it taints the kernel and costs DKMS, headers and build minutes for a driver that cannot attach.",
  "Diagnosing this on a lane needs sudo for dmesg (kernel.dmesg_restrict), and 'modinfo' is in /usr/sbin, off the sureflow user's PATH.",
  "TELLING A LANE FROM THE CONTROLLER: do NOT go by the shell prompt. Every diskless lane boots with the controller's hostname baked into the image, so a lane also presents as sfc-001-a. Use 'ip -4 addr' (a lane is on the PXE VLAN) or 'cat /proc/cmdline' (a lane carries nfsroot= and sureflow.register_id=).",
];