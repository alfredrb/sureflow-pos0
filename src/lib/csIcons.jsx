import { CreditCard, Award, RotateCcw, Banknote, Receipt, Users, Headphones } from "lucide-react";

// Icon lookup for the Customer Service cards, kept as an explicit map so the
// icon set stays tree-shakeable.
export const CS_ICONS = { CreditCard, Award, RotateCcw, Banknote, Receipt, Users };

export function csIcon(name) {
  return CS_ICONS[name] || Headphones;
}