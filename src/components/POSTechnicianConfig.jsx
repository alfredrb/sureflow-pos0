import React, { useState } from "react";
import { RotateCcw, Headphones, ArrowLeftRight, Lock, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const FEATURE_META = [
  { key: "feature_returns", label: "Returns / Refunds", icon: RotateCcw, color: "text-purple-400" },
  { key: "feature_exchange", label: "Item Exchange", icon: ArrowLeftRight, color: "text-teal-400" },
  { key: "feature_customer_service", label: "Customer Service Mode", icon: Headphones, color: "text-amber-400" },
];

export default function POSTechnicianConfig({ registerFeatures, onUpdateFeatures }) {
  const [savingKey, setSavingKey] = useState(null);

  const handleToggle = async (key, v) => {
    setSavingKey(key);
    try {
      await onUpdateFeatures({ [key]: v });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="bg-[#111638] rounded-xl border border-slate-500/20 p-4 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-slate-400" />
        <p className="text-slate-300 text-xs uppercase tracking-wider font-bold">Register Feature Configuration</p>
      </div>
      <p className="text-slate-400/70 text-[10px] mb-3">Toggle which POS panels are enabled on this register. Changes save instantly — no need to open the Admin Panel.</p>
      <div className="space-y-2">
        {FEATURE_META.map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between bg-[#0a0e27] rounded-lg border border-slate-500/10 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-slate-200 text-xs font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {savingKey === key && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
              <Switch checked={!!registerFeatures?.[key]} onCheckedChange={(v) => handleToggle(key, v)} disabled={savingKey !== null} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}