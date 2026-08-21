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
  // Read it off the WHOLE url, decoded — not just the top-level query string. A
  // platform auth redirect folds the original address into its own parameter
  // (…/login?next=%2Fpos%2Flogin%3Fregister_id%3DREG-005), so the value is still
  // present but nested, and URLSearchParams on window.location.search misses it.
  let href = window.location.href;
  try { href = decodeURIComponent(href); } catch { /* keep raw */ }
  const match = href.match(/register_id=([\w-]+)/);
  if (match && match[1]) window.localStorage.setItem(KEY, match[1]);
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