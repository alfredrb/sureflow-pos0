import React from "react";
import { MoonStar, ShieldCheck } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import StepList from "@/components/techdocs/StepList";
import {
  RELAY_LANE_MAINTENANCE_CODE,
  RELAY_LANE_MAINTENANCE_ROUTES_CODE,
  RELAY_LANE_MAINTENANCE_ENV,
  RELAY_LANE_MAINTENANCE_VERIFY,
  LANE_MAINTENANCE_STEPS,
} from "@/lib/laneMaintenanceRelay";

export default function LaneMaintenanceReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <MoonStar className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Nightly Lane Reboot &amp; Update Window</p>
            <p className="text-[11px] text-gray-400">The 4690 midnight cycle, rebuilt for diskless lanes</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            4690 pushed a new image down to every lane. SureFlow lanes are NFS-root diskless, so the reboot <em>is</em>{" "}
            the update — replace the one shared root on the controller and every lane picks it up on next boot, with no
            per-lane work at all.
          </p>
          <p>
            Every hop is outbound, because nothing can be reached inbound: the cloud cannot open a connection to the
            store LAN, and the relay cannot reach a lane across the PXE VLAN. So the cloud only <em>plans</em> tasks, the
            relay claims them, the relay queues a local reboot, and the lane's own agent collects it and reboots itself.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-900">Never reboot a lane mid-transaction</p>
        </div>
        <p className="text-xs leading-relaxed text-emerald-800">
          A lane with a parked (suspended) sale, an operator still clocked in, or a paused / maintenance flag is planned
          as <span className="font-mono">deferred</span> and gets a second chance on the retry pass. Anything still busy
          at the cutoff is marked <span className="font-mono">skipped</span> and deliberately left alone — the sweep
          never forces a lane down. Same principle as the auto-clock-out sweep skipping overnight shifts.
        </p>
      </div>

      <StepList title="Bring-up" icon={MoonStar} steps={LANE_MAINTENANCE_STEPS} />

      <CodeBlock
        title="Relay module — claim, carry out, report"
        filename="/opt/sureflow-relay/laneMaintenance.js"
        note="Reuses the existing laneReboot queue, so a maintenance reboot and an admin-issued reboot travel the identical path to the lane."
        code={RELAY_LANE_MAINTENANCE_CODE}
      />
      <CodeBlock
        title="server.js patch — poller and manual trigger"
        filename="/opt/sureflow-relay/server.js"
        note="Mount above the SPA catch-all, or the routes fall through to index.html and return HTML instead of JSON."
        code={RELAY_LANE_MAINTENANCE_ROUTES_CODE}
      />
      <CodeBlock
        title="Relay environment"
        filename="/opt/sureflow-relay/.env"
        note="No inline comments — a trailing '# ...' becomes part of the value on this file."
        code={RELAY_LANE_MAINTENANCE_ENV}
      />
      <CodeBlock
        title="Verification"
        filename="on the relay, then on a lane"
        code={RELAY_LANE_MAINTENANCE_VERIFY}
      />
    </div>
  );
}