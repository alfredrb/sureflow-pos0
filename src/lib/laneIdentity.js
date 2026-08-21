// Lane identity capture — runs ONCE at app boot, before any routing or auth redirect.
//
// A diskless lane has no local config: its register is passed on the kernel command
// line (sureflow.register_id=REG-005) and the kiosk browser puts it on the POS URL as
// ?register_id=REG-005. The problem is that the query string is fragile — a platform
// auth redirect, or landing on any route other than the POS login, drops it, and the
// lane then falls back to the on-screen register picker on every single boot.
//
// So the value is captured the moment the app's JS loads and persisted in
// localStorage (NOT sessionStorage — it must survive the kiosk browser restarting
// and the terminal rebooting, which is the whole point of hardware-driven identity).

const KEY = "sureflow_lane_register";

const capture = () => {
  if (typeof window === "undefined") return;
  const fromUrl = new URLSearchParams(window.location.search).get("register_id");
  if (fromUrl) {
    const clean = fromUrl.replace(/[^\w-]/g, "");
    if (clean) window.localStorage.setItem(KEY, clean);
  }
};

capture();

// The lane's own register, or null on an ordinary browser (admin desktop, dev machine)
// which must keep using the picker.
export const getLaneRegisterId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY) || null;
};

// Used when a boot identity names a register that no longer exists, so the lane does
// not retry the same bad value forever.
export const clearLaneRegisterId = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
};