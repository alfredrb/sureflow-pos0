import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronLeft, ChevronDown, Menu, LogOut } from "lucide-react";
import { centralNavGroups } from "@/lib/centralNav";
import { Button } from "@/components/ui/button";

export default function CentralAdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [centralUser, setCentralUser] = useState(null);
  const [openGroups, setOpenGroups] = useState(new Set());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    const stored = sessionStorage.getItem("central_user");
    if (!stored) { navigate("/central/login"); }
    else { setCentralUser(JSON.parse(stored)); }
  }, [navigate]);

  useEffect(() => {
    const g = centralNavGroups.find(gr => gr.items.some(i => i.path === location.pathname));
    if (g) setOpenGroups(prev => new Set(prev).add(g.label));
  }, [location.pathname]);

  const toggleGroup = (label) => {
    if (collapsed) { setCollapsed(false); setOpenGroups(new Set([label])); }
    else setOpenGroups(prev => {
      const n = new Set(prev);
      n.has(label) ? n.delete(label) : n.add(label);
      return n;
    });
  };

  const roleLabel = (r) => r === "central_admin" ? "Central Admin" : r === "regional_manager" ? "Regional Mgr" : "HQ Manager";

  return (
    <div className="h-screen flex bg-gray-50 w-full">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#1a1f3d] text-white flex items-center justify-between px-4 h-14 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4" /></div>
          <span className="font-bold text-sm">SureFlow · Central</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-white/5 rounded-lg"><Menu className="w-5 h-5" /></button>
      </div>

      {mobileOpen && <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}

      <aside className={`bg-[#1a1f3d] text-white flex flex-col transition-all duration-300 flex-shrink-0
        ${collapsed ? "w-16" : "w-64"}
        fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          {!collapsed && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4" /></div>
                <span className="font-bold text-sm">SureFlow · Central</span>
              </div>
              {centralUser && (
                <div className="text-xs text-indigo-300/70 pl-10">{centralUser.full_name} · {roleLabel(centralUser.role)}</div>
              )}
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:inline-flex p-1.5 hover:bg-white/5 rounded-lg transition-colors">{collapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button>
          </div>
        </div>

        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          <Link to="/central" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${location.pathname === "/central" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <Building2 className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>All-Store Dashboard</span>}
          </Link>
          {centralNavGroups.map(g => {
            const isOpen = openGroups.has(g.label);
            const GIcon = g.icon;
            const groupActive = g.items.some(i => location.pathname === i.path);
            return (
              <div key={g.label} className="mt-1">
                <button onClick={() => toggleGroup(g.label)}
                  title={collapsed ? g.label : ""}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors ${groupActive ? "text-white" : "text-slate-400 hover:text-white"} hover:bg-white/5`}>
                  <GIcon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="flex-1 text-left font-medium">{g.label}</span>}
                  {!collapsed && <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />}
                </button>
                {isOpen && !collapsed && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {g.items.map(item => {
                      const Icon = item.icon;
                      const active = location.pathname === item.path;
                      return (
                        <Link key={item.path} to={item.path}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${active ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5 space-y-1">
          <button onClick={() => { sessionStorage.removeItem("central_user"); navigate("/central/login"); }} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full">
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}