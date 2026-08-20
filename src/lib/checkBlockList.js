// Bad-cheque block list lookup, run at the register before a cheque tender is
// accepted. Matching is on the bank account, not the person: a writer can change
// their name or ID, but a refused cheque is drawn on the same account.
import { base44 } from "@/api/base44Client";

const digits = (s) => String(s || "").replace(/\D/g, "");

export const BLOCK_REASON_LABELS = {
  returned_nsf: "Returned unpaid (NSF)",
  written_off: "Written off to shrink",
  stop_payment: "Stop payment issued",
  fraud: "Suspected fraud",
  repeat_offender: "Repeat bad cheques",
  manager_request: "Blocked by management",
  other: "Cheques not accepted",
};

export const blockReasonLabel = (reason) => BLOCK_REASON_LABELS[reason] || BLOCK_REASON_LABELS.other;

// Returns the active block covering this cheque, or null. A full account number on
// file is the strong match; otherwise routing + last four is accepted as a match so
// blocks raised from a ledger cheque (which only keeps last four) still enforce.
export async function findActiveBlock({ routing, account }) {
  const acct = digits(account);
  if (!acct) return null;
  const list = await base44.entities.CheckBlockList.filter({ status: "active" });
  return (
    list.find((b) => {
      const blockedAcct = digits(b.account_number);
      if (blockedAcct) return blockedAcct === acct;
      return !!(
        b.routing_number &&
        digits(b.routing_number) === digits(routing) &&
        b.account_last4 &&
        digits(b.account_last4) === acct.slice(-4)
      );
    }) || null
  );
}