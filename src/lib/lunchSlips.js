// Lunch notice slips printed at the register:
//  - warning slip when the 30-minute pre-lunch alert fires
//  - lockout slip when the register locks the operator out for passing lunch
// Each prints once per operator per day per type (tracked in sessionStorage so a
// re-login on the same lane doesn't reprint).
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

const key = (type, operator) =>
  `pos_lunch_slip_${type}_${operator?.operator_id || ""}_${new Date().toISOString().split("T")[0]}`;

function alreadyPrinted(type, operator) {
  const k = key(type, operator);
  if (sessionStorage.getItem(k)) return true;
  sessionStorage.setItem(k, "1");
  return false;
}

export async function printLunchWarningSlip(operator, shift) {
  if (!operator || !shift?.lunch_start) return;
  if (alreadyPrinted("warning", operator)) return;
  await printNoticeSlip({
    heading: "LUNCH REMINDER",
    lines: [
      `SCHEDULED LUNCH  ${shift.lunch_start}`,
      shift.lunch_end ? `SCHEDULED RETURN ${shift.lunch_end}` : "",
      "",
      ...wrapNotice("Your scheduled lunch begins in 30 minutes. Finish your current customer and be ready to go on time."),
      "",
      ...wrapNotice(`After ${shift.lunch_start} this register will lock until you take your lunch or a supervisor authorizes continued work.`),
    ],
    footer: "***LUNCH REMINDER***",
  }, operator);
}

export async function printLunchLockoutSlip(operator, shift) {
  if (!operator || !shift?.lunch_start) return;
  if (alreadyPrinted("lockout", operator)) return;
  await printNoticeSlip({
    heading: "REGISTER LOCKED",
    lines: [
      `LUNCH OVERDUE — DUE ${shift.lunch_start}`,
      "",
      ...wrapNotice("This register is locked because the scheduled lunch break was not taken on time."),
      "",
      ...wrapNotice("Take your lunch break now, or have a CSM / Manager authorize continued work at the register."),
      "",
      "SUPERVISOR X" + "_".repeat(22),
    ],
    footer: "***LUNCH LOCKOUT NOTICE***",
  }, operator);
}