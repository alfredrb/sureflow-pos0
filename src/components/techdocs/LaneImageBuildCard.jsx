import React from "react";
import { HardDriveDownload } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { LANE_IMAGE_BUILD_SCRIPT, LANE_IMAGE_BUILD_NOTES } from "@/lib/laneImageBuilder";

export default function LaneImageBuildCard() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
            <HardDriveDownload className="h-4 w-4 text-sky-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Automated Lane Image Build</p>
            <p className="text-[11px] text-gray-400">
              sureflow-build-lane-image — a bootable diskless root with no manual image editing
            </p>
          </div>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-gray-600">
          Three layers, in order. <span className="font-semibold">Base</span> is the debootstrap root and the kiosk
          package set. <span className="font-semibold">Fleet</span> adds the kiosk launcher, the serial and printer
          bridges and the lane agent — without it a lane boots Debian but never opens the POS and reads as "never seen".{" "}
          <span className="font-semibold">Profiles</span> pulls this store's HardwareLibrary entries from the cloud and
          bakes in the scancode maps and touch calibration. Only the third layer is optional, and skipping it still
          leaves a bootable image.
        </p>
        <ul className="space-y-2 text-xs leading-relaxed text-gray-600">
          {LANE_IMAGE_BUILD_NOTES.map((note, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <CodeBlock
        title="Run it"
        filename="on the controller"
        note="Installed by the wizard and shipped in the tarball. Also on the console menu at Lanes > Build a lane image."
        code={`sudo sureflow-build-lane-image both      # or: legacy | modern
cat /srv/sureflow/.lane-image-summary   # what was built, and any warnings`}
      />

      <CodeBlock
        title="The builder"
        filename="/usr/local/sbin/sureflow-build-lane-image"
        note="Root only. Destructive by design — the existing root is removed first so every build is reproducible."
        code={LANE_IMAGE_BUILD_SCRIPT}
      />
    </div>
  );
}