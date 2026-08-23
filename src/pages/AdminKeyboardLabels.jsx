import React, { useEffect, useState } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Printer, Tags } from "lucide-react";
import KeycapLabelSheet from "@/components/keyboard/KeycapLabelSheet";

export default function AdminKeyboardLabels() {
  const [layouts, setLayouts] = useState(null);
  const [functionKeys, setFunctionKeys] = useState([]);

  useEffect(() => {
    (async () => {
      const [all, keys] = await Promise.all([
        base44.entities.KeyboardLayout.list(),
        base44.entities.FunctionKey.list(),
      ]);
      setLayouts(all.filter((l) => l.active !== false));
      setFunctionKeys(keys);
    })();
  }, []);

  if (!layouts) {
    return <div className="p-6 text-sm text-gray-500">Loading keyboard layouts…</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <Tags className="h-5 w-5 text-gray-400" /> Keycap Label Sheet
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            One label block per active keyboard layout, sized to the real 19mm keycap. Print at 100%
            scale (no "fit to page"), cut along the dashed guides and stick each label onto its key.
          </p>
        </div>
        <Button onClick={() => window.print()} disabled={layouts.length === 0}>
          <Printer className="mr-1 h-4 w-4" /> Print Labels
        </Button>
      </div>

      {layouts.length === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 print:hidden">
          No active keyboard layouts saved yet — build one in the Visual Key Remapper first.
        </p>
      )}

      <div id="label-sheet" className="space-y-8 bg-white">
        {layouts.map((l) => (
          <KeycapLabelSheet key={l.id} layout={l} functionKeys={functionKeys} />
        ))}
      </div>
    </div>
  );
}