// Default 4690 / Walmart-style action code map shipped with SureFlow.
// Three tiers, all editable in Admin → Action Codes:
//   active      — maps to a POS function that exists today
//   placeholder — a code operators know, whose function is not built yet ("coming soon")
//   inactive    — reference-only rows for services SureFlow does not run
// Code numbers varied by store and register generation at Walmart, so this is a
// starting map, not a fixed standard — stores re-map freely.

export const ACTION_CODE_SEED = [
  // ── Mapped to live SureFlow functions ──────────────────────────────────────
  { code: 1,   label: "Void Previous Transaction", action: "void_transaction",     requires_role: "csm",     status: "active",      notes: "AC_VOID_PREVIOUS_TRANS" },
  { code: 2,   label: "Void Item",                 action: "void_item",            requires_role: "none",    status: "active",      notes: "Voids the last item on the sale" },
  { code: 3,   label: "Quantity Entry",            action: "quantity",             requires_role: "none",    status: "active",      notes: "Sets quantity on the last item" },
  { code: 4,   label: "Tax Exempt",                action: "tax_exempt",           requires_role: "csm",     status: "active",      notes: "AC_TAX_EXEMPT" },
  { code: 5,   label: "Price Override",            action: "price_override",       requires_role: "csm",     status: "active",      notes: "Toggles price override mode" },
  { code: 6,   label: "Price Inquiry",             action: "price_check",          requires_role: "none",    status: "active",      notes: "AC_PRICE_INQUIRY" },
  { code: 7,   label: "Discount Item",             action: "discount_item",        requires_role: "csm",     status: "active",      notes: "" },
  { code: 9,   label: "Training Mode",             action: "training_mode",        requires_role: "csm",     status: "active",      notes: "AC_REGISTER_TRAINING_MODE" },
  { code: 10,  label: "Discount Total",            action: "discount_total",       requires_role: "manager", status: "active",      notes: "" },
  { code: 11,  label: "Item Lookup",               action: "item_list",            requires_role: "none",    status: "active",      notes: "Opens the item list" },
  { code: 12,  label: "Loyalty Lookup",            action: "loyalty_lookup",       requires_role: "none",    status: "active",      notes: "" },
  { code: 24,  label: "Supervisor Override",       action: "supervisor_override",  requires_role: "none",    status: "active",      notes: "AC_SUPERVISOR_OVERRIDE — prompts for CSM/Manager authorization" },
  { code: 61,  label: "Reprint Receipt",           action: "reprint_receipt",      requires_role: "none",    status: "active",      notes: "AC_REPRINT_RECEIPT" },
  { code: 62,  label: "Refund",                    action: "refund",               requires_role: "csm",     status: "active",      notes: "" },
  { code: 95,  label: "Terminal Management",       action: "diagnostics",          requires_role: "csm",     status: "active",      notes: "AC_TERMINAL_MGMT — enters diagnostics/training" },
  { code: 200, label: "CSM Help Request",          action: "csm_help",             requires_role: "none",    status: "active",      notes: "AC_CSM_* family — sends a help request to the CSM" },
  { code: 210, label: "Request Cash Pickup",       action: "request_cash_pickup",  requires_role: "none",    status: "active",      notes: "" },
  { code: 211, label: "Request Cash Advance",      action: "request_cash_advance", requires_role: "none",    status: "active",      notes: "" },
  { code: 244, label: "Dump Register",             action: "export_cash",          requires_role: "manager", status: "active",      notes: "AC_DUMP_REGISTER — cash history export" },
  { code: 250, label: "No Sale (Open Drawer)",     action: "no_sale",              requires_role: "none",    status: "active",      notes: "AC_CSM_NOSALE — code number varies by store" },
  { code: 251, label: "Cash Changer Function",     action: "cash_management",      requires_role: "csm",     status: "active",      notes: "AC_PROCESS_CASHCHGR_FUNCTION" },
  { code: 402, label: "Print POS Configuration", action: "print_config",        requires_role: "none",    status: "active",      notes: "Prints this lane's configuration, features and hardware profile for technicians" },
  { code: 911, label: "Report Robbery",            action: "report_robbery",       requires_role: "none",    status: "active",      notes: "Emergency — logs alert and pauses the lane" },

  // ── Known codes whose SureFlow function is not built yet ───────────────────
  { code: 8,   label: "Register Re-Entry Mode",    action: "none",                 requires_role: "manager", status: "placeholder", notes: "AC_REGISTER_REENTRY_MODE — not yet implemented" },
  { code: 30,  label: "Suspend Transaction",       action: "suspend",              requires_role: "none",    status: "placeholder", notes: "Suspend/resume not yet implemented at the POS" },
  { code: 31,  label: "Resume Transaction",        action: "resume",               requires_role: "none",    status: "placeholder", notes: "Suspend/resume not yet implemented at the POS" },
  { code: 40,  label: "Repeat Last Item",          action: "repeat_last",          requires_role: "none",    status: "placeholder", notes: "Not yet implemented at the POS" },
  { code: 201, label: "CSM Key Approval",          action: "none",                 requires_role: "csm",     status: "placeholder", notes: "AC_CSM_* family — remote key approval flow pending" },

  // ── Reference only — services SureFlow does not run ───────────────────────
  { code: 35,  label: "Fiscal Printer Report",     action: "none",                 requires_role: "manager", status: "inactive",    notes: "Fiscal printer / electronic journal (35–43) — not applicable" },
  { code: 101, label: "MoneyGram Send",            action: "none",                 requires_role: "csm",     status: "inactive",    notes: "MoneyGram (101–108) — service not offered" },
  { code: 104, label: "MoneyGram Receive",         action: "none",                 requires_role: "csm",     status: "inactive",    notes: "MoneyGram (101–108) — service not offered" },
  { code: 226, label: "ATM Plus Function",         action: "none",                 requires_role: "manager", status: "inactive",    notes: "ATM Plus (226–245) — service not offered" },
  { code: 245, label: "ATM Plus Settlement",       action: "none",                 requires_role: "manager", status: "inactive",    notes: "ATM Plus (226–245) — service not offered" },
  { code: 260, label: "WIC ICC Tender",            action: "none",                 requires_role: "csm",     status: "inactive",    notes: "WIC ICC — not supported" },
  { code: 270, label: "Fuel / Carwash Function",   action: "none",                 requires_role: "manager", status: "inactive",    notes: "Fuel, carwash and parking lot flows — not applicable" },
];