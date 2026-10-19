import { ShoppingCart, RotateCcw, Headphones, ArrowLeftRight, Wrench, Users } from "lucide-react";

// Lane mode tabs shown in the POS top bar, gated by the register's enabled features.
export function buildModeTabs(registerFeatures, operator, diagnosticsMode) {
  return [
    { id: "sale", label: "Sale", icon: ShoppingCart, activeColor: "bg-blue-600 text-white", inactiveColor: "bg-[#0a0e27] text-blue-300/50 border border-blue-500/10 hover:border-blue-500/30" },
    ...(registerFeatures.feature_returns ? [{ id: "returns", label: "Returns", icon: RotateCcw, activeColor: "bg-purple-600 text-white", inactiveColor: "bg-[#0a0e27] text-purple-300/50 border border-purple-500/10 hover:border-purple-500/30" }] : []),
    ...(registerFeatures.feature_exchange ? [{ id: "exchange", label: "Exchange", icon: ArrowLeftRight, activeColor: "bg-teal-600 text-white", inactiveColor: "bg-[#0a0e27] text-teal-300/50 border border-teal-500/10 hover:border-teal-500/30" }] : []),
    ...(registerFeatures.feature_customer_service ? [{ id: "cs", label: "Customer Service", icon: Headphones, activeColor: "bg-amber-600 text-white", inactiveColor: "bg-[#0a0e27] text-amber-300/50 border border-amber-500/10 hover:border-amber-500/30" }] : []),
    ...(registerFeatures.feature_attendant ? [{ id: "sco", label: "Self-Checkout", icon: Users, activeColor: "bg-emerald-600 text-white", inactiveColor: "bg-[#0a0e27] text-emerald-300/50 border border-emerald-500/10 hover:border-emerald-500/30" }] : []),
    ...((operator?.role === "technician" || diagnosticsMode) ? [{ id: "diagnostics", label: "Diagnostics", icon: Wrench, activeColor: "bg-slate-600 text-white", inactiveColor: "bg-[#0a0e27] text-slate-300/50 border border-slate-500/10 hover:border-slate-500/30" }] : []),
  ];
}