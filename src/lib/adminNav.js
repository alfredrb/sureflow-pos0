import { Users, Receipt, Keyboard, BarChart3, Package, Monitor, Network, Settings, ClipboardList, MonitorSpeaker, Percent, Calendar, DollarSign, AlertTriangle, Clock, CreditCard, ShieldCheck, GraduationCap, Siren, Wrench, Settings as SettingsIcon, ShieldAlert, HardDrive, ShoppingCart, Lock, FileJson, Activity, Award, Store, Building2, UserPlus, UserCog } from "lucide-react";

export const adminNavGroups = [
  {
    label: "Register Control", icon: Monitor, items: [
      { label: "Registers", path: "/admin/registers", icon: Monitor },
      { label: "Network", path: "/admin/network", icon: Network },
      { label: "Register Log", path: "/admin/register-log", icon: ClipboardList },
      { label: "Remote Workstation", path: "/admin/remote-workstation", icon: MonitorSpeaker },
      { label: "Hardware Status", path: "/admin/hardware", icon: HardDrive },
      { label: "Cash Reconciliation", path: "/admin/cash-reconciliation", icon: DollarSign },
      { label: "EOD Reports", path: "/admin/eod-reports", icon: Calendar },
      { label: "Maintenance Log", path: "/admin-maintenance-log", icon: Wrench },
      { label: "Diagnostic Tools", path: "/admin/diagnostics", icon: Activity },
    ],
  },
  {
    label: "Workforce", icon: Users, items: [
      { label: "Operators", path: "/admin/operators", icon: Users },
      { label: "New Employee", path: "/admin/employee-creation", icon: UserPlus },
      { label: "Employee Manager", path: "/admin/employee-manager", icon: UserCog },
      { label: "Shift Scheduling", path: "/admin/shift-scheduling", icon: Clock },
      { label: "Staff Report", path: "/admin/staff-report", icon: BarChart3 },
      { label: "Payroll", path: "/admin/payroll", icon: DollarSign },
    ],
  },
  {
    label: "Sales & Inventory", icon: ShoppingCart, items: [
      { label: "Inventory", path: "/admin/inventory", icon: Package },
      { label: "Vendor Insights", path: "/admin/vendor-insights", icon: Store },
      { label: "Vendor Companies", path: "/admin/vendor-companies", icon: Building2 },
      { label: "Transactions", path: "/admin/transactions", icon: Receipt },
      { label: "Discounts", path: "/admin/discounts", icon: Percent },
      { label: "Tax Exempt", path: "/admin/tax-exempt", icon: ShieldCheck },
      { label: "Loyalty Members", path: "/admin/loyalty-members", icon: Award },
      { label: "Gift Cards", path: "/admin/gift-cards", icon: CreditCard },
    ],
  },
  {
    label: "Security & Alerts", icon: ShieldAlert, items: [
      { label: "Emergency Log", path: "/admin/emergency-log", icon: AlertTriangle },
      { label: "Loss Prevention", path: "/admin/loss-prevention", icon: ShieldAlert },
      { label: "System Alerts", path: "/admin-system-alerts", icon: Siren },
    ],
  },
  {
    label: "Setup & Config", icon: Settings, items: [
      { label: "Function Keys", path: "/admin/function-keys", icon: Keyboard },
      { label: "Receipt Setup", path: "/admin/receipt", icon: Receipt },
      { label: "Training Guides", path: "/admin-training-guides", icon: GraduationCap },
      { label: "Store Settings", path: "/admin/settings", icon: SettingsIcon },
      { label: "Data Viewer", path: "/admin/data-viewer", icon: FileJson },
      { label: "Admin Permissions", path: "/admin/permissions", icon: Lock },
    ],
  },
];

export const adminPages = adminNavGroups.flatMap(g => g.items);