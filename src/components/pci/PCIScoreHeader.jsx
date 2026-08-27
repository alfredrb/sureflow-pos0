import { ShieldCheck, ShieldAlert, TriangleAlert, ClipboardCheck } from "lucide-react";

const Tile = ({ icon: Icon, label, value, tone }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-1">
      <Icon className={`w-4 h-4 ${tone}`} />
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-2xl font-semibold text-gray-900">{value}</div>
  </div>
);

export default function PCIScoreHeader({ score, controlsAttested, controlsTotal, staleCount }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile icon={ShieldCheck} label="Checks passing" value={`${score.pass}/${score.total}`} tone="text-emerald-600" />
      <Tile icon={TriangleAlert} label="Needs review" value={score.warn} tone="text-amber-600" />
      <Tile icon={ShieldAlert} label="Failing" value={score.fail} tone="text-red-600" />
      <Tile icon={ClipboardCheck} label="Controls attested" value={`${controlsAttested}/${controlsTotal}`} tone="text-blue-600" />
      {staleCount > 0 && (
        <div className="col-span-2 lg:col-span-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
          {staleCount} control{staleCount === 1 ? "" : "s"} have no owner or have not been reviewed in over 12 months. An unowned or unreviewed control is treated as unevidenced in an assessment.
        </div>
      )}
    </div>
  );
}