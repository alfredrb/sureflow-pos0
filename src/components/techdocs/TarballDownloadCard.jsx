import React, { useState } from "react";
import { Download, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadControllerTarball } from "@/lib/controllerTarball";

// Download buttons for the installer bundle. The archive is built in the browser from the
// app's own modules at click time, so what a technician carries to a store is always the
// version this app is running — there is no stored copy to go stale.
export default function TarballDownloadCard({ store }) {
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState("");

  const grab = async (which, forStore) => {
    setBusy(which);
    setDone("");
    try {
      setDone(await downloadControllerTarball(forStore));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
          <Package className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Download the installer bundle</p>
          <p className="text-[11px] text-gray-400">sureflow-controller-*.tar.gz — extract, run ./install</p>
        </div>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-gray-600">
        Carries the wizard, the console menu and its login hook, and the lane agent for the diskless root. Built fresh
        from this app on every download, so the bundle and the fleet never disagree about what the installer does.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => grab("generic", null)}>
          {busy === "generic" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
          Generic bundle
        </Button>
        <Button size="sm" disabled={!!busy || !store} onClick={() => grab("store", store)}>
          {busy === "store" ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
          {store ? `Download for store ${store.store_number}` : "Select a store first"}
        </Button>
      </div>

      {done && <p className="mt-3 font-mono text-[11px] text-emerald-600">Downloaded {done}</p>}

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
        The store bundle adds a pre-seeded <span className="font-mono">controller.conf</span> so the wizard's prompts come
        up already filled in. The relay API key is left blank on purpose — generate it on that store's Relay Ops card and
        paste it at the prompt, so a key never travels inside a file that gets emailed around.
      </p>
    </div>
  );
}