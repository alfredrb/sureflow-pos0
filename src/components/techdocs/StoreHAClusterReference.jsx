import React, { useState } from "react";
import { Layers, AlertTriangle, ShieldCheck, ListChecks, Wrench } from "lucide-react";
import { Input } from "@/components/ui/input";
import CodeBlock from "@/components/techdocs/CodeBlock";
import StepList from "@/components/techdocs/StepList";
import {
  haKeepalivedConf,
  haDrbdResource,
  haRoleScript,
  haNfsExports,
  haDhcpSnippet,
  HA_CHECK_SCRIPT,
  HA_RELAY_UNIT,
  HA_ENV_NOTE,
  HA_BUILD_STEPS,
  HA_VALIDATION_STEPS,
} from "@/lib/storeHaCluster";

export default function StoreHAClusterReference() {
  const [store, setStore] = useState({
    store_number: "001",
    controller_vip: "192.168.1.50",
    primary_controller_host: "192.168.1.51",
    secondary_controller_host: "192.168.1.52",
  });
  const set = (k) => (e) => setStore((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <Layers className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Redundant Store-Local Stack</p>
            <p className="text-[11px] text-gray-400">Two controller boxes · PXE + NFS + Relay on each · DRBD mirror · floating VIP</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            This is the 4690 master/backup store controller pair translated onto commodity hardware. Each store gets two
            boxes and <em>both roles run on both boxes</em> — the PXE/TFTP/DHCP boot server with the NFS diskless root,
            and the SureFlow Local Relay. There is no third VM: a 4690 store controller was the boot server and the
            application host on one machine, and splitting them here would mean four boxes per store to get the same
            redundancy two already provide.
          </p>
          <p>
            The diskless root, TFTP tree and the relay's database sit on a DRBD device mirrored synchronously between
            the pair, and keepalived floats one VIP in front. Lanes PXE boot from the VIP and the cloud polls the VIP, so
            a promotion is invisible to both — nothing is re-addressed and no key is rotated.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">What this does not fix: running lanes</p>
        </div>
        <p className="text-xs leading-relaxed text-amber-800">
          The IBM terminals in this fleet have no drive backplane, so there is no local image cache and a lane's root
          filesystem lives entirely on the controller. A lane that is mid-transaction when the acting primary dies will
          hang on its next NFS access — the pair cannot prevent that. What the pair buys is that the lane
          <strong> recovers on reboot</strong> and every other lane keeps booting, so a controller death no longer takes
          the store dark. Treat the hang as documented behavior, not a defect.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-900">Two rules that cause most failed builds</p>
        </div>
        <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-emerald-800">
          <li>
            Never <span className="font-mono">systemctl enable</span> the relay, NFS, TFTP or DHCP. The keepalived role
            script owns them. Enabled units run the relay on both boxes and every cloud sync happens twice.
          </li>
          <li>
            Point <span className="font-mono">next-server</span>, <span className="font-mono">nfsroot=</span> and the
            store's Relay URL at the VIP. Any one of them left on a box address means the store fails over on paper only.
          </li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wrench className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Generate for a store</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <p className="mb-1 text-[11px] font-medium text-gray-500">Store #</p>
            <Input value={store.store_number} onChange={set("store_number")} className="h-8 font-mono text-xs" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-gray-500">Floating VIP</p>
            <Input value={store.controller_vip} onChange={set("controller_vip")} className="h-8 font-mono text-xs" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-gray-500">Primary (ctrl-a)</p>
            <Input value={store.primary_controller_host} onChange={set("primary_controller_host")} className="h-8 font-mono text-xs" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-gray-500">Secondary (ctrl-b)</p>
            <Input value={store.secondary_controller_host} onChange={set("secondary_controller_host")} className="h-8 font-mono text-xs" />
          </div>
        </div>
      </div>

      <CodeBlock
        title="keepalived — primary controller"
        filename="/etc/keepalived/keepalived.conf (ctrl-a)"
        note="The health script sheds priority rather than hard-failing, so a flapping relay hands the VIP over cleanly instead of both boxes fighting for it."
        code={haKeepalivedConf(store, "primary")}
      />
      <CodeBlock
        title="keepalived — secondary controller"
        filename="/etc/keepalived/keepalived.conf (ctrl-b)"
        note="Identical apart from state, priority and the swapped unicast addresses. virtual_router_id and auth_pass must match exactly or the pair never sees each other."
        code={haKeepalivedConf(store, "secondary")}
      />
      <CodeBlock
        title="DRBD resource — mirrored boot root and relay database"
        filename="/etc/drbd.d/sfroot.res"
        note="Protocol C is synchronous on purpose: an offline sale committed on the acting primary is already on the standby before the POS is told it saved. after-sb-2pri disconnect deliberately refuses to auto-resolve a real split brain."
        code={haDrbdResource(store)}
      />
      <CodeBlock
        title="Role script — the whole promotion sequence"
        filename="/usr/local/bin/sureflow-ha-role"
        note="Order is load-bearing. DRBD primary and the mount must exist before nfs-kernel-server starts, otherwise lanes get an empty export and hang exactly as if the box were dead."
        code={haRoleScript(store)}
      />
      <CodeBlock
        title="Health probe scored by keepalived"
        filename="/usr/local/bin/sureflow-ha-check"
        note="Checks that the relay actually answers, that DRBD is Connected, and that the export is mounted. A box serving lanes from an unmirrored root is unhealthy even though everything looks 'active'."
        code={HA_CHECK_SCRIPT}
      />
      <CodeBlock
        title="NFS exports"
        filename="/etc/exports (both controllers)"
        note="no_root_squash is required — the diskless root is mounted as root by the lane kernel."
        code={haNfsExports(store)}
      />
      <CodeBlock
        title="DHCP / PXE next-server"
        filename="/etc/dhcp/dhcpd.conf (both controllers)"
        code={haDhcpSnippet(store)}
      />
      <CodeBlock
        title="Relay unit — never enabled"
        filename="/etc/systemd/system/sureflow-relay.service"
        note={HA_ENV_NOTE}
        code={HA_RELAY_UNIT}
      />

      <StepList title="Build order" icon={ListChecks} steps={HA_BUILD_STEPS} />
      <StepList title="Failover validation" icon={ShieldCheck} steps={HA_VALIDATION_STEPS} />
    </div>
  );
}