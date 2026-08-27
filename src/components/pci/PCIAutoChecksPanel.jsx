import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const TONE = {
  pass: { icon: CheckCircle2, cls: "text-emerald-600", row: "border-l-emerald-500" },
  warn: { icon: AlertTriangle, cls: "text-amber-600", row: "border-l-amber-500" },
  fail: { icon: XCircle, cls: "text-red-600", row: "border-l-red-500" },
};

export default function PCIAutoChecksPanel({ checks }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Automated checks</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Measured from live data every time this page loads. These cannot be marked compliant by hand — fix the underlying setting and the check clears itself.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {checks.map((c) => {
          const t = TONE[c.status];
          const Icon = t.icon;
          return (
            <div key={c.id} className={`px-4 py-3 border-l-4 ${t.row}`}>
              <div className="flex items-start gap-2">
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${t.cls}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">REQ {c.requirement}</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{c.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}