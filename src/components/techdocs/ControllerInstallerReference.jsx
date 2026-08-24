import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wand2, Store as StoreIcon, AlertTriangle } from "lucide-react";
import CodeBlock from "@/components/techdocs/CodeBlock";
import StepList from "@/components/techdocs/StepList";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  CONTROLLER_INSTALL_STEPS,
  CONTROLLER_INSTALL_SCRIPT,
  CONTROLLER_INSTALL_FETCH,
  buildStoreInstallSheet,
} from "@/lib/controllerInstaller";

export default function ControllerInstallerReference() {
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState("");

  useEffect(() => {
    base44.entities.Store.filter({ status: "active" }).then((rows) => {
      setStores(rows);
      if (rows.length) setStoreId(rows[0].store_number);
    });
  }, []);

  const store = stores.find((s) => s.store_number === storeId);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
            <Wand2 className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Controller Install Wizard</p>
            <p className="text-[11px] text-gray-400">sureflow-controller-install — a fresh Debian box to a working store controller</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            The PXE Controller, Relay Deployment and Controller Redundancy sections describe every file by hand. This
            wizard asks the six things that cannot be derived and writes those same files, so a store build does not
            depend on a technician reading four documents in the right order.
          </p>
          <p>
            It is deliberately re-runnable: answers are saved to{" "}
            <span className="font-mono">/etc/sureflow/controller.conf</span> and returned as defaults, so a standalone
            controller becomes half of an HA pair by running it again with role=primary.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">What the wizard does not do</p>
        </div>
        <p className="text-xs leading-relaxed text-amber-800">
          It provisions the platform, not the payload. Deploying the relay app into{" "}
          <span className="font-mono">/srv/sureflow/relay</span>, staging a lane root under{" "}
          <span className="font-mono">/srv/sureflow/roots</span>, and bringing up DRBD replication are still done from
          their own sections — the wizard's summary screen tells you which of those is outstanding.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <StoreIcon className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Values for this store</p>
        </div>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger className="mb-3 max-w-sm">
            <SelectValue placeholder="Select a store" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.store_number}>
                #{s.store_number} — {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {store ? (
          <CodeBlock
            title="Answer sheet"
            filename={`store ${store.store_number}`}
            note="Read these off this card on site, not off another store's."
            code={buildStoreInstallSheet(store)}
          />
        ) : (
          <p className="text-xs text-gray-400">No active stores yet — add one under Registers to generate an answer sheet.</p>
        )}
      </div>

      <StepList title="Build sequence" icon={Wand2} steps={CONTROLLER_INSTALL_STEPS} />

      <CodeBlock
        title="Getting the wizard onto the box"
        filename="on the controller"
        code={CONTROLLER_INSTALL_FETCH}
      />
      <CodeBlock
        title="The installer"
        filename="/usr/local/sbin/sureflow-controller-install"
        note="Root only. Keeps its answers in /etc/sureflow/controller.conf at mode 600 — the relay API key is in there."
        code={CONTROLLER_INSTALL_SCRIPT}
      />
    </div>
  );
}