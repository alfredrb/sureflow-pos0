// The four no-receipt return flows offered on the POS Returns tab. Each one runs
// the same refund-to-gift-card logic; they differ only in who has to authorize it
// and whether a customer ID is captured.
export const NO_RECEIPT_MODES = {
  no_receipt: {
    title: "No Receipt Return",
    slipTitle: "NO-RECEIPT RETURN",
    authRole: null,
    authRoles: [],
    requiresCustomerId: true,
    prefix: "NR-",
    logLabel: "No-receipt return",
    theme: {
      icon: "text-fuchsia-400", text: "text-fuchsia-300", border: "border-fuchsia-500/20",
      label: "text-fuchsia-300/60", btn: "bg-fuchsia-600 hover:bg-fuchsia-500 text-white",
      totalText: "text-fuchsia-300", input: "border-fuchsia-500/20",
    },
  },
  manager_override: {
    title: "Manager Override Return",
    slipTitle: "MANAGER OVERRIDE RETURN",
    authRole: "manager",
    authRoles: ["manager"],
    requiresCustomerId: true,
    prefix: "MO-",
    logLabel: "Manager override return",
    theme: {
      icon: "text-orange-400", text: "text-orange-300", border: "border-orange-500/20",
      label: "text-orange-300/60", btn: "bg-orange-600 hover:bg-orange-500 text-white",
      totalText: "text-orange-300", input: "border-orange-500/20",
    },
  },
  csm_override: {
    title: "No Receipt CSM Override",
    slipTitle: "NO-RECEIPT CSM OVERRIDE RETURN",
    authRole: "csm",
    authRoles: ["csm", "manager"],
    requiresCustomerId: true,
    prefix: "CO-",
    logLabel: "No-receipt CSM override return",
    theme: {
      icon: "text-cyan-400", text: "text-cyan-300", border: "border-cyan-500/20",
      label: "text-cyan-300/60", btn: "bg-cyan-600 hover:bg-cyan-500 text-white",
      totalText: "text-cyan-300", input: "border-cyan-500/20",
    },
  },
  no_id: {
    title: "No Receipt No ID",
    slipTitle: "NO-RECEIPT NO-ID RETURN",
    authRole: "manager",
    authRoles: ["manager"],
    requiresCustomerId: false,
    prefix: "NI-",
    logLabel: "No-receipt no-ID return",
    theme: {
      icon: "text-rose-400", text: "text-rose-300", border: "border-rose-500/20",
      label: "text-rose-300/60", btn: "bg-rose-600 hover:bg-rose-500 text-white",
      totalText: "text-rose-300", input: "border-rose-500/20",
    },
  },
};

export function noReceiptMode(mode) {
  return NO_RECEIPT_MODES[mode] || NO_RECEIPT_MODES.no_receipt;
}