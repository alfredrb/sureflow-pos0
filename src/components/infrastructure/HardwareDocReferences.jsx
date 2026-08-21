import React from "react";
import { FileText, ExternalLink } from "lucide-react";
import { HARDWARE_DOC_REFERENCES } from "@/lib/hardwareFleetGuide";

// Vendor service manuals for the terminal fleet, so a port or connector question
// is answered from the manual rather than from memory.
export default function HardwareDocReferences() {
  return (
    <div className="border-t border-gray-100 bg-gray-50/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-gray-500" />
        <p className="text-xs font-semibold text-gray-900">Vendor service manuals</p>
      </div>
      <ul className="space-y-2.5">
        {HARDWARE_DOC_REFERENCES.map((d) => (
          <li key={d.url}>
            <a
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1.5 text-xs font-medium text-blue-600 hover:underline"
            >
              <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              {d.label}
            </a>
            <p className="pl-[18px] text-[11px] leading-relaxed text-gray-500">{d.covers}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}