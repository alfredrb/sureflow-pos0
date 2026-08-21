import React, { useRef, useState, useEffect } from "react";
import { Calendar, Clock, LayoutDashboard, Lock, Power } from "lucide-react";
import RebootCountdownOverlay from "@/components/pos/RebootCountdownOverlay";

/**
 * POS version button that behaves like the normal version trigger on click,
 * but reveals the POS utility actions (Shift Lookup, Clock In/Out, Admin,
 * Configuration) in a popup menu when press-and-held.
 */
export default function POSVersionButton({
  version,
  onVersionClick,
  onShowShiftLookup,
  onShowTimeClock,
  onAdmin,
  onConfig,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rebootOpen, setRebootOpen] = useState(false);
  const holdTimer = useRef(null);
  const holdTriggered = useRef(false);
  const HOLD_MS = 450;

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const startHold = () => {
    holdTriggered.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setMenuOpen(true);
    }, HOLD_MS);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleClick = () => {
    cancelHold();
    if (holdTriggered.current) {
      holdTriggered.current = false;
      return;
    }
    onVersionClick();
  };

  const items = [
    { icon: <Calendar className="w-3.5 h-3.5" />, label: "Shift Lookup", action: onShowShiftLookup },
    { icon: <Clock className="w-3.5 h-3.5" />, label: "Clock In/Out", action: onShowTimeClock },
    { icon: <LayoutDashboard className="w-3.5 h-3.5" />, label: "Admin", action: onAdmin },
    { icon: <Lock className="w-3.5 h-3.5" />, label: "Configuration", action: onConfig },
    { icon: <Power className="w-3.5 h-3.5" />, label: "Reboot Lane", action: () => setRebootOpen(true) },
  ];

  return (
    <div className="relative flex flex-col items-center mt-6">
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        onClick={handleClick}
        className="text-blue-300/20 hover:text-blue-300/60 text-[10px] transition-colors cursor-pointer select-none"
      >
        v{version} — Terminal Ready
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col gap-1 bg-[#111638] border border-blue-500/20 rounded-xl p-2 shadow-2xl shadow-black/50 z-50 min-w-[180px]">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => { setMenuOpen(false); it.action(); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/0 hover:bg-white/10 border border-transparent hover:border-blue-500/20 text-blue-300/70 hover:text-blue-100 transition-colors text-xs text-left"
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <RebootCountdownOverlay
        open={rebootOpen}
        onClose={() => setRebootOpen(false)}
        registerId={sessionStorage.getItem("pos_register_num") || ""}
      />
    </div>
  );
}