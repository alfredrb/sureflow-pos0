import React from "react";
import { HardDrive, Network, ListChecks, Info } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import StepList from "@/components/techdocs/StepList";
import IpSchemeTable from "@/components/techdocs/IpSchemeTable";
import DiskLayoutTable from "@/components/techdocs/DiskLayoutTable";
import {
  IP_STANDARD,
  IP_STANDARD_RULES,
  DISK_PLAN,
  DEBIAN_INSTALL_ANSWERS,
  NIC_NETPLAN_STANDALONE,
  NIC_NETPLAN_HA,
  SWITCH_PORT_CONFIG,
  VERIFY_STEPS,
} from "@/lib/debianControllerBuild";

// Bare-metal Debian build for a store controller — what happens BEFORE the installer
// wizard runs. The wizard configures services; this configures the box.
export default function DebianControllerBuildGuide() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-2 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-semibold text-gray-900">Debian 12 controller build — disk, NICs and the fleet IP standard</p>
        </div>
        <p className="text-xs leading-relaxed text-gray-600">
          Everything on this page happens <em>before</em> the Controller Installer runs. The wizard configures services —
          dnsmasq, NFS, the relay, keepalived — and assumes the box is already installed, partitioned and addressed. Get
          the disk and the two NICs right here and the wizard is a five-minute formality; get them wrong and you will be
          chasing symptoms in the service layer that were never service problems.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-gray-600">
          The addresses below are the fleet standard, built around what the lab already runs:{" "}
          <span className="font-mono text-gray-900">10.0.40.10</span> for the PXE side and{" "}
          <span className="font-mono text-gray-900">10.0.25.12</span> for the relay/backend side. Every store uses the same
          last octets — only the store number differs.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">On keeping the lab's numbers</p>
        </div>
        <p className="text-xs leading-relaxed text-amber-800">
          Keep them. Whether the backend host is <span className="font-mono">.12</span> or <span className="font-mono">.10</span>{" "}
          matters far less than every store agreeing, and the lab's values are already deployed, documented and in the
          wizard's defaults — renumbering buys nothing and risks a store whose relay URL no longer resolves. The one thing
          worth adding is the convention below: reserve the <span className="font-mono">.50</span> VIPs on both VLANs even
          at single-controller stores, so a store can be given a second box later without renumbering a single lane,
          printer or relay URL.
        </p>
      </div>

      <IpSchemeTable plan={IP_STANDARD.pxe} tone="isolated" />
      <IpSchemeTable plan={IP_STANDARD.backend} tone="routed" />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Network className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Rules the scheme depends on</p>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-gray-600">
          {IP_STANDARD_RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <DiskLayoutTable
        title="Disk layout — standalone controller"
        subtitle={DISK_PLAN.target}
        rows={DISK_PLAN.standalone}
      />
      <DiskLayoutTable
        title="Disk layout — HA pair"
        subtitle="Same OS disk on both boxes. The difference is the second disk: it stays raw and belongs to DRBD."
        rows={DISK_PLAN.ha}
        tone="ha"
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-gray-900">Disk decisions worth not relitigating on site</p>
        <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-gray-600">
          {DISK_PLAN.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </div>

      <CodeBlock
        title="Debian 12 netinst — the choices that matter"
        filename="installer answers"
        note="Install from the backend NIC: it is the only one with a route out."
        code={DEBIAN_INSTALL_ANSWERS}
      />
      <CodeBlock
        title="Switch ports and VLANs"
        note="Do this before the controller build. A lane trunk whose native VLAN is not 40 is the most common 'PXE won't boot' cause."
        code={SWITCH_PORT_CONFIG}
      />
      <CodeBlock
        title="NIC configuration — standalone"
        filename="/etc/network/interfaces"
        code={NIC_NETPLAN_STANDALONE}
      />
      <CodeBlock
        title="NIC configuration — HA pair"
        filename="/etc/network/interfaces (both boxes)"
        note="The VIPs are never static here — keepalived adds them at runtime."
        code={NIC_NETPLAN_HA}
      />

      <StepList title="Verify before running the installer" icon={ListChecks} steps={VERIFY_STEPS} />
    </div>
  );
}