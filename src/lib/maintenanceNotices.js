// Maintenance notice slips (IBM 4690 / Walmart controller style).
// At an operator's first clock-in while POS maintenance is scheduled, a
// pre-maintenance slip prints; at the first clock-in after the work is
// completed, a completion slip prints. Each slip prints once per operator
// per maintenance log, tracked in the MaintenanceNotice entity.
import { base44 } from "@/api/data";
import { printReceipt } from "@/lib/printReceipt";

const WIDTH = 42;

function wrap(text, width = WIDTH) {
  const out = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > width) {
        if (line) out.push(line);
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) out.push(line);
  }
  return out;
}

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d.length <= 10 ? d + "T12:00:00" : d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};

// POS-relevant maintenance: software updates or notices pushed from Central Admin.
const isPosNotice = (log) => log.log_type === "software_update" || log.sent_from_central;

function buildNotice(log, type, operator) {
  if (type === "pre") {
    return {
      heading: "SCHEDULED MAINTENANCE",
      lines: [
        ...wrap(log.title.toUpperCase()),
        "",
        ...wrap(`Changes will be made to the POS system on ${fmtDate(log.service_date)}.`),
        "",
        ...wrap(log.description || ""),
      ],
      footer: "***MAINTENANCE NOTICE***",
    };
  }
  return {
    heading: "MAINTENANCE COMPLETE",
    lines: [
      ...wrap(log.title.toUpperCase()),
      "",
      ...wrap(`New changes were added to the POS system on ${fmtDate(log.completed_date || log.service_date)}.`),
      "",
      ...wrap(log.notes || log.description || ""),
    ],
    footer: "***MAINTENANCE COMPLETE***",
  };
}

/**
 * Checks for pending maintenance notices for this operator and prints any
 * that haven't printed yet. Safe to fire-and-forget at clock-in.
 */
export async function printMaintenanceNotices(operator) {
  const now = new Date();
  const logs = await base44.entities.MaintenanceLog.list("-created_date", 100);
  const relevant = logs.filter(isPosNotice);

  const pre = relevant.filter(l =>
    (l.status === "scheduled" || l.status === "in_progress") &&
    l.service_date && new Date(l.service_date + "T23:59:59") >= now
  );
  const post = relevant.filter(l =>
    l.status === "completed" && (l.completed_date || l.service_date) &&
    (now - new Date((l.completed_date || l.service_date) + "T00:00:00")) / 86400000 <= 7
  );
  if (!pre.length && !post.length) return;

  const printed = await base44.entities.MaintenanceNotice.filter({ operator_id: operator.operator_id });
  const already = new Set(printed.map(n => `${n.maintenance_log_id}:${n.notice_type}`));

  const registerNum = sessionStorage.getItem("pos_register_num") || "";
  const regs = registerNum ? await base44.entities.Register.filter({ register_id: registerNum }) : [];
  const reg = regs[0];
  const settings = (await base44.entities.StoreSettings.list())[0] || {};

  const queue = [
    ...pre.map(l => ({ log: l, type: "pre" })),
    ...post.map(l => ({ log: l, type: "post" })),
  ].filter(({ log, type }) => !already.has(`${log.id}:${type}`));

  for (const { log, type } of queue) {
    await printReceipt({
      docType: "notice",
      notice: buildNotice(log, type, operator),
      printerIp: reg?.printer_ip,
      registerName: registerNum,
      registerId: registerNum,
      operatorName: operator.full_name,
      operatorPin: operator.operator_id,
      storeInfo: settings,
      openDrawer: false,
    });
    await base44.entities.MaintenanceNotice.create({
      maintenance_log_id: log.id,
      notice_type: type,
      operator_id: operator.operator_id,
      operator_name: operator.full_name,
      register_id: registerNum,
      printed_at: new Date().toISOString(),
    });
  }
}