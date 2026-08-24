import React from "react";
import { Link } from "react-router-dom";
import { GitBranch, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import {
  UPDATER_GIT_SETUP,
  UPDATER_CODE,
  UPDATER_UNIT,
  UPDATER_HA_NOTES,
  UPDATER_VERIFY,
  UPDATER_STEPS,
} from "@/lib/relayCloudUpdater";

export default function CloudUpdateReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
          <GitBranch className="h-5 w-5 text-blue-600" /> Cloud-Pushed Updates
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          The replacement for the manual Relay Feature Update walkthrough. An admin pins a git ref on{" "}
          <Link to="/admin/controller-updates" className="text-blue-600 hover:underline">Controller Updates</Link>, and each
          store checks it out itself during its own nightly maintenance window — no technician on the box, no code pasted by
          hand. Install this once per controller and every later release is a cloud action.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs leading-relaxed text-blue-900">
            <span className="font-semibold">Why the controller pulls instead of the cloud pushing:</span> a store controller
            is a private LAN address behind the store router, so nothing can open a connection into it — the same constraint
            that made lane reboots a polled queue. The controller polls outbound, and the cloud only hands the job down once
            the nightly sweep has folded it into tonight's plan. That single rule is what stops a push landing mid-day.
          </p>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            Never delete the previous release directory or NFS root by hand. The automatic rollback is a symlink flip back
            onto them — remove them and a failed health gate becomes a site visit instead of a few seconds.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
        <p className="text-sm font-semibold text-gray-900">How a release reaches a store</p>
        <ol className="mt-3 space-y-3">
          {UPDATER_STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[10px] font-bold text-blue-600">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-800">{s.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <CodeBlock title="One-time setup — repo, deploy key, symlinked live app" filename="controller shell" code={UPDATER_GIT_SETUP} />
      <CodeBlock title="The updater — stage, swap, health gate, auto-rollback" filename="/opt/sureflow/bin/sureflow-updater" code={UPDATER_CODE} />
      <CodeBlock title="systemd service + timer (fires inside the window)" filename="/etc/systemd/system/sureflow-updater.{service,timer}" code={UPDATER_UNIT} />
      <CodeBlock title="HA stores — rolling order across the controller pair" filename="controller shell" code={UPDATER_HA_NOTES} />
      <CodeBlock title="Verify and roll back by hand" filename="controller shell" code={UPDATER_VERIFY} />
    </div>
  );
}