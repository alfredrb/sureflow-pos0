// Day-scoping for the Cash Reconciliation Quick Report.
//
// Every cash record type stamps its date on a different field, which is why the
// report used to mix all-time counts (326 tills checked in) with today's figures.
// One place decides what "that day" means for each record type.

export const todayStr = () => new Date().toISOString().split("T")[0];

const onDay = (value, day) => !!value && String(value).slice(0, 10) === day;

// Which field carries the record's date, per record type.
export const dateField = {
  deposits: "report_date",
  advances: "created_date",
  pickups: "created_date",
  audits: "audit_date",
  robberies: "created_date",
  giftCardCashouts: "created_date",
};

const filterDay = (rows = [], field, day) => rows.filter((r) => onDay(r[field], day));

// Narrows an already store-scoped record set to a single work day. tillCheckouts are
// left whole and scoped inside the totals, because a till is dated twice: once when
// it leaves the safe and again when it comes back.
export function scopeToDay(records, day) {
  const out = { ...records, day };
  for (const [key, field] of Object.entries(dateField)) {
    out[key] = filterDay(records[key] || [], field, day);
  }
  return out;
}

export const checkedOutOnDay = (tills = [], day) =>
  tills.filter((t) => onDay(t.checkout_date, day));

export const checkedInOnDay = (tills = [], day) =>
  tills.filter((t) => t.status === "checked_in" && onDay(t.checkin_date, day));