// Printed self-checkout attendant badge. The code prints as a CODE128 barcode so
// the attendant scans it at the lane instead of keying credentials in front of
// customers. The expiry is printed in full so nobody expects yesterday's slip to work.
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

export async function printScoBadgeSlip(badge, operator) {
  const expires = new Date(badge.expires_at);
  await printNoticeSlip({
    heading: "SELF CHECKOUT BADGE",
    barcode: badge.badge_code,
    lines: [
      `ATTENDANT  ${String(badge.operator_name || "").toUpperCase()}`,
      `OPERATOR   ${badge.operator_id}`,
      `BADGE      ${badge.badge_code}`,
      `EXPIRES    ${expires.toLocaleString()}`,
      "",
      ...wrapNotice("Scan this slip at a self-checkout lane to sign on as its attendant."),
      "",
      ...wrapNotice("This badge stops working at the end of your shift. Print a new one at the start of your next shift."),
      "",
      ...wrapNotice("Do not share this slip. It signs on under your name and everything done with it is recorded against you."),
    ],
    footer: "***KEEP WITH YOU — NOT A RECEIPT***",
  }, operator);
}