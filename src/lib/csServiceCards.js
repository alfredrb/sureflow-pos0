// Customer Service desk layout: the service cards and the actions inside them.
// One definition drives the POS panel, the Recently Used row, and the admin
// visibility toggles, so adding a service is a single entry here.

export const CS_SERVICE_CARDS = [
  {
    id: "gift_cards",
    label: "Gift Cards",
    icon: "CreditCard",
    accent: "emerald",
    actions: [
      { id: "gc_sell", label: "Sell Card" },
      { id: "gc_balance", label: "Balance Check" },
      { id: "gc_reload", label: "Reload / Add Value" },
      { id: "gc_history", label: "Card History" },
      { id: "gc_lost", label: "Lost / Stolen" },
      { id: "gc_cashout", label: "Cash Out", requiresManager: true },
    ],
  },
  {
    id: "loyalty",
    label: "Loyalty",
    icon: "Award",
    accent: "sky",
    actions: [
      { id: "loy_lookup", label: "Lookup Member" },
      { id: "loy_signup", label: "Sign Up" },
    ],
  },
  {
    id: "returns",
    label: "Returns & Exchanges",
    icon: "RotateCcw",
    accent: "fuchsia",
    actions: [
      { id: "ret_no_receipt", label: "No-Receipt Return" },
      { id: "ret_price_match", label: "Price Match" },
    ],
  },
  {
    id: "checks",
    label: "Checks",
    icon: "Banknote",
    accent: "amber",
    actions: [
      { id: "chk_cash", label: "Cash a Check", requiresManager: true },
    ],
  },
  {
    id: "receipts",
    label: "Receipts",
    icon: "Receipt",
    accent: "teal",
    actions: [
      { id: "rec_gift", label: "Gift Receipt" },
    ],
  },
  {
    id: "customer",
    label: "Customer",
    icon: "Users",
    accent: "indigo",
    actions: [
      { id: "cus_history", label: "Purchase History" },
      { id: "cus_raincheck", label: "Rain Check" },
    ],
  },
];

export const CS_ACCENTS = {
  emerald: { text: "text-emerald-300", border: "border-emerald-500/20", chip: "bg-emerald-600/80 hover:bg-emerald-500", icon: "text-emerald-400" },
  sky: { text: "text-sky-300", border: "border-sky-500/20", chip: "bg-sky-600/80 hover:bg-sky-500", icon: "text-sky-400" },
  fuchsia: { text: "text-fuchsia-300", border: "border-fuchsia-500/20", chip: "bg-fuchsia-600/80 hover:bg-fuchsia-500", icon: "text-fuchsia-400" },
  amber: { text: "text-amber-300", border: "border-amber-500/20", chip: "bg-amber-600/80 hover:bg-amber-500", icon: "text-amber-400" },
  teal: { text: "text-teal-300", border: "border-teal-500/20", chip: "bg-teal-600/80 hover:bg-teal-500", icon: "text-teal-400" },
  indigo: { text: "text-indigo-300", border: "border-indigo-500/20", chip: "bg-indigo-600/80 hover:bg-indigo-500", icon: "text-indigo-400" },
};

export const CS_CARD_IDS = CS_SERVICE_CARDS.map((c) => c.id);

// An unset list means every card shows — a store only opts cards OUT.
export function visibleCards(enabledIds) {
  if (!Array.isArray(enabledIds)) return CS_SERVICE_CARDS;
  return CS_SERVICE_CARDS.filter((c) => enabledIds.includes(c.id));
}

export function findAction(actionId) {
  for (const card of CS_SERVICE_CARDS) {
    const a = card.actions.find((x) => x.id === actionId);
    if (a) return { ...a, card };
  }
  return null;
}