import { Button } from "@/components/ui/button";
import { Clock, User } from "lucide-react";
import { CONTROL_STATUS_LABELS, controlIsStale } from "@/lib/pciCompliance";

const BADGE = {
  compliant: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-blue-100 text-blue-800",
  not_compliant: "bg-red-100 text-red-800",
  not_applicable: "bg-gray-100 text-gray-700",
};

export default function PCIControlTable({ controls, checks, onEdit }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">The 12 requirements</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Policy, physical and vendor controls cannot be measured from inside the app, so each one is owned by a named person, reviewed at least yearly and evidenced here.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {controls.map((c) => {
          const stale = controlIsStale(c);
          const related = checks.filter((k) => k.requirement === c.requirement);
          const failing = related.filter((k) => k.status === "fail").length;
          return (
            <div key={c.id} className="px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-900 text-white font-mono">REQ {c.requirement}</span>
                    <span className="text-sm font-medium text-gray-900">{c.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${BADGE[c.status] || BADGE.in_progress}`}>
                      {CONTROL_STATUS_LABELS[c.status] || c.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{c.description}</p>
                  {c.evidence_notes && <p className="text-xs text-gray-500 mt-1 italic">Evidence: {c.evidence_notes}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />{c.owner_name || <span className="text-amber-700">no owner</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {c.last_reviewed ? `reviewed ${c.last_reviewed}` : <span className="text-amber-700">never reviewed</span>}
                    </span>
                    {stale && <span className="text-amber-700">needs review</span>}
                    {failing > 0 && <span className="text-red-700">{failing} automated check failing</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => onEdit(c)} className="shrink-0">Attest</Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}