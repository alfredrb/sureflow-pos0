// Cheque reference shown on the receipt for a check tender.
//
// Deliberately limited to the cheque number and the LAST FOUR of the account: it
// is enough to tie a receipt back to the cheque in the Cheque Register when one
// bounces or a customer disputes the sale, without putting a full routing +
// account number on a slip of paper that ends up in a bin.

export function checkTenderLines(tenders = []) {
  return tenders
    .filter((t) => t.method === "check" && (t.reference || t.account_last4))
    .map((t) =>
      "CHK# " + (t.reference || "") + (t.account_last4 ? "  ACCT ***" + t.account_last4 : "")
    );
}