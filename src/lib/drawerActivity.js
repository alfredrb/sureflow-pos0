// Why a lane's cash drawer opened, and what that means for Loss Prevention.
//
// Every path that releases the drawer announces itself here, so the drawer watch can
// answer the two questions LP actually asks: how long was it standing open, and was
// there a sale behind it at all. A drawer that opens with no transaction attached is
// the classic till-skim signature, so "unattributed" is a first-class reason rather
// than a blank.

export const DRAWER_KICK_EVENT = "sureflow-drawer-kick";

// expected:true = the open is explained by the operator's action. Anything else is
// surfaced as an unexplained open in the workbench.
export const DRAWER_REASONS = {
  sale: { label: "Cash sale", expected: true },
  no_sale: { label: "No Sale key", expected: true },
  cash_management: { label: "Cash pickup / advance", expected: true },
  till: { label: "Till check-out / check-in", expected: true },
  customer_service: { label: "Customer service desk", expected: true },
  manual: { label: "Unattributed", expected: false },
};

export function drawerReasonLabel(reason) {
  return DRAWER_REASONS[reason]?.label || DRAWER_REASONS.manual.label;
}

// An open with no sale behind it. A No Sale keypress is explained but still has no
// transaction, so it is counted separately from a truly unattributed release.
export function isUnexplainedOpen(reason) {
  return !DRAWER_REASONS[reason]?.expected;
}

export function announceDrawerOpen(reason = "manual", meta = {}) {
  try {
    window.dispatchEvent(new CustomEvent(DRAWER_KICK_EVENT, { detail: { reason, meta } }));
  } catch {}
}