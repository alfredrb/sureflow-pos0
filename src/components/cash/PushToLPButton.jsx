import { Zap } from "lucide-react";

export default function PushToLPButton({ recordId, kind, pushedIds, pushingId, onPush }) {
  const id = `${kind}-${recordId}`;
  const pushed = pushedIds.has(id);
  return (
    <button
      onClick={onPush}
      disabled={pushed || pushingId === id}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
        pushed ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
      }`}
    >
      <Zap className="w-3.5 h-3.5" /> {pushed ? "Pushed" : pushingId === id ? "Pushing..." : "Push to LP"}
    </button>
  );
}