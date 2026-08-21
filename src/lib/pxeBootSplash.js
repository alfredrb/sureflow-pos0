// Boot splash + system beeper for the diskless lanes.
//
// Plymouth owns the system-level progress bar: it runs on the framebuffer from
// early initramfs until the kiosk takes the screen, so the customer-facing
// terminal never shows a wall of kernel text. The PC speaker (pcspkr) handles
// pre-POS audible feedback — boot OK, boot failed — which is the only sound the
// lane can make before Chromium exists.
//
// Consumed by PXEControllerGuide through the shared SetupStepDetail renderer.

const PLYMOUTH_THEME = `# /usr/share/plymouth/themes/sureflow/sureflow.plymouth (inside the image)
# Two-step theme: the stock 'script' module draws our progress bar, so there is
# no compiled plugin to maintain across Debian upgrades.
[Plymouth Theme]
Name=SureFlow POS
Description=SureFlow lane boot progress
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/sureflow
ScriptFile=/usr/share/plymouth/themes/sureflow/sureflow.script
`;

const PLYMOUTH_SCRIPT = `# /usr/share/plymouth/themes/sureflow/sureflow.script (inside the image)
# Centred wordmark with a real progress bar underneath. Plymouth drives
# progress_callback from actual boot milestones, so the bar reflects the boot
# rather than a timer.

Window.SetBackgroundTopColor(0.04, 0.05, 0.15);
Window.SetBackgroundBottomColor(0.02, 0.03, 0.09);

logo.image = Image("logo.png");
logo.sprite = Sprite(logo.image);
logo.sprite.SetX(Window.GetWidth() / 2 - logo.image.GetWidth() / 2);
logo.sprite.SetY(Window.GetHeight() / 2 - logo.image.GetHeight());

bar.width = Window.GetWidth() * 0.5;
bar.height = 6;
bar.x = Window.GetWidth() / 2 - bar.width / 2;
bar.y = Window.GetHeight() / 2 + 40;

# Track (dim) and fill (blue) are drawn as flat 1px images scaled to size.
track.image = Image("track.png").Scale(bar.width, bar.height);
track.sprite = Sprite(track.image);
track.sprite.SetX(bar.x);
track.sprite.SetY(bar.y);

fill.base = Image("fill.png");
fill.sprite = Sprite();
fill.sprite.SetX(bar.x);
fill.sprite.SetY(bar.y);

fun progress_callback(duration, progress) {
    w = bar.width * progress;
    if (w < 1) w = 1;
    fill.sprite.SetImage(fill.base.Scale(w, bar.height));
}
Plymouth.SetBootProgressFunction(progress_callback);

status.sprite = Sprite();
status.sprite.SetY(bar.y + 24);
fun set_status(text) {
    img = Image.Text(text, 0.7, 0.75, 0.85);
    status.sprite.SetImage(img);
    status.sprite.SetX(Window.GetWidth() / 2 - img.GetWidth() / 2);
}
set_status("Starting lane...");

# systemd hands each unit description here — this is the "what's loaded" line.
fun update_status_callback(text) { set_status(text); }
Plymouth.SetUpdateStatusFunction(update_status_callback);
`;

const BEEP_SCRIPT = `#!/bin/bash
# /usr/local/bin/sureflow-beep (inside the image)
# Motherboard speaker feedback for the pre-POS phase. The PC speaker is a
# beeper, not a sound card: one square-wave tone at a time, no playback.
# In-app sounds stay in the browser — this is only "is the hardware alive".
#
# Usage: sureflow-beep ok | fail | attention
set -u
DEV=/dev/input/by-path/platform-pcspkr-event-spkr
tone() { /usr/bin/beep -e "\$DEV" -f "\$1" -l "\$2" 2>/dev/null || true; }

case "\${1:-ok}" in
  ok)        tone 880 90;  tone 1320 140 ;;   # rising two-tone: lane reached the POS
  fail)      tone 320 260; tone 240 400 ;;    # falling: boot failed, see the console
  attention) tone 1000 120; tone 1000 120 ;;  # double blip: technician attention
esac
`;

const BEEP_UNITS = `# \${ROOT}/etc/systemd/system/sureflow-beep-ok.service
# Sounds once the kiosk is up — the lane's audible "ready".
[Unit]
Description=SureFlow lane ready chime
After=sureflow-kiosk.service
Requires=sureflow-kiosk.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sureflow-beep ok

[Install]
WantedBy=multi-user.target

# --- \${ROOT}/etc/systemd/system/sureflow-beep-fail.service ---
# Sounds when the kiosk gives up, so a dead lane is audible from the floor.
[Unit]
Description=SureFlow lane boot failure alert

[Service]
Type=oneshot
ExecStart=/usr/local/bin/sureflow-beep fail

# Wire it to the kiosk unit with:
#   [Unit] OnFailure=sureflow-beep-fail.service
`;

const PXE_SPLASH_MENU = `# /srv/tftp/pxelinux.cfg — brand the network handoff (optional)
# pxelinux cannot show real progress: TFTP/NFS speed is invisible to it. This is
# a branded 3-second wait, not a loading bar. Plymouth does the real work.
UI menu.c32
MENU TITLE SureFlow POS - starting lane
MENU BACKGROUND sureflow.png
PROMPT 0
TIMEOUT 30

MENU COLOR TITLE   1;36;44 #ffffffff #00000000
MENU COLOR SEL     7;37;40 #ff000000 #ffdddddd
`;

export const BOOT_SPLASH_STEP = {
  step_id: "pxe_boot_splash",
  label: "Add the boot progress screen and system beeper",
  instructions: [
    "Plymouth is the system-level progress bar. It draws on the framebuffer from early initramfs through the NFS root mount and systemd targets, then hands the screen to the kiosk — so a lane shows a branded bar instead of kernel text for the whole boot.",
    "The bar is driven by real boot milestones, not a timer: Plymouth calls the theme's progress_callback as units come up, and the status line under the bar shows each unit's description — that is the 'what's loaded' readout.",
    "Both boot entries now pass 'quiet splash' so the text scroll stays behind the splash. On a failure Plymouth drops to the text console by itself, so diagnostics are never lost — press ESC on a lane to see the messages live.",
    "Plymouth needs the framebuffer early, which is why the legacy (SurePOS 700) entry keeps nomodeset and the fbdev driver — the splash renders at the console resolution rather than the panel's native mode there, which is expected and still readable.",
    "The motherboard speaker (pcspkr) covers the pre-POS phase, the one window where the POS cannot make a sound. It is a beeper: single square-wave tones, no audio playback. sureflow-beep plays a rising two-tone when the lane reaches the POS and a falling tone when the kiosk fails, so a dead lane is audible from the floor.",
    "In-app sounds stay in the browser — the PC speaker is only for 'is the hardware alive'. Keep the two separate so a muted terminal still reports boot failures.",
    "Confirm the beeper exists per model before relying on it: the SurePOS 700 has the same onboard speaker IBM drove for 4690 alerts, but many modern boards (Elo EPS00E2 class) dropped the header. Where it is absent the beep calls fail silently and boot is unaffected.",
    "Drop the theme, script and beep helper into the driver-library/build path rather than hand-editing a live image — the read-only NFS root means a lane cannot keep its own copy, and a rebuild would lose it.",
  ],
  commands: [
    "# On the CONTROLLER — install Plymouth and the beeper into both images",
    "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V apt-get install -y --no-install-recommends plymouth plymouth-themes beep; done",
    "# Install the SureFlow theme (files below) and select it",
    "for V in legacy modern; do sudo install -d /srv/nfs/sureflow-$V/usr/share/plymouth/themes/sureflow; done",
    "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V plymouth-set-default-theme -R sureflow; done",
    "# The splash must be in the initramfs or the first seconds stay black",
    "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V update-initramfs -u -k all; done",
    "# Load the PC speaker module — minimal debootstrap roots often blacklist it",
    "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V /bin/bash -c 'echo pcspkr > /etc/modules-load.d/sureflow-pcspkr.conf; rm -f /etc/modprobe.d/*pcspkr*blacklist*'; done",
    "sudo install -m 755 /dev/stdin /srv/nfs/sureflow-modern/usr/local/bin/sureflow-beep   # paste below, repeat for -legacy",
    "for V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V systemctl enable sureflow-beep-ok; done",
    "# Republish kernel + initrd so the lanes boot the splash-enabled initramfs",
    "sudo sureflow-build-image legacy && sudo sureflow-build-image modern",
  ],
  codeFiles: [
    { name: "sureflow.plymouth", code: PLYMOUTH_THEME },
    { name: "sureflow.script", code: PLYMOUTH_SCRIPT },
    { name: "sureflow-beep", code: BEEP_SCRIPT },
    { name: "sureflow-beep units", code: BEEP_UNITS },
    { name: "pxelinux splash (optional)", code: PXE_SPLASH_MENU },
  ],
  postInstructions: [
    "Reboot a lane: expect the pxelinux handoff, then the SureFlow bar filling through the boot with unit names underneath, then the POS — and a rising two-tone chime as it lands.",
    "Screen black instead of the splash? The initramfs was not rebuilt after the theme install, or the framebuffer came up late — run update-initramfs -u -k all in the chroot and confirm 'splash' is on the lane's cmdline (cat /proc/cmdline).",
    "Bar shows but no beep? Check the speaker exists: ls /dev/input/by-path | grep pcspkr on the lane. Nothing listed means the board has no beeper header — use the panel's own speaker or accept a silent boot.",
    "Press ESC during boot to fall back to the kernel messages without changing the image — the fastest way to debug a slow lane with the splash still installed.",
  ],
};