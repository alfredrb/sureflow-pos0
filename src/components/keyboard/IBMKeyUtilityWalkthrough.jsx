import React, { useState } from "react";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";

// Bench procedure for writing a code into a dead key position on an IBM modular POS
// keyboard, then bringing that key back into the POS. Ordered the way a technician
// actually works it: prove it is firmware, back up, write, verify, then map.
const STEPS = [
  {
    title: "Prove it is firmware, not mapping",
    body: "On the lane, run evtest and press the suspect key. If evtest prints a line you cannot name, stop here — that is an ordinary mapping job, do it in the remapper above. If evtest prints nothing at all for that key while its neighbours print normally, the keyboard is not sending anything and only the firmware key table can fix it. Confirm the key is not simply dead by pressing it hard once and checking for any line at all.",
    code: "sudo evtest    # pick the POS keyboard, press the suspect key",
  },
  {
    title: "Check IBM's factory keycode table",
    body: "Open Modular67KeyKeyboardKeycodes.pdf from the links above and find the position that is silent. IBM ships several positions unassigned, and this tells you whether yours is one of them (expected, fixable) or should have had a code all along (which points at a damaged keyboard instead). Note what code the neighbouring positions use — you want the new code to sit in the same family.",
  },
  {
    title: "Do this on a bench PC, never on a lane",
    body: "The utility rewrites the keyboard's controller and needs to install drivers and hold the device exclusively. The diskless root is read-only and mounted from NFS, so the utility cannot install there, and a failed write on a live lane takes the register out of service. Pull the keyboard, take it to a bench machine, and put a spare keyboard on the lane meanwhile.",
  },
  {
    title: "Pick the right build and unpack it",
    body: "On a Windows bench machine use mkeyutil64-fw351.zip. On Linux use mkeyutilsles11v36-fw362a.zip (SLES 11); fall back to the Novell Linux Desktop 9 build only if the SLES binaries refuse to run. Each archive holds the utility, the matching firmware level, and IBM's readme — read the readme, because it names the exact install command for that level.",
    code: "unzip mkeyutil64-fw351.zip -d mkeyutil && cd mkeyutil",
  },
  {
    title: "Install the utility and connect the keyboard",
    body: "Run the installer from the archive, then plug the POS keyboard directly into the bench machine — no hub, no KVM, no dock, since both add a layer that hides the keyboard's control interface. Start the utility and confirm it lists the keyboard with a model and firmware level before touching anything.",
  },
  {
    title: "Read and SAVE the current key table first",
    body: "Use the utility's read/retrieve function and save the table to a file named for the keyboard's serial number. This is your undo — if a write goes wrong or the new layout is worse, loading this file puts the keyboard back exactly as it arrived. Keep the file with the lane toolkit records.",
  },
  {
    title: "Assign a code to the dead position",
    body: "In the utility, select the silent position and give it a scancode. Choose one that is not already used elsewhere on that keyboard, and stay off the codes SureFlow reserves: F9 is the Action Code key and Ctrl+F10 is the silent robbery alarm, so never point a new position at either. If the utility offers a firmware update at a higher level than the keyboard reports, take it — older controllers reject the current table format.",
  },
  {
    title: "Write the table and power-cycle the keyboard",
    body: "Write the table and wait for the utility to report success without unplugging anything — interrupting a write can leave the controller unresponsive. Then unplug the keyboard for about ten seconds and plug it back in; the new table only takes effect after the controller restarts.",
  },
  {
    title: "Verify on the bench before it goes back",
    body: "With the keyboard back on the bench machine, press the repaired key and confirm the machine sees a keypress, then press every other function key to be sure the write did not disturb a position that was already working. Only then refit the keyboard to the lane.",
  },
  {
    title: "Capture the new code on the lane",
    body: "Boot the lane and run evtest again on the repaired key. It should now print a scancode — this is the value the remapper needs, and it must be read from the hardware rather than assumed from what you typed into the utility.",
    code: "sudo evtest",
  },
  {
    title: "Map it in the remapper and install the map",
    body: "Back on this page, open the slot for that keycap, enter the captured scancode, give it a keycode no other slot uses, pick the POS function it should run, and save. Then copy the generated hwdb map into the image on the PXE controller and apply it, and reboot the lane so the read-only root picks it up.",
    code: "sudo systemd-hwdb update && sudo udevadm trigger",
  },
  {
    title: "Record the firmware level on the register",
    body: "Put the keyboard model and the firmware level you wrote into the register's hardware profile notes. The key table lives in the keyboard, so it travels with the physical unit and survives every image rebuild — which also means a keyboard swapped between lanes carries this fix with it, and a replacement keyboard out of stores will need the same work.",
  },
];

export default function IBMKeyUtilityWalkthrough() {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-gray-100"
      >
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <Wrench className="h-4 w-4 text-gray-400" />
        Step-by-step: reviving a key that sends nothing (IBM Keyboard Utility)
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