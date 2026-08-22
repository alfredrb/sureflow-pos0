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
  // Decode REPEATEDLY, not once. A platform auth redirect can fold the address into
  // its own parameter more than once, so the value arrives double-encoded
  // (http%253A%252F%252F…). A single decode pass leaves http%3A%2F%2F, which still
  // matched the loose register_id pattern below but failed the relay's URL pattern —
  // that is exactly why a lane captured its register and never its relay address.
  let href = window.location.href;
  for (let i = 0; i < 3; i++) {
    let next = href;
    try { next = decodeURIComponent(href); } catch { break; }
    if (next === href) break;
    href = next;
  }
  const match = href.match(/register_id=([\w-]+)/);
  if (match && match[1]) window.localStorage.setItem(KEY, match[1]);

  // The lane's store relay address, passed on the same boot URL (&relay=http://…).
  // A cloud-served lane cannot reach its relay through window.location.origin, and
  // the kiosk browser has DevTools disabled, so the boot URL is the only way to set
  // it. Persisted like the register so it survives reboots.
  // Capture the raw value first and validate after decoding it, so a still-encoded
  // address is accepted rather than silently ignored.
  const relay = href.match(/[?&]relay=([^&\s]+)/);
  if (relay && relay[1]) {
    let url = relay[1];
    try { url = decodeURIComponent(url); } catch { /* keep raw */ }
    if (/^https?:\/\//.test(url)) {
      window.localStorage.setItem("relay_base_url", url.replace(/\/+$/, ""));
    }
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