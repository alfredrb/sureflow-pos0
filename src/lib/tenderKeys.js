// 4690 one-touch tender keys.
//
// Flow: TOTAL (subtotal) → key an amount on the pad (or nothing) → press a tender
// key. The key COMMITS that amount on that tender. Blank = the whole balance due,
// under-tendering leaves a balance for the next tender key (split tender).
//
// Each action maps onto a Transaction tender method, so nothing downstream — the
// receipt, EOD roll-up, cash void path — needs to know a key was pressed.

export const TENDER_KEY_ACTIONS = {
  tender_cash: "cash",
  tender_check: "check",
  tender_credit: "credit",
  tender_debit: "debit",
  tender_store_credit: "store_credit",
  tender_giftcard: "giftcard",
};

export const TENDER_ACTION_LIST = Object.keys(TENDER_KEY_ACTIONS);

export const isTenderAction = (action) => !!TENDER_KEY_ACTIONS[action];

export const tenderMethodFor = (action) => TENDER_KEY_ACTIONS[action] || null;