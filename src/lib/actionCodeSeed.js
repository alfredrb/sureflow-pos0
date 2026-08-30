// Default 4690 / Walmart-style action code map shipped with SureFlow.
// Three tiers, all editable in Admin → Action Codes:
//   active      — maps to a POS function that exists today
//   placeholder — a code operators know, whose function is not built yet ("coming soon")
//   inactive    — reference-only rows for services SureFlow does not run
// Code numbers varied by store and register generation at Walmart, so this is a
// starting map, not a fixed standard — stores re-map freely.

export const ACTION_CODE_SEED = [
  // ── Mapped to live SureFlow functions ──────────────────────────────────────
  { code: 1,   label: "Void Previous Transaction", action: "void_cash_transaction", requires_role: "manager", status: "active",      notes: "AC_VOID_PREVIOUS_TRANS — pulls a completed CASH sale back out of the books. Current shift only, manager approval, void slip prints." },
  { code: 13,  label: "Abort Transaction",         action: "abort_transaction",    requires_role: "none",    status: "active",      notes: "Clears the in-progress sale before tender (formerly mapped to void_transaction)" },
  { code: 2,   label: "Void Item",                 action: "void_item",            requires_role: "none",    status: "active",      notes: "Voids the last item on the sale" },
  { code: 3,   label: "Register Reading",          action: "register_tender_reading", requires_role: "manager", status: "active",   notes: "AC — Select Register, key the register number, Enter. Prints that register's SOD opening balances, live current totals and consolidated EOD figures, broken down by tender." },
  { code: 14,  label: "Quantity Entry",            action: "quantity",             requires_role: "none",    status: "active",      notes: "Sets quantity on the last item (was code 3 before the register reading slip took that number)" },
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
  { code: 401, label: "End Of Day Summary",        action: "eod_summary",          requires_role: "csm",     status: "active",      notes: "Shows the store's consolidated EOD summary on the lane's customer pinpad and prints it for the record. Only available once the midnight consolidation has run." },
  { code: 402, label: "Print POS Configuration", action: "print_config",        requires_role: "none",      status: "active",      notes: "Prints this lane's configuration, features and hardware profile for technicians" },
  { code: 911, label: "Report Robbery",            action: "report_robbery",       requires_role: "none",    status: "active",      notes: "Emergency — logs alert and pauses the lane" },

  // ── Preset percentage discounts (AC_ANY/10/20/30/40/50_PERCENT_OFF) ────────
  { code: 300, label: "Any Percent Off",           action: "discount_percent", action_param: "",   requires_role: "manager", status: "active", notes: "AC_ANY_PERCENT_OFF — prompts the operator for the percentage, then takes it off every line" },
  { code: 301, label: "10% Off Sale",              action: "discount_percent", action_param: "10", requires_role: "csm",     status: "active", notes: "AC_10_PERCENT_OFF" },
  { code: 302, label: "20% Off Sale",              action: "discount_percent", action_param: "20", requires_role: "csm",     status: "active", notes: "AC_20_PERCENT_OFF" },
  { code: 303, label: "30% Off Sale",              action: "discount_percent", action_param: "30", requires_role: "csm",     status: "active", notes: "AC_30_PERCENT_OFF" },
  { code: 304, label: "40% Off Sale",              action: "discount_percent", action_param: "40", requires_role: "manager", status: "active", notes: "AC_40_PERCENT_OFF" },
  { code: 305, label: "50% Off Sale",              action: "discount_percent", action_param: "50", requires_role: "manager", status: "active", notes: "AC_50_PERCENT_OFF" },

  // ── Live lane-to-lane transaction transfer ────────────────────────────────
  { code: 850, label: "Transfer Sale Out",         action: "transfer_out",     requires_role: "none",    status: "active", notes: "AC_INITIATE_TRANS_TRANSFER — parks the sale in progress for pickup on another lane and prints a barcoded transfer slip. Use when a lane fails mid-sale or is closing with a queue." },
  { code: 851, label: "Retrieve Transferred Sale", action: "transfer_in",      requires_role: "none",    status: "active", notes: "AC_RETRIEVE_TRANS_TRANSFER — scan the transfer slip (or pick from the waiting list) to carry on ringing the sale on this lane." },

  // ── Till handling ─────────────────────────────────────────────────────────
  { code: 154, label: "Get Till Count",            action: "till_count",       requires_role: "none",    status: "active", notes: "AC_GET_TILL_COUNT — prints the expected drawer contents with count / over-short lines so the operator can count mid-shift." },
  { code: 153, label: "Till Cash Lift",            action: "request_cash_pickup", requires_role: "none", status: "active", notes: "AC_TILL_CASH_LIFT — raises a cash pickup so a CSM can lift excess cash out of the drawer." },
  { code: 150, label: "Till Swap Out",             action: "cash_management",  requires_role: "csm",     status: "active", notes: "AC_TILL_SWAP_OUT — opens cash management to swap this lane's till." },

  // ── Standalone ID / age verification ──────────────────────────────────────
  { code: 801, label: "Age Verification (21+)",    action: "age_verify", action_param: "21", requires_role: "none", status: "active", notes: "AC_AGE_VERIFICATION — standalone ID check, logged against the operator. Used at the door or for restricted goods rung on another lane." },
  { code: 270, label: "Alcohol Age To Sell",       action: "age_verify", action_param: "18", requires_role: "none", status: "active", notes: "AC_ALCOHOL_AGE_TO_SELL — 18+ check for staff permitted to sell alcohol." },

  // ── Granular CSM assistance calls (AC_CSM_NEED_* family) ──────────────────
  { code: 203, label: "CSM — Need Change",         action: "csm_need", action_param: "NEED CHANGE",     requires_role: "none", status: "active", notes: "AC_CSM_NEED_CHANGE" },
  { code: 205, label: "CSM — Need Break",          action: "csm_need", action_param: "NEED BREAK",      requires_role: "none", status: "active", notes: "AC_CSM_NEED_BREAK" },
  { code: 206, label: "CSM — Need Receipt Tape",   action: "csm_need", action_param: "NEED RECEIPT TAPE", requires_role: "none", status: "active", notes: "AC_CSM_NEED_RECEIPTTAPE" },
  { code: 208, label: "CSM — Need Cash Pickup",    action: "csm_need", action_param: "NEED CASH PICKUP", requires_role: "none", status: "active", notes: "AC_CSM_NEED_CASHPICKUP" },
  { code: 210, label: "CSM — Need Cleanup",        action: "csm_need", action_param: "NEED CLEANUP",    requires_role: "none", status: "active", notes: "AC_CSM_NEED_CLEANUP" },
  { code: 214, label: "CSM — Long Lines",          action: "csm_need", action_param: "LONG LINES",      requires_role: "none", status: "active", notes: "AC_CSM_LONG_LINES" },
  { code: 216, label: "CSM — Emergency",           action: "csm_need", action_param: "EMERGENCY",       requires_role: "none", status: "active", notes: "AC_CSM_EMERGENCY — pages the CSM urgently; use 911 for a robbery." },
  { code: 218, label: "CSM — Need Check Approval", action: "csm_need", action_param: "NEED CHECK APPROVAL", requires_role: "none", status: "active", notes: "AC_CSM_NEED_CHECK_APPROVAL" },
  { code: 219, label: "CSM — Need Bags",           action: "csm_need", action_param: "NEED BAGS",       requires_role: "none", status: "active", notes: "AC_CSM_NEED_BAGS" },

  // ── Self-checkout attendant badge ─────────────────────────────────────────
  { code: 860, label: "Generate SCO Badge",        action: "sco_badge",        requires_role: "none",    status: "active", notes: "Prints a barcoded self-checkout attendant badge for the signed-on operator. Scanned at an SCO lane to sign on as its attendant instead of keying credentials in front of customers. The badge expires at the end of that operator's shift, so a new one is printed each shift." },

  // ── Technician print / station tests ──────────────────────────────────────
  { code: 901, label: "Print Test Slip",           action: "print_test_slip",  requires_role: "none",    status: "active", notes: "AC_PRINT_TEST_SLIP — 40-column test pattern plus a scannable barcode to prove the receipt station." },

  // ── Known codes whose SureFlow function is not built yet ───────────────────
  { code: 8,   label: "Register Re-Entry Mode",    action: "none",                 requires_role: "manager", status: "placeholder", notes: "AC_REGISTER_REENTRY_MODE — not yet implemented" },
  { code: 7,   label: "Reset Transaction Number",  action: "none",                 requires_role: "manager", status: "placeholder", notes: "AC_RESET_TRANSACTION_NUM — SureFlow transaction numbers are time-derived, so a counter reset is not yet meaningful" },
  { code: 22,  label: "Over / Short Report",       action: "none",                 requires_role: "csm",     status: "placeholder", notes: "AC_OVER_SHORT_REPORT — lane-level over/short slip pending; use the Cash Reconciliation page today" },
  { code: 23,  label: "Suspend Report",            action: "none",                 requires_role: "csm",     status: "placeholder", notes: "AC_SUSPEND_REPORT — printed list of the store's open suspends pending" },
  { code: 907, label: "Capture Signature Test",    action: "none",                 requires_role: "none",    status: "placeholder", notes: "AC_CAPTURE_SIGNATURES — pinpad signature loop-back test pending" },
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