// Shared action-code resolution logic used by the POS dispatcher.
// Keeps lookup + role gating in one place so the physical key and the on-screen
// button behave identically.

export const ACTION_LABELS = {
  void_item: "Void Item", abort_transaction: "Abort Transaction",
  void_cash_transaction: "Void Cash Transaction", void_transaction: "Abort Transaction (legacy)",
  discount_item: "Discount Item", discount_total: "Discount Total",
  price_check: "Price Check", no_sale: "No Sale", subtotal: "Subtotal",
  tax_exempt: "Tax Exempt", price_override: "Price Override", quantity: "Quantity",
  repeat_last: "Repeat Last", suspend: "Suspend", resume: "Resume", refund: "Refund",
  reprint_receipt: "Reprint Receipt", cash_management: "Cash Management",
  request_cash_pickup: "Request Cash Pickup", request_cash_advance: "Request Cash Advance",
  training_mode: "Training Mode", diagnostics: "Diagnostics", csm_help: "CSM Help",
  report_robbery: "Report Robbery", item_list: "Item Lookup", loyalty_lookup: "Loyalty Lookup",
  export_cash: "Cash History Export", supervisor_override: "Supervisor Override",
  csm_approval: "CSM Key Approval", print_config: "Print POS Configuration", none: "None",
};

// Store-specific mappings win over the global (blank store_id) defaults.
export function resolveActionCode(codes, code, storeId = "") {
  const n = parseInt(code, 10);
  if (isNaN(n)) return null;
  const matches = codes.filter(c => Number(c.code) === n);
  return matches.find(c => c.store_id && c.store_id === storeId) ||
         matches.find(c => !c.store_id) ||
         matches[0] || null;
}

// Does this operator need a supervisor override to run this code?
// While the lane's virtual CSM key is turned (csmApproved), CSM-level actions run
// without a prompt. Manager-level actions always require their own PIN.
export function needsOverrideFor(requiredRole, operatorRole, csmApproved = false) {
  if (requiredRole === "csm") return operatorRole === "cashier" && !csmApproved;
  if (requiredRole === "manager") return operatorRole === "cashier" || operatorRole === "csm";
  return false;
}

// The IBM POS keyboard's Action Code key is mapped by hwdb onto F9, which the
// browser delivers reliably. Terminals with that keyboard use the physical key;
// everything else falls back to the on-screen button.
export const ACTION_CODE_KEY = "F9";
export const MAPPED_KEYBOARDS = ["3AA01194300"];

export function hasPhysicalActionCodeKey(register) {
  const model = (register?.keyboard_model || "").replace(/\s/g, "");
  return MAPPED_KEYBOARDS.some(m => model.includes(m));
}