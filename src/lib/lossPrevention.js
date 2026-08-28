import { Ban, TrendingUp, RotateCcw, ShieldCheck, Receipt, Award, UserCheck, DollarSign, AlertTriangle, Wallet } from "lucide-react";

// Every high-risk / override activity logged at the register, classified into a
// readable category. The "override" RegisterLog event_type actually covers many
// distinct actions (price override, ID verify, tax exempt, loyalty, supervisor
// auth) — we split them apart here so the workbench can toggle them individually.
export const LP_CATEGORIES = {
  voids: { label: "Voids", icon: Ban, badge: "bg-red-100 text-red-700", invType: "voids" },
  price_override: { label: "Price Override", icon: TrendingUp, badge: "bg-amber-100 text-amber-700", invType: "overrides" },
  supervisor_override: { label: "Supervisor Override", icon: UserCheck, badge: "bg-orange-100 text-orange-700", invType: "overrides" },
  override: { label: "Override", icon: UserCheck, badge: "bg-amber-100 text-amber-700", invType: "overrides" },
  id_verify: { label: "ID Verified", icon: ShieldCheck, badge: "bg-blue-100 text-blue-700", invType: "other" },
  tax_exempt: { label: "Tax Exempt", icon: Receipt, badge: "bg-emerald-100 text-emerald-700", invType: "other" },
  loyalty: { label: "Loyalty Linked", icon: Award, badge: "bg-sky-100 text-sky-700", invType: "other" },
  no_sale: { label: "No-Sale", icon: DollarSign, badge: "bg-yellow-100 text-yellow-700", invType: "no_sales" },
  refund: { label: "Refund", icon: RotateCcw, badge: "bg-purple-100 text-purple-700", invType: "refunds" },
  cash_request: { label: "Cash Request", icon: DollarSign, badge: "bg-indigo-100 text-indigo-700", invType: "other" },
  robbery: { label: "Robbery", icon: AlertTriangle, badge: "bg-rose-100 text-rose-700", invType: "other" },
  no_receipt_return: { label: "No-Receipt Return", icon: RotateCcw, badge: "bg-fuchsia-100 text-fuchsia-700", invType: "refunds" },
  manager_override_return: { label: "Manager Override Return", icon: UserCheck, badge: "bg-orange-100 text-orange-700", invType: "refunds" },
  // A drawer left standing open after a sale is the classic setup for a till skim,
  // which is why the register logs it as its own event rather than as a note.
  drawer_open: { label: "Drawer Left Open", icon: Wallet, badge: "bg-red-100 text-red-700", invType: "cash_short" },
};

// All categories the workbench lets you toggle on/off as high-risk.
export const LP_TOGGLEABLE = [
  "voids", "price_override", "supervisor_override", "override",
  "id_verify", "tax_exempt", "loyalty", "no_sale", "refund", "cash_request", "robbery", "no_receipt_return", "manager_override_return",
  "drawer_open",
];

export function classifyLogEvent(log) {
  if (log.event_type === "void") return "voids";
  if (log.event_type === "no_sale") return "no_sale";
  if (log.event_type === "cash_request") return "cash_request";
  if (log.event_type === "robbery") return "robbery";
  if (log.event_type === "drawer_open") return "drawer_open";
  if (log.event_type === "override") {
    const d = (log.detail || "").toLowerCase();
    if (d.startsWith("no-receipt return blocked")) return "no_receipt_return";
    if (d.startsWith("no-receipt return")) return "no_receipt_return";
    if (d.startsWith("manager override return")) return "manager_override_return";
    if (d.startsWith("id verified")) return "id_verify";
    if (d.startsWith("tax exempt")) return "tax_exempt";
    if (d.startsWith("loyalty")) return "loyalty";
    if (d.startsWith("price override")) return "price_override";
    if (log.override_operator_name) return "supervisor_override";
    return "override";
  }
  return null;
}

export function isLpEnabled(cat, disabledEvents) {
  return !(disabledEvents || []).includes(cat);
}