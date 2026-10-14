import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Video, ExternalLink, Paperclip, Loader2 } from "lucide-react";
import { loadFootageTargets, buildFootageUrl, logFootageView } from "@/lib/cctvFootage";

// "Footage" action for any LP row that has a register and a timestamp. Lists the
// Blue Iris cameras mapped to that register and opens each at the event's moment.
// onAttach (optional) adds the camera link to an investigation as evidence.
export default function CctvFootageButton({ registerId, storeId, timestamp, context = "", onAttach }) {
  const [state, setState] = useState(null);

  const load = async (open) => {
    if (!open || state) return;
    setState({ loading: true });
    setState(await loadFootageTargets({ storeId, registerId }));
  };

  const view = (camera) => {
    logFootageView({ store: state.store, camera, registerId, timestamp, context });
    window.open(buildFootageUrl(state.store, camera, timestamp), "_blank", "noopener");
  };

  if (!registerId || !timestamp) return null;

  return (
    <Popover onOpenChange={load}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          <Video className="w-3.5 h-3.5" /> Footage
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="text-xs font-semibold text-gray-900">CCTV · {registerId}</p>
        <p className="text-[11px] text-gray-400 mb-2">{new Date(timestamp).toLocaleString()}</p>
        {(!state || state.loading) && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        {state?.error && <p className="text-xs text-amber-700">{state.error} Set it up under Stores.</p>}
        {state?.cameras?.map(cam => (
          <div key={cam} className="flex items-center justify-between py-1">
            <span className="text-sm font-mono text-gray-700">{cam}</span>
            <div className="flex gap-1">
              <button onClick={() => view(cam)} title="Open in Blue Iris" className="p-1 text-gray-500 hover:text-blue-600"><ExternalLink className="w-4 h-4" /></button>
              {onAttach && (
                <button title="Attach to investigation" className="p-1 text-gray-500 hover:text-amber-600"
                  onClick={() => onAttach({ type: "cctv", ref: cam, detail: `Blue Iris ${cam} · ${registerId}${context ? ` · ${context}` : ""}`, date: new Date(timestamp).toISOString(), file_url: buildFootageUrl(state.store, cam, timestamp) })}>
                  <Paperclip className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}