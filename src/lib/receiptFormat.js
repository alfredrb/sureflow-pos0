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

// NAME  SKU  F  AMOUNT  TAXCODE
export const itemLine = (item, taxExempt) => {
  const code = taxExempt ? "E" : Number(item.tax_rate || 0) > 0 ? "X" : "O";
  const food = item.food ? "F" : " ";
  return (
    pad(String(item.name || "").toUpperCase(), 13) +
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

  if (r.manager_name) push("center", `MANAGER ${String(r.manager_name).toUpperCase()}`);

  const txTail = String(r.transaction_id || "").replace(/\D/g, "").slice(-5) || "00000";
  push(
    "center",
    `ST# ${r.store_number || "0000"}  OP# ${r.operator_id || "000000"}  TE# ${
      r.register_id || "00"
    }  TR# ${txTail}`
  );

  for (const item of r.items || []) {
    push("line", itemLine(item, r.tax_exempt));
    for (const sn of item.serial_numbers || []) push("line", `   SN: ${sn}`);
  }

  push("line", amountRow("SUBTOTAL", money(r.subtotal)));
  if (r.tax_exempt) {
    push("line", amountRow("TAX EXEMPT", "0.00"));
  } else {
    push("line", amountRow(`TAX 1  ${Number(r.tax_rate || 0).toFixed(3)} %`, money(r.tax)));
  }
  push("line", amountRow("TOTAL", money(r.total)));

  if (r.rewards_applied > 0) {
    push("line", amountRow("REWARDS TEND", money(r.rewards_applied)));
  }
  const tender = String(r.payment_method || "cash").toUpperCase().replace("_", " ");
  push(
    "line",
    amountRow(
      `${tender} TEND`,
      money(r.payment_method === "cash" ? r.amount_tendered : r.total - (r.rewards_applied || 0))
    )
  );
  push("line", amountRow("CHANGE DUE", money(r.change_due)));
  push("blank");

  const count = (r.items || []).reduce((s, i) => s + Number(i.qty || 0), 0);
  push("big", `# ITEMS SOLD ${count}`);
  push("center", `TC# ${r.transaction_id || ""}`);
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