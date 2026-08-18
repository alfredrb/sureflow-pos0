// Critical store announcements print a slip at the operator's clock-in so
// policy changes leave a physical paper trail. One slip per operator per
// announcement, tracked in OperatorNoticePrint.
import { base44 } from "@/api/data";
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";

export async function printAnnouncementSlips(operator) {
  const now = new Date();
  const all = await base44.entities.Announcement.list("-created_date", 50);
  const critical = all.filter(a =>
    a.status === "active" && a.severity === "critical" &&
    (!a.start_date || new Date(a.start_date) <= now) &&
    (!a.end_date || new Date(a.end_date) >= now)
  );
  if (!critical.length) return;

  const printed = await base44.entities.OperatorNoticePrint.filter({
    operator_id: operator.operator_id,
    notice_kind: "announcement",
  });
  const already = new Set(printed.map(p => p.ref_id));
  const registerNum = sessionStorage.getItem("pos_register_num") || "";

  for (const a of critical.filter(a => !already.has(a.id))) {
    await printNoticeSlip({
      heading: "STORE ANNOUNCEMENT",
      lines: [
        ...wrapNotice(a.title.toUpperCase()),
        "",
        ...wrapNotice(a.body),
        "",
        "OPERATOR X" + "_".repeat(24),
      ],
      footer: "***ACKNOWLEDGE & RETAIN***",
    }, operator);
    await base44.entities.OperatorNoticePrint.create({
      notice_kind: "announcement",
      ref_id: a.id,
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      register_id: registerNum,
      printed_at: new Date().toISOString(),
    });
  }
}