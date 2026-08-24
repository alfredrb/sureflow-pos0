import React from "react";
import { HardDrive, Layers } from "lucide-react";

export default function DiskLayoutTable({ title, subtitle, rows, tone }) {
  const Icon = tone === "ha" ? Layers : HardDrive;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex items-start gap-2 border-b border-gray-100 p-4">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-gray-500">{subtitle}</p>}
        </div>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wide text-gray-400">
            <th className="p-3 font-semibold">Partition</th>
            <th className="p-3 font-semibold">Size</th>
            <th className="p-3 font-semibold">Format</th>
            <th className="p-3 font-semibold">Mount</th>
            <th className="p-3 font-semibold">Why</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.part}>
              <td className="whitespace-nowrap p-3 align-top font-mono text-xs text-gray-900">{r.part}</td>
              <td className="whitespace-nowrap p-3 align-top text-xs text-gray-600">{r.size}</td>
              <td className="whitespace-nowrap p-3 align-top font-mono text-[11px] text-gray-600">{r.fs}</td>
              <td className="whitespace-nowrap p-3 align-top font-mono text-[11px] text-blue-700">{r.mount}</td>
              <td className="p-3 align-top text-xs leading-relaxed text-gray-500">{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}