import React from "react";
import { LogOut, ShoppingCart, AlertTriangle, Megaphone } from "lucide-react";

const ROLE_BADGE = {
  manager: { label: "Manager", cls: "bg-red-500/20 text-red-300" },
  csm: { label: "CSM", cls: "bg-amber-500/20 text-amber-300" },
  technician: { label: "Technician", cls: "bg-slate-500/20 text-slate-300" },
  cashier: { label: "Cashier", cls: "bg-blue-500/20 text-blue-300" },
};

// POS header: branding, register/operator identity, clock, mode tabs, and the
// operator-side controls (lunch flag, news, help menu, logout).
export default function POSTopBar({
  operator, registerNum, currentTime, modeTabs, posMode, onSelectMode,
  lunchUpcoming, onOpenLunch, newsCount, onOpenNews, helpMenu, onLogout, scoButton,
}) {
  const badge = ROLE_BADGE[operator?.role] || ROLE_BADGE.cashier;

  return (
    <div className="bg-[#111638] border-b border-blue-500/10 px-3 py-1.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm">SureFlow POS</span>
          <div className="text-right leading-tight">
            <span className="text-blue-300/40 text-[10px] block">{registerNum}</span>
            <span className="text-blue-300/25 text-[9px] block">OP: {operator?.operator_id || "—"}</span>
          </div>
          <div className="text-left leading-tight pointer-events-none pl-1.5 border-l border-blue-500/10">
            <p className="text-white text-sm font-bold tabular-nums">{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
            <p className="text-blue-300/40 text-[10px]">{currentTime.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {modeTabs.map(({ id, label, icon: Icon, activeColor, inactiveColor }) => (
            <button
              key={id}
              onClick={() => onSelectMode(id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${posMode === id ? activeColor : inactiveColor}`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {lunchUpcoming && (
            <button onClick={onOpenLunch} title="Upcoming scheduled lunch" className="text-amber-400 hover:text-amber-300 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-blue-200/60 text-xs">{operator?.full_name}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
        </div>
        <button
          onClick={onOpenNews}
          className="relative flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0a0e27] border border-blue-500/20 text-blue-300/70 hover:text-blue-200 hover:border-blue-500/40 transition-colors text-[10px] font-bold uppercase tracking-wider"
          title="Store Announcements"
        >
          <Megaphone className="w-3.5 h-3.5" />
          News
          {newsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">{newsCount}</span>
          )}
        </button>
        {scoButton}
        {helpMenu}
        {/* Logout sits in the same bubble style as News so it is an easy target
            on the 12-inch lane screens. */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0a0e27] border border-red-500/20 text-red-300/70 hover:text-red-300 hover:border-red-500/40 transition-colors text-[10px] font-bold uppercase tracking-wider"
          title="Sign out of this register"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    </div>
  );
}