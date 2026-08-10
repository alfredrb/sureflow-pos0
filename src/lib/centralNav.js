import { BarChart3, Store, Users, ShoppingCart, Package, FileBarChart, Building2, LogOut, ChevronLeft, ChevronDown } from "lucide-react";

export const centralNavGroups = [
  {
    label: "Overview",
    icon: BarChart3,
    items: [
      { label: "Dashboard", path: "/central", icon: BarChart3 },
      { label: "Stores", path: "/central/stores", icon: Building2 }
    ]
  },
  {
    label: "Sales & Inventory",
    icon: ShoppingCart,
    items: [
      { label: "Transactions", path: "/central/transactions", icon: ShoppingCart },
      { label: "EOD Reports", path: "/central/eod-reports", icon: FileBarChart },
      { label: "Inventory", path: "/central/inventory", icon: Package }
    ]
  },
  {
    label: "Workforce",
    icon: Users,
    items: [
      { label: "Operators", path: "/central/operators", icon: Users }
    ]
  }
];