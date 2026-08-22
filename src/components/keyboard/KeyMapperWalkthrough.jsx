import React, { useState } from "react";
import { ChevronDown, ChevronRight, ListOrdered } from "lucide-react";

// Step-by-step procedure for remapping a lane keyboard, in the order a technician
// actually works: identify the model, capture the real scancodes on the hardware,
// assign keycodes and POS functions, then push the generated map into the image.
const STEPS = [
  {
    title: "Confirm the keyboard model",
    body: "Read the model string off the label on the underside of the keyboard and put it in Keyboard Model above, exactly as it is entered on the register's hardware profile (Registers → hardware). The map is stored per model, so every lane on that model picks it up — a typo here means the map applies to nothing.",
  },
  {
    title: "Capture the scancodes on a lane",
    body: "On a booted lane, drop out of the kiosk to a console and run sudo evtest, choose the POS keyboard device, then press each function key once. evtest prints a scancode per key (e.g. 70045). Write them down in the same order as the on-screen grid — scancodes come from the hardware and must never be guessed.",
    code: "sudo evtest",
  },
  {
    title: "\"evtest: command not found\"? Install it into the image",
    body: "The diskless root is a minimal Debian build, so evtest is not present on older images — and the NFS root is read-only, so it cannot be installed from the lane. Add it to both images on the PXE controller, then reboot the lane and run the capture again. The image builder now installs evtest and kbd by default, so a rebuilt image already has both. If you cannot rebuild right now, the kbd package's showkey prints the same scancodes from a plain console (press Ctrl+C to exit; it exits on its own after 10 idle seconds).",
    code: "# On the CONTROLLER — add the capture tools to both images\nfor V in legacy modern; do sudo chroot /srv/nfs/sureflow-$V apt-get install -y --no-install-recommends evtest kbd; done\n\n# On the LANE, as an alternative to evtest\nsudo showkey --scancodes",
  },
  {
    title: "Enter each scancode into its slot",
    body: "Click a key in the grid to open the slot editor, then type the scancode you captured for that physical keycap. Paste it exactly as the tool printed it — showkey reports hex with a 0x prefix (0x3b) and the editor strips the prefix for you, because hwdb takes the bare hex. The amber 'no captured scancodes' warning clears as soon as the first one is entered. The Action Code key is locked on purpose — the POS depends on it.",
  },
  {
    title: "Reading the showkey output — press, release, and pairs",
    body: "Every byte comes in a press/release pair: the release is the press plus 0x80, so 0x3b 0xbb is ONE key and you enter 3b. Two bytes starting with 0xe0 are one extended key — 0xe0 0x48 0xe0 0xc8 is a single key entered as e048. Four bytes with no 0xe0 are TWO different keys landing on one line because they were pressed quickly (0x04 0x84 0x05 0x85 is key 04 and key 05, entered in separate slots). A press and its release can also split across two lines (0x0f then 0x8f) — still one key, 0f. Only ever enter the press byte(s); never a 0x80-and-up release code, and never an all-zero capture (the editor discards those).",
    code: "0x3b 0xbb            -> one key         -> 3b\n0x0f\n0x8f                 -> one key, split  -> 0f\n0xe0 0x48 0xe0 0xc8  -> one extended    -> e048\n0x04 0x84 0x05 0x85  -> TWO keys        -> 04 and 05",
  },
  {
    title: "showkey values are AT codes — confirm the device match",
    body: "showkey prints short AT set-1 codes (0x3b) while evtest prints the long USB HID value (70045). Both are valid hwdb keys, but they must match the device line at the top of the generated map: a short AT code applies to a keyboard presenting as PS/2 / AT, and the map's evdev:input:b0003v… line matches a USB device. If the keys still do nothing after the map is applied, run evtest once and use its values instead — that is the pairing the generated map is written for.",
  },
  {
    title: "Assign a keycode to each key",
    body: "Give every mapped key its own keycode (F1–F16, Backspace, Enter). This is what hwdb remaps the scancode to and what the browser sees. Two keys on the same keycode is flagged in red — fix it before saving, or one of the keys will fire the wrong action. F9 and F10 are reserved: F9 is Action Code and Ctrl+F10 is the silent robbery alarm.",
  },
  {
    title: "Point each key at a POS function",
    body: "In the slot editor, pick the function key the POS should run for that keycap (the numbered keys configured on the Function Keys page). Leave it unassigned for keys that only need to type — the numpad Clear and Enter caps are mapped to Backspace and Enter and need no function.",
  },
  {
    title: "Save the layout",
    body: "Press Save Layout. The map is written against the keyboard model and logged in the audit trail, and the Generated hwdb map panel updates to match what you just saved.",
  },
  {
    title: "Install the map into the diskless image",
    body: "Copy the generated hwdb map into the image on the store's PXE controller at /etc/udev/hwdb.d/70-sureflow-pos-keyboard.hwdb, then apply it. Reboot the lane afterwards — the NFS root is read-only, so the map only takes effect from the rebuilt image.",
    code: "sudo systemd-hwdb update && sudo udevadm trigger",
  },
  {
    title: "Verify on the lane",
    body: "Boot the lane and press each function key at the POS. Every keycap should run the action printed on it. If a key does nothing, its scancode was captured wrong; if it runs the wrong action, its keycode or function assignment is off.",
  },
];

export default function KeyMapperWalkthrough() {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <ListOrdered className="h-4 w-4 text-gray-400" />
        Step-by-step: remapping a lane keyboard
        <span className="ml-auto text-xs font-normal text-gray-400">{STEPS.length} steps</span>
      </button>

      {open && (
        <ol className="divide-y divide-gray-100">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.body}</p>
                {s.code && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-900 px-3 py-2 font-mono text-[11px] text-gray-100">
                    {s.code}
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}