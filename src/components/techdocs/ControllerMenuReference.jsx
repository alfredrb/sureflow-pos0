import React from "react";
import { TerminalSquare, ShieldCheck } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import StepList from "@/components/techdocs/StepList";
import {
  CONTROLLER_MENU_SCRIPT,
  CONTROLLER_MENU_PROFILE,
  CONTROLLER_MENU_ITEMS,
} from "@/lib/controllerMenu";

// Reference for the console menu the controller installer lays down. Kept beside the
// installer docs because the two ship together — the wizard writes both files.
export default function ControllerMenuReference() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <TerminalSquare className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Controller Console Menu</p>
            <p className="text-[11px] text-gray-400">sureflow-menu — what an admin sees when they log into the box</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            The installer writes <span className="font-mono">/usr/local/bin/sureflow-menu</span> and a{" "}
            <span className="font-mono">/etc/profile.d</span> hook, so an SSH or console login lands in a whiptail menu
            instead of a bare shell. Exiting the menu still gives a normal shell, and non-interactive sessions (scp,
            rsync, the maintenance automations) are never trapped in it.
          </p>
          <p>
            It is a thin client on purpose. Every cloud action is a plain <span className="font-mono">curl</span> to the{" "}
            <span className="font-mono">relaySync</span> endpoint using the store API key already in{" "}
            <span className="font-mono">/etc/sureflow/controller.conf</span> — so the menu keeps working even when the
            local relay process is down, and the relay app needs no changes to gain a new menu item.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-900">Why operator management from the box is safe</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-emerald-800">
          <li>The relay API key is the only credential, and it belongs to exactly one store — the menu cannot see or change another store's operators.</li>
          <li>Operator writes stay admin-only at the data layer; relaySync performs them as service role after validating the key, so the restriction is enforced at the function boundary rather than bypassed.</li>
          <li>Every add, edit and remove writes an audit trail entry attributed to "Controller CLI (store NNN)", so a change made on the box is as traceable as one made in the admin panel.</li>
          <li>PINs are never echoed back into the audit trail — the diff records that the PIN changed, not what it changed to.</li>
          <li>Removing an operator does not remove their history: past transactions and time clock records are retained.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-sky-600" />
          <p className="text-sm font-semibold text-sky-900">Why the Lanes screen works the way it does</p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-sky-800">
          <li>Lanes are on the isolated PXE VLAN 40 and are NAT'd outbound only — nothing can open a connection into a lane, so there is no SSH and no direct probe. The menu says so plainly instead of offering an action that would time out.</li>
          <li>"Booted?" therefore comes from the lane agent's own outbound polls, which the relay stamps as it answers them. A lane showing "never seen" is powered off, still booting, or running a root without the agent.</li>
          <li>Reboots are queued by <span className="font-mono">register_id</span>, never by IP: the relay only ever sees the controller's address on a lane request, so an IP would be meaningless. The lane collects its own reboot within ~10s.</li>
          <li>A diskless lane holds no local state — republishing the root and rebooting <em>is</em> the update. There is no way to patch a running lane in place, which is why "republish the image" and "reboot all" are separate steps.</li>
          <li>Reboot all is batched with a wait between batches, for the same reason the nightly maintenance window staggers: releasing every lane at once hammers the NFS root and leaves the store dark.</li>
          <li>Every lane action is written to the audit trail as "Controller CLI (store NNN)", the same as operator changes.</li>
        </ul>
      </div>

      <StepList
        title="Menu items"
        icon={TerminalSquare}
        steps={CONTROLLER_MENU_ITEMS.map((m) => ({ step: m.item, detail: m.detail }))}
      />

      <CodeBlock
        title="The menu"
        filename="/usr/local/bin/sureflow-menu"
        note="Installed by the wizard. Needs jq and whiptail, both in the installer's package list."
        code={CONTROLLER_MENU_SCRIPT}
      />
      <CodeBlock
        title="Login hook"
        filename="/etc/profile.d/sureflow-menu.sh"
        note="Interactive shells only — guarded so a remote command or file copy is never swallowed by the menu."
        code={CONTROLLER_MENU_PROFILE}
      />
    </div>
  );
}