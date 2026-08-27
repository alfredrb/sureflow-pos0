// Boot splash + system beeper for the diskless lanes.
//
// Plymouth owns the system-level progress bar: it runs on the framebuffer from
// early initramfs until the kiosk takes the screen, so the customer-facing
// terminal never shows a wall of kernel text. The PC speaker (pcspkr) handles
// pre-POS audible feedback — boot OK, boot failed — which is the only sound the
// lane can make before Chromium exists.
//
// Consumed by PXEControllerGuide through the shared SetupStepDetail renderer.

// Baked into every lane root by laneImageBuilder's fleet layer — exported so the
// builder is the single installer rather than a hand-run documentation step.
export const PLYMOUTH_THEME = `# /usr/share/plymouth/themes/sureflow/sureflow.plymouth (inside the image)
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

export const PLYMOUTH_SCRIPT = `# /usr/share/plymouth/themes/sureflow/sureflow.script (inside the image)
# SureFlow Clean splash. 4690-style: the wave artwork fills the screen, the
# wordmark sits bottom-right, and a cyclone spinner with a fixed status line
# sits in the lower third. No progress bar — the spinner is the only motion,
# which is what an operator reads as "working, don't touch it".

# background.png is the wave artwork, scaled to whatever mode the panel came up
# in (the legacy fbdev path is often 1024x768, so never assume native).
bg.image = Image("background.png").Scale(Window.GetWidth(), Window.GetHeight());
bg.sprite = Sprite(bg.image);
bg.sprite.SetX(0);
bg.sprite.SetY(0);
bg.sprite.SetZ(-100);

# Flat fallback so a missing asset still gives a dark screen, not a black one.
Window.SetBackgroundTopColor(0.075, 0.098, 0.125);
Window.SetBackgroundBottomColor(0.055, 0.070, 0.094);

# Wordmark, bottom-right.
logo.image = Image("logo.png");
logo.sprite = Sprite(logo.image);
logo.sprite.SetX(Window.GetWidth() - logo.image.GetWidth() - Window.GetWidth() * 0.06);
logo.sprite.SetY(Window.GetHeight() - logo.image.GetHeight() - Window.GetHeight() * 0.07);

# --- Cyclone spinner -------------------------------------------------------
# Eight dots on a ring, each fading in turn, so the ring reads as rotating.
# dot.png is a single small muted-blue disc — one asset, scaled per dot.
spinner.count = 8;
spinner.radius = Window.GetHeight() * 0.035;
spinner.x = Window.GetWidth() / 2;
spinner.y = Window.GetHeight() * 0.79;
spinner.dot = Image("dot.png");

for (i = 0; i < spinner.count; i++) {
    angle = (i / spinner.count) * 2 * 3.14159265;
    spinner.sprite[i] = Sprite(spinner.dot);
    spinner.sprite[i].SetX(spinner.x + spinner.radius * Math.Sin(angle) - spinner.dot.GetWidth() / 2);
    spinner.sprite[i].SetY(spinner.y - spinner.radius * Math.Cos(angle) - spinner.dot.GetHeight() / 2);
    spinner.sprite[i].SetOpacity(0.15);
}

# Refresh fires ~50x/sec. Advancing the lead dot every 6th frame gives roughly
# one revolution per second — brisk enough to look alive, slow enough not to blur
# on the low-refresh legacy framebuffer.
spinner.frame = 0;
spinner.lead = 0;
fun refresh_callback() {
    spinner.frame++;
    if (spinner.frame < 6) return;
    spinner.frame = 0;
    spinner.lead = (spinner.lead + 1) % spinner.count;
    for (i = 0; i < spinner.count; i++) {
        # Distance behind the lead dot, wrapped — the comet tail.
        d = spinner.lead - i;
        if (d < 0) d = d + spinner.count;
        spinner.sprite[i].SetOpacity(1.0 - (d * 0.11));
    }
}
Plymouth.SetRefreshFunction(refresh_callback);

# --- Status line -----------------------------------------------------------
# Deliberately fixed. The 4690 says one thing for the whole boot, and streaming
# systemd unit names at a cashier only invites support calls. ESC still drops to
# the kernel log when a technician actually needs the detail.
status.sprite = Sprite();
fun set_status(text) {
    img = Image.Text(text, 0.878, 0.878, 0.878);
    status.sprite.SetImage(img);
    status.sprite.SetX(Window.GetWidth() / 2 - img.GetWidth() / 2);
    status.sprite.SetY(spinner.y + spinner.radius + Window.GetHeight() * 0.045);
}
set_status("Terminal is being initialized");
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
  ok)        tone 800 700; tone 1200 700 ;;   # long rising two-tone: lane reached the POS
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

// The three approved SureFlow Clean assets. Run this once on the PXE controller,
// then install them into both image roots. Plymouth reads plain PNGs from the theme
// directory — nothing is compiled, so replacing an asset is just a file copy plus an
// initramfs rebuild.
//
// The wordmark and the dot are supplied on a SOLID #131920 field rather than with an
// alpha channel: both sit on empty flat background in the lower area of the artwork,
// so the opaque field is invisible in place, and it avoids the legacy fbdev path
// having to composite alpha on every spinner frame.
const SPLASH_ASSET_FETCH = `#!/bin/bash
# /root/sureflow-fetch-splash-assets.sh — run on the PXE CONTROLLER.
#
# Two things this script MUST do beyond downloading, both learned the hard way:
#
#  1. Convert to real PNG. The asset URLs end in .png but serve JPEG data.
#     Plymouth decodes PNG only — a JPEG makes every Image() call return null,
#     the sprites are silently skipped, and the lane boots to the status text on
#     a bare background with no artwork at all.
#  2. Resize. Plymouth places sprites from each image's own pixel dimensions and
#     does not scale logo.png or dot.png. A full-size dot.png renders as one
#     screen-filling blue disc (eight of them stacked), which is what the lanes
#     showed before these steps existed.
#
# Run this ONCE per controller. It stages the normalized assets where the lane
# image builder looks for them (/srv/sureflow/splash, alongside the vendor drop at
# /srv/sureflow/vendor), so every later build is deterministic and offline-safe
# instead of re-fetching from the internet on each rebuild.
set -eux
DEST=/srv/sureflow/splash
mkdir -p "$DEST"
command -v convert >/dev/null || apt-get install -y imagemagick

# background.png — wave artwork. Any resolution: the theme scales it to whatever mode
# the panel came up in, so the same file serves the legacy fbdev lanes and the modern ones.
curl -fL -o "$DEST/background.png" \\
  https://media.base44.com/images/public/6a42d5b340732607e237e3b7/3911a938a_generated_image.png

# logo.png — "SureFlow POS" wordmark, drawn bottom-right.
curl -fL -o "$DEST/logo.png" \\
  https://media.base44.com/images/public/6a42d5b340732607e237e3b7/835258157_generated_image.png

# dot.png — one muted-blue disc, reused for all eight cyclone spinner dots.
# Keep it small (roughly 16-24px square). If the spinner looks oversized on a lane,
# shrink THIS file rather than editing the script.
curl -fL -o "$DEST/dot.png" \\
  https://media.base44.com/images/public/6a42d5b340732607e237e3b7/69cfd8544_generated_image.png

# --- Normalize: force real PNG, then size each asset for the theme ---------
# background.png is scaled by the script at runtime, so 1024x768 simply matches
# the mode the legacy fbdev lanes come up in. logo.png and dot.png are NOT
# scaled by the script — these sizes are the ones the layout expects.
convert "$DEST/background.png" -strip -background "#131920" -flatten -resize 1024x768! "$DEST/background.tmp.png"
convert "$DEST/logo.png"       -strip -background "#131920" -flatten -resize 320x      "$DEST/logo.tmp.png"
convert "$DEST/dot.png"        -strip -background "#131920" -flatten -resize 20x20!    "$DEST/dot.tmp.png"
for f in background logo dot; do mv -f "$DEST/$f.tmp.png" "$DEST/$f.png"; done

# Sanity check — every file must report PNG magic (89 50 4e 47) and a sane size.
# A truncated download shows up here as a tiny or 0-byte file.
for f in background logo dot; do od -An -tx1 -N 8 "$DEST/$f.png"; done
identify "$DEST"/*.png
ls -l "$DEST"
`;

export const BOOT_SPLASH_STEP = {
  step_id: "pxe_boot_splash",
  label: "Add the SureFlow boot splash and system beeper",
  instructions: [
    "Plymouth owns the boot screen. It draws on the framebuffer from early initramfs through the NFS root mount and systemd targets, then hands the screen to the kiosk — so a lane shows the branded SureFlow splash instead of kernel text for the whole boot.",
    "The splash is the 4690 pattern: the wave artwork fills the screen, the SureFlow POS wordmark sits bottom-right, and a cyclone spinner over the line 'Terminal is being initialized' sits in the lower third. There is deliberately no progress bar and no streaming unit names — the spinner is the single 'working, don't touch it' cue an operator needs.",
    "Because the status line is fixed, ESC is now the technician's readout: press it on a lane to drop to the live kernel messages without changing the image. Keep that in the tech's habits — it is the only way to see where a slow boot is actually stuck.",
    "Both boot entries pass 'quiet splash' so the text scroll stays behind the splash. On a failure Plymouth drops to the text console by itself, so diagnostics are never lost.",
    "Plymouth needs a DRM device, so BOTH variants now run i915 KMS — nomodeset was REMOVED from the legacy profile. nomodeset stops KMS initialising, leaves no DRM device, and Plymouth then renders nothing but its flat fallback field (the 'grey splash') or drops straight to kernel text. The legacy entry pins the mode with video=1024x768 instead. The theme scales the artwork to whatever mode came up, so it fills a 4:3 panel either way.",
    "The lane image builder installs this theme and the three assets automatically — stage the assets once with the fetch script below, then rebuild. The manual chroot commands here remain the fallback and the explanation of what the builder does.",
    "Three image assets live in the theme directory: background.png (the wave artwork, any resolution — it is scaled at runtime), logo.png (the wordmark) and dot.png (one small muted-blue disc, reused for all eight spinner dots). A missing background.png leaves the flat dark gradient rather than a black screen.",
    "The motherboard speaker (pcspkr) covers the pre-POS phase, the one window where the POS cannot make a sound. It is a beeper: single square-wave tones, no audio playback. sureflow-beep plays a long rising two-tone (800Hz then 1200Hz, ~0.7s each) when the lane reaches the POS and a falling tone when the kiosk fails, so a ready lane and a dead lane are both audible from the floor.",
    "In-app sounds stay in the browser — the PC speaker is only for 'is the hardware alive'. Keep the two separate so a muted terminal still reports boot failures.",
    "Confirm the beeper exists per model before relying on it: the SurePOS 700 has the same onboard speaker IBM drove for 4690 alerts, but many modern boards (Elo EPS00E2 class) dropped the header. Where it is absent the beep calls fail silently and boot is unaffected.",
    "Drop the theme, script and beep helper into the driver-library/build path rather than hand-editing a live image — the read-only NFS root means a lane cannot keep its own copy, and a rebuild would lose it.",
  ],
  commands: [
    "# PREFERRED — stage the assets once, then let the builder bake the splash in",
    "sudo bash /root/sureflow-fetch-splash-assets.sh   # writes /srv/sureflow/splash/{background,logo,dot}.png",
    "ls -l /srv/sureflow/splash/                       # all three must be present, real PNGs",
    "sudo sureflow-build-lane-image both               # summary reports 'Boot splash: SureFlow splash applied'",
    "# --- FALLBACK: the manual per-image path (what the builder automates) ---",
    "for V in legacy modern; do sudo chroot /srv/sureflow/roots/sureflow-$V apt-get install -y --no-install-recommends plymouth plymouth-themes beep; done",
    "for V in legacy modern; do sudo install -d /srv/sureflow/roots/sureflow-$V/usr/share/plymouth/themes/sureflow; done",
    "# Drop in the three image assets — without background.png the splash falls back to a flat gradient",
    "for V in legacy modern; do sudo install -m 644 /srv/sureflow/splash/{background.png,logo.png,dot.png} /srv/sureflow/roots/sureflow-$V/usr/share/plymouth/themes/sureflow/; done",
    "for V in legacy modern; do sudo chroot /srv/sureflow/roots/sureflow-$V plymouth-set-default-theme -R sureflow; done",
    "# The splash must be in the initramfs or the first seconds stay black",
    "for V in legacy modern; do sudo chroot /srv/sureflow/roots/sureflow-$V update-initramfs -u -k all; done",
    "# Load the PC speaker module — minimal debootstrap roots often blacklist it",
    "for V in legacy modern; do sudo chroot /srv/sureflow/roots/sureflow-$V /bin/bash -c 'echo pcspkr > /etc/modules-load.d/sureflow-pcspkr.conf; rm -f /etc/modprobe.d/*pcspkr*blacklist*'; done",
    "sudo install -m 755 /dev/stdin /srv/sureflow/roots/sureflow-modern/usr/local/bin/sureflow-beep   # paste below, repeat for -legacy",
    "for V in legacy modern; do sudo chroot /srv/sureflow/roots/sureflow-$V systemctl enable sureflow-beep-ok; done",
  ],
  codeFiles: [
    { name: "fetch splash assets", code: SPLASH_ASSET_FETCH },
    { name: "sureflow.plymouth", code: PLYMOUTH_THEME },
    { name: "sureflow.script", code: PLYMOUTH_SCRIPT },
    { name: "sureflow-beep", code: BEEP_SCRIPT },
    { name: "sureflow-beep units", code: BEEP_UNITS },
    { name: "pxelinux splash (optional)", code: PXE_SPLASH_MENU },
  ],
  postInstructions: [
    "Reboot a lane: expect the pxelinux handoff, then the SureFlow splash — wave artwork, wordmark bottom-right, spinner turning over 'Terminal is being initialized' — then the POS, and a long rising two-tone chime as it lands.",
    "Screen black instead of the splash? The initramfs was not rebuilt after the theme install, or the framebuffer came up late — run update-initramfs -u -k all in the chroot and confirm 'splash' is on the lane's cmdline (cat /proc/cmdline).",
    "Dark gradient but no artwork? background.png did not make it into the theme directory inside the image — the theme is working, the asset is missing.",
    "Generic Debian spinner instead of the SureFlow splash? The build fell back because the staged assets were absent — read the 'Boot splash:' line on the build summary, run the fetch script to populate /srv/sureflow/splash, and rebuild.",
    "Spinner frozen while the boot clearly continues? The framebuffer is not taking refresh callbacks on that panel. Boot is unaffected, but the lane loses its 'alive' cue, so note the model and use the chime as the ready signal there.",
    "Spinner dots too large or too small for the panel? Resize dot.png and reinstall it — the script places the dots from the image's own dimensions, so nothing else has to change.",
    "Splash shows but no beep? Check the speaker exists: ls /dev/input/by-path | grep pcspkr on the lane. Nothing listed means the board has no beeper header — use the panel's own speaker or accept a silent boot.",
    "Press ESC during boot to fall back to the kernel messages without changing the image — the fastest way to debug a slow lane with the splash still installed.",
  ],
};