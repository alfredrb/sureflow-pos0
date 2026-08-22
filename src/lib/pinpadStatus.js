// Live status of the lane's customer-facing pinpad.
//
// Every pinpad helper reports here as it runs, so the operator screen can show
// what the customer is seeing AND whether the pad actually answered. Without this
// a dead pad is invisible: display calls are deliberately swallowed so a sale is
// never blocked, which also means nothing on screen ever changes.
//
// states: "idle" (pad clear / between sales) · "ok" (last write landed)
//         "error" (pad did not answer) · "interactive" (customer is acting on it)

let current = { state: "idle", detail: "" };
const listeners = new Set();

export function getPinpadStatus() {
  return current;
}

export function setPinpadStatus(state, detail = "") {
  current = { state, detail };
  listeners.forEach((fn) => fn(current));
}

export function subscribePinpadStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}