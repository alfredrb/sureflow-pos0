import React, { useState } from "react";
import { TERMINAL_PORT_MAPS, PORT_KINDS } from "@/lib/terminalPortMap";

// Rear-panel diagram + wiring table for one terminal model.
function ModelPanel({ map }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{map.model}</p>
        <p className="text-[11px] text-gray-400">{map.subtitle}</p>
      </div>

      {/* Rear panel diagram */}
      <div className="rounded-xl bg-gray-900 p-3">
        <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2">Rear panel</p>
        <div className="flex flex-wrap gap-1.5">
          {map.ports.map((p) => (
            <div key={p.id} title={p.device} className={`rounded-md border px-2 py-1.5 min-w-[64px] text-center ${PORT_KINDS[p.kind].swatch}`}>
              <p className="text-[10px] font-bold font-mono leading-none">{p.label}</p>
              <p className="text-[8px] opacity-70 mt-0.5">{p.volts}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wiring table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-gray-400 uppercase tracking-wider text-[9px]">
              <th className="text-left font-semibold py-1.5 pr-2">Port</th>
              <th className="text-left font-semibold py-1.5 pr-2">Type</th>
              <th className="text-left font-semibold py-1.5 pr-2">Device</th>
              <th className="text-left font-semibold py-1.5 pr-2">Device node</th>
              <th className="text-left font-semibold py-1.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {map.ports.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 align-top">
                <td className="py-1.5 pr-2 font-mono font-semibold text-gray-800 whitespace-nowrap">{p.label}</td>
                <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{PORT_KINDS[p.kind].label}</td>
                <td className="py-1.5 pr-2 text-gray-800">{p.device}</td>
                <td className="py-1.5 pr-2 font-mono text-gray-500">{p.node}</td>
                <td className="py-1.5 text-gray-500">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Per-model port reference: which peripheral plugs into which rear-panel port,
// and the device node it ends up on inside the diskless image.
export default function TerminalPortMap() {
  const [model, setModel] = useState(TERMINAL_PORT_MAPS[0].model);
  const active = TERMINAL_PORT_MAPS.find((m) => m.model === model);

  return (
    <div className="px-5 py-4 space-y-3 bg-gray-50/60 border-b border-gray-100">
      <div className="flex flex-wrap items-center gap-2">
        {TERMINAL_PORT_MAPS.map((m) => (
          <button
            key={m.model}
            onClick={() => setModel(m.model)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              model === m.model ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {m.model}
          </button>
        ))}
      </div>

      <ModelPanel map={active} />

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        {Object.entries(PORT_KINDS).map(([k, v]) => (
          <span key={k} className={`text-[9px] px-1.5 py-0.5 rounded border ${v.swatch}`}>{v.label}</span>
        ))}
      </div>
    </div>
  );
}