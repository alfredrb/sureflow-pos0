// Which store settings are chain policy and which belong to the store floor.
//
// The split exists because a store's identity and money rules are not the store's to
// change: the store name and address already live on the Store record HQ owns, so a
// manager typing a different name here would make receipts disagree with the chain
// record. Tax, currency, the return window, the override-PIN requirement and cash
// limits are policy for the same reason — they must be identical at every store.
//
// Everything else is floor operations: how this particular store runs its lanes,
// its stock warnings and its own alerting. Those stay with the store manager.

export const HQ_LOCKED_FIELDS = [
  "store_name",
  "store_address",
  "store_phone",
  "store_email",
  "default_tax_rate",
  "tax_inclusive",
  "currency_symbol",
  "currency_code",
  "decimal_places",
  "return_period_days",
  "require_sod",
  "require_override_pin",
  "enable_remote_logout",
  "default_cash_limit",
  "loyalty_points_percentage",
];

// Only HQ Admin may change chain policy. Everyone else sees it, greyed out.
export function canEditChainPolicy(access) {
  return access?.role === "hq_admin";
}

export function isFieldLocked(access, field) {
  return HQ_LOCKED_FIELDS.includes(field) && !canEditChainPolicy(access);
}

// Strips HQ-locked fields out of a save payload so a store can never write them,
// even if the form state was tampered with.
export function stripLockedFields(access, payload) {
  if (canEditChainPolicy(access)) return payload;
  const clean = { ...payload };
  HQ_LOCKED_FIELDS.forEach((f) => delete clean[f]);
  return clean;
}