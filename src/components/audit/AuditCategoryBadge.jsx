import React from "react";
import { Settings as SettingsIcon, Lock, Server, UserCog, Monitor, ScrollText } from "lucide-react";

export const CATEGORY_META = {
  configuration: { label: "Configuration", icon: SettingsIcon, color: "text-blue-600", bg: "bg-blue-50" },
  permissions: { label: "Permissions", icon: Lock, color: "text-purple-600", bg: "bg-purple-50" },
  system: { label: "System", icon: Server, color: "text-gray-600", bg: "bg-gray-100" },
  operator: { label: "Operator", icon: UserCog, color: "text-emerald-600", bg: "bg-emerald-50" },
  register: { label: "Register", icon: Monitor, color: "text-amber-600", bg: "bg-amber-50" },
  other: { label: "Other", icon: ScrollText, color: "text-gray-500", bg: "bg-gray-100" },
};

export default function AuditCategoryBadge({ category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${meta.bg} ${meta.color}`}>
      <Icon className="h-3 w-3" />{meta.label}
    </span>
  );
}