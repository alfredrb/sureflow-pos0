import React from "react";

export default function StepList({ title, icon: Icon, steps }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-100 p-4">
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
        <p className="text-sm font-semibold text-gray-900">{title}</p>
      </div>
      <ol className="divide-y divide-gray-100">
        {steps.map((s, i) => (
          <li key={s.step} className="flex gap-3 p-4">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
              {i + 1}
            </span>
            <div>
              <p className="text-xs font-semibold text-gray-900">{s.step}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}