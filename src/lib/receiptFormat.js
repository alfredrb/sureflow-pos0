// IBM 4690 / Walmart-style receipt formatter.
// Produces fixed-column 42-char lines (80mm paper at font A) so the browser
// fallback and the relay's raw ESC/POS output look identical.

export const RECEIPT_WIDTH = 42;

const money = (n) => Number(n || 0).toFixed(2);

const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n, " ");
const rpad = (s, n) => String(s ?? "").slice(-n).padStart(n, " ");

export const rule = (char = "-") => char.repeat(RECEIPT_WIDTH);

// Right-aligned label + amount block (4690 totals style).
export const amountRow = (label, amount) =>
  rpad(label, 30) + rpad(amount, 12);

// Centers text inside a fixed-width column so item names line up uniformly.
const centerPad = (s, n) => {
  const t = String(s ?? "").slice(0, n);
  const left = Math.floor((n - t.length) / 2);
  return " ".repeat(left) + t + " ".repeat(n - t.length - left);
};

// NAME(centered)  SKU  F  AMOUNT  TAXCODE
export const itemLine = (item, taxExempt) => {
  const code = taxExempt ? "E" : Number(item.tax_rate || 0) > 0 ? "X" : "O";
  const food = item.food ? "F" : " ";
  return (
    centerPad(String(item.name || "").toUpperCase(), 16) +
    " " +
    rpad(item.sku || "", 12) +
    " " +
    food +
    rpad(money(item.total), 9) +
    " " +
    code
  );
};

/**
 * Builds an ordered token list for a receipt.
 * Token types: line (monospace row), center, big (double-height centered),
 * barcode, blank.
 */
export function buildReceiptTokens(r) {
  const t = [];
  const push = (type, text) => t.push({ type, text });

  push("big", (r.store_name || "Store").toUpperCase());
  for (const l of [r.header_line_1, r.store_address, r.store_phone]) {
    if (l) push("center", l);
  }
  push("blank");

  if (r.doc_type === "return") push("center", "*** RETURN / REFUND ***");
  if (r.doc_type === "exchange") push("center", "*** EXCHANGE ***");

  if (r.manager_name) push("center", `MANAGER ${String(r.manager_name).toUpperCase()}`);

  push(
    "center",
    `ST# ${r.store_number || "0000"}  OP# ${r.operator_pin || ""}  REG# ${r.register_id || "00"}`
  );

  // Cash slips (advance / pickup / till check-in-out) print an amount + audit block
  // instead of line items and totals.
  if (r.doc_type === "cash") {
    const cs = r.cash_slip || {};
    push("blank");
    push("big", (cs.title || "CASH SLIP").toUpperCase());
    push("blank");
    push("line", amountRow("TYPE", String(cs.kind || "").toUpperCase()));
    push("line", amountRow("AMOUNT", money(cs.amount)));
    if (cs.reason) {
      push("blank");
      push("center", "REASON");
      push("center", String(cs.reason));
    }
    push("blank");
    push("line", "OPERATOR X" + "_".repeat(24));
    push("line", "AUDITOR  X" + "_".repeat(24));
    push("blank");
    push("center", r.date || new Date().toLocaleString());
    push("center", "***FOR AUDITOR CONFIRMATION***");
    return t;
  }

  for (const item of r.items || []) {
    push("line", itemLine(item, r.tax_exempt));
    for (const sn of item.serial_numbers || []) push("line", `   SN: ${sn}`);
  }

  push("line", amountRow("SUBTOTAL", money(r.subtotal)));
  if (r.tax_exempt) {
    push("line", amountRow("TAX EXEMPT", "0.00"));
  } else {
    push("line", amountRow(`TAX  ${Number(r.tax_rate || 0).toFixed(3)} %`, money(r.tax)));
  }
  push(
    "line",
    amountRow(
      r.doc_type === "return" ? "REFUND TOTAL" : r.doc_type === "exchange" ? "BALANCE DUE" : "TOTAL",
      money(r.total)
    )
  );

  // On a refund the money moves back to the customer, so tender prints negative.
  const signed = (n) => (r.doc_type === "return" ? `-${money(n)}` : money(n));
  if (r.rewards_applied > 0) {
    push("line", amountRow("REWARDS TEND", signed(r.rewards_applied)));
  }
  const tender = String(r.payment_method || "cash").toUpperCase().replace("_", " ");
  push(
    "line",
    amountRow(
      `${tender} TEND`,
      signed(r.payment_method === "cash" ? r.amount_tendered : r.total - (r.rewards_applied || 0))
    )
  );
  push("line", amountRow("CHANGE DUE", money(r.change_due)));
  push("blank");

  const count = (r.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
  push("center", `# ITEMS ${r.doc_type === "return" ? "RETURNED" : "SOLD"} ${count}`);
  push("barcode", r.transaction_id || "");

  if (r.giftcard_notice) {
    push("center", "GIFT CARDS NOT REFUNDABLE");
    push("center", "Cannot be exchanged for cash or credit");
  }
  if (r.tax_exempt) {
    push("center", `TAX EXEMPT ${r.tax_exempt.tax_exempt_id || ""}`);
    push("center", String(r.tax_exempt.name || "").toUpperCase());
  }
  if (r.loyalty_member) {
    push("center", `MEMBER ${r.loyalty_member.loyalty_id || ""}`);
    push("line", amountRow("REWARDS EARNED", money(r.rewards_earned)));
    push("line", amountRow("REWARDS BALANCE", money(r.loyalty_balance)));
  }

  for (const l of [r.footer_line_1, r.footer_line_2]) if (l) push("center", l);
  push("center", r.date || new Date().toLocaleString());
  push("blank");
  push("center", "***CUSTOMER COPY***");

  return t;
}