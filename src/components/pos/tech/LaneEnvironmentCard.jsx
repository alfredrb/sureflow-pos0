import React from "react";
import { MonitorSmartphone } from "lucide-react";
import TechDiagCard from "@/components/pos/tech/TechDiagCard";

// The lane's own display and input environment, which is where the awkward faults
// live: a panel running at the wrong resolution or scale is the cause of the 12-inch
// UI complaints, and a lane with a full alphanumeric keyboard should NOT be showing
// the on-screen QWERTY. None of that is visible from a status field.
export default function LaneEnvironmentCard({ register }) {
  const scale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const touch = typeof navigator !== "undefined" ? navigator.maxTouchPoints || 0 : 0;

  const rows = [
    ["Panel resolution", `${window.screen?.width || "?"} x ${window.screen?.height || "?"}`],
    ["Viewport", `${window.innerWidth} x ${window.innerHeight}`],
    ["Display scale", `${scale.toFixed(2)}x${scale !== 1 ? " (scaled)" : ""}`, scale !== 1 ? "text-amber-400" : ""],
    ["Touch points", touch ? `${touch} (touch panel)` : "none (mouse only)", touch ? "" : "text-amber-400"],
    ["Boot profile", register?.boot_profile || "—"],
    ["Keyboard", register?.keyboard_model || "—"],
    ["Soft keyboard", register?.soft_keyboard_disabled ? "disabled (physical board)" : "enabled"],
    ["Scanner interface", register?.scanner_interface || "—"],
    ["Customer monitor", register?.customer_monitor_enabled
      ? `${register.customer_monitor_resolution || "?"} ${register.customer_monitor_orientation || ""}`.trim()
      : "not fitted"],
    ["Pole display", register?.pole_display_model || "not fitted"],
    ["Pinpad", register?.pinpad_model ? `${register.pinpad_model} @ ${register.pinpad_ip || "—"}` : "not fitted"],
    ["Printer transport", register?.printer_transport || "—"],
    ["Drawer transport", register?.drawer_transport || "—"],
    ["Self-checkout lane", register?.feature_self_checkout ? "yes" : "no"],
  ];

  return (
    <TechDiagCard icon={MonitorSmartphone} title="Lane Environment">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <p className="text-slate-400 text-[10px] uppercase">{label}</p>
            <p className={`font-mono text-[11px] break-words ${tone || "text-white"}`}>{value}</p>
          </div>
        ))}
      </div>
    </TechDiagCard>
  );
}