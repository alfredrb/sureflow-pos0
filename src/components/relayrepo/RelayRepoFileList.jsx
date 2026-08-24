import React from "react";
import { FileCode2 } from "lucide-react";
import { RELAY_MODULES } from "@/lib/relayRepoFiles";

// The module list IS the deployment contract — server.js requires every one of these and
// dies on boot if one is missing, so it is worth showing plainly before a publish.
export default function RelayRepoFileList() {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <FileCode2 className="h-4 w-4" /> Relay modules published ({RELAY_MODULES.length})
      </p>
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {RELAY_MODULES.map((m) => (
          <div key={m.name} className="flex items-baseline justify-between gap-3 text-sm">
            <code className="font-mono text-gray-800">{m.name}</code>
            <span className="truncate text-right text-xs text-gray-500">{m.role}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-gray-200 pt-3 text-xs text-gray-500">
        Plus <code className="font-mono">package.json</code>, <code className="font-mono">.env.example</code>,{" "}
        <code className="font-mono">fetch-pos-dist.sh</code>, the ops scripts, the systemd unit and the README.
      </p>
    </div>
  );
}