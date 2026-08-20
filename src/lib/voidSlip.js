// Cash-void slip — the manager's paper record that a completed cash sale was
// pulled back out of the books. Mirrors the 4690 void slip: the original
// terminal / transaction / amount, an APPROVED BY signature line, and a
// scannable code carrying the original transaction number.
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

export async function printVoidSlip({ tx, manager, operator, reason }) {
  await printNoticeSlip({
    heading: "TRANSACTION VOID",
    lines: [
      "THE FOLLOWING TRANSACTION",
      "WAS FLAGGED FOR VOID",
      "STATUS AT MANAGER REQUEST",
      "",
      `ORIGINAL TERMINAL #  ${tx.register_id || ""}`,
      `ORIGINAL TRANS. #    ${tx.transaction_id || ""}`,
      `ORIGINAL SALE AMT.   ${Number(tx.total || 0).toFixed(2)}`,
      "",
      ...(reason ? ["REASON", ...wrapNotice(reason), ""] : []),
      ...wrapNotice("Return the cash to the customer. The drawer will read over by the amount above until the cash is handed back."),
      "",
      `APPROVED BY ${String(manager?.full_name || "").toUpperCase()}`,
      "MANAGER  X" + "_".repeat(24),
      "OPERATOR X" + "_".repeat(24),
    ],
    footer: "***RETAIN FOR CASH AUDIT***",
    barcode: tx.transaction_id || "",
  }, operator);
}