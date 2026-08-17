import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Store, LogOut, Package, BarChart3 } from "lucide-react";
import AdminVendorInsights from "@/pages/AdminVendorInsights";
import AdminInventory from "@/pages/AdminInventory";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const [operator, setOperator] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const raw = sessionStorage.getItem("admin_operator");
    if (!raw) { navigate("/"); return; }
    try {
      const op = JSON.parse(raw);
      if (op.role !== "vendor") { navigate("/"); return; }
      setOperator(op);
    } catch { navigate("/"); }
  }, [navigate]);

  if (!operator) return null;

  const logout = () => { sessionStorage.removeItem("admin_operator"); navigate("/"); };

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inventory", label: "My Inventory", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#0f172a] text-white px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-600 rounded-xl flex items-center justify-center"><Store className="w-5 h-5 text-white" /></div>
          <div className="leading-tight">
            <p className="font-bold text-sm">Vendor Dashboard</p>
            <p className="text-[11px] text-teal-300/70">{operator.company_id || "—"} · {operator.full_name}</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm font-medium">
          <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
        <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
        {tab === "overview" && <AdminVendorInsights />}
        {tab === "inventory" && <AdminInventory />}
      </div>
    </div>
  );
}