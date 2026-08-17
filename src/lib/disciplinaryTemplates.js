// Standard disciplinary document templates (SBI: Situation · Behavior · Impact)
// shared by the Employee Manager (generate) and the LP Workbench (attach as evidence).

const escapeHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const today = () => new Date().toISOString().slice(0, 10);

export const TIER_META = {
  green: { id: "green", label: "Green — Coaching", cls: "bg-emerald-100 text-emerald-700", bar: "#10b981", description: "Informal coaching and verbal warnings for minor, first-time issues." },
  yellow: { id: "yellow", label: "Yellow — Formal Warning", cls: "bg-amber-100 text-amber-700", bar: "#f59e0b", description: "Formal written warnings and improvement plans." },
  red: { id: "red", label: "Red — Serious Action", cls: "bg-red-100 text-red-700", bar: "#ef4444", description: "Final warnings and serious disciplinary action notices." },
};

export const TEMPLATES = [
  { id: "verbal_warning", tier: "green", type: "verbal_warning", title: "Verbal Warning", category: "warning", severity: "low",
    sbiHints: { situation: "When and where the incident occurred", behavior: "What the employee did or failed to do", impact: "How it affected the team, operation, or safety" } },
  { id: "coaching", tier: "green", type: "coaching", title: "Coaching Conversation", category: "feedback", severity: "low",
    sbiHints: { situation: "The context or task involved", behavior: "The observed behavior or gap", impact: "Why a change is needed" } },
  { id: "written_warning", tier: "yellow", type: "written_warning", title: "Written Warning", category: "warning", severity: "medium",
    sbiHints: { situation: "The incident or pattern of incidents", behavior: "The specific conduct or performance issue", impact: "The operational or team impact" } },
  { id: "pip", tier: "yellow", type: "pip", title: "Performance Improvement Plan", category: "warning", severity: "medium",
    sbiHints: { situation: "The performance expectations and review period", behavior: "Where performance has fallen short", impact: "The impact on the role and team" } },
  { id: "final_warning", tier: "red", type: "final_warning", title: "Final Written Warning", category: "disciplinary", severity: "high",
    sbiHints: { situation: "The serious incident or repeated violations", behavior: "The conduct at issue", impact: "The serious impact and consequences of recurrence" } },
  { id: "disciplinary_notice", tier: "red", type: "disciplinary_notice", title: "Disciplinary Action Notice", category: "disciplinary", severity: "high",
    sbiHints: { situation: "The event triggering this action", behavior: "The behavior or violation confirmed", impact: "The action being taken and rationale" } },
];

export const getTemplatesByTier = (tier) => TEMPLATES.filter(t => t.tier === tier);
export const getTemplate = (type) => TEMPLATES.find(t => t.type === type);

export const renderDocumentBody = (template, employee, fields = {}) => {
  const tier = TIER_META[template.tier] || TIER_META.yellow;
  const date = fields.date || today();
  const emp = employee || {};
  const rows = [
    ["Employee", emp.full_name || emp.employee_name || "—"],
    ["Employee ID", emp.employee_id || "—"],
    ["Position", emp.position || "—"],
    ["Department", emp.department || "—"],
    ["Operator ID", emp.operator_id || "—"],
  ].map(([k, v]) => `<tr><td style="color:#666;width:140px;font-weight:600;padding:3px 0;">${escapeHtml(k)}</td><td style="padding:3px 0;">${escapeHtml(v)}</td></tr>`).join("");
  const sbiBlock = (label, value) => `<div style="margin-bottom:12px;"><strong style="font-size:13px;color:#111;">${label}</strong><p style="font-size:13px;line-height:1.5;margin:4px 0 0;white-space:pre-wrap;">${escapeHtml(value || "—")}</p></div>`;
  const optBlock = (label, value) => value ? `<div style="margin-bottom:12px;"><strong style="font-size:13px;color:#111;">${label}</strong><p style="font-size:13px;line-height:1.5;margin:4px 0 0;white-space:pre-wrap;">${escapeHtml(value)}</p></div>` : "";
  return `
  <div style="border-left:6px solid ${tier.bar};padding:14px 18px;background:#fafafa;border-radius:6px;margin-bottom:14px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${tier.bar};">${tier.label}</div>
    <h1 style="font-size:20px;margin:4px 0 2px;">${escapeHtml(template.title)}</h1>
    <div style="font-size:12px;color:#666;">SureFlow POS · Disciplinary Record · ${escapeHtml(date)}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:14px;">${rows}</table>
  <h2 style="font-size:14px;border-bottom:2px solid #111;padding-bottom:4px;margin:18px 0 4px;">SBI Breakdown</h2>
  <p style="font-size:12px;color:#666;margin:0 0 10px;">Situation · Behavior · Impact</p>
  ${sbiBlock("Situation", fields.situation)}
  ${sbiBlock("Behavior", fields.behavior)}
  ${sbiBlock("Impact", fields.impact)}
  ${optBlock("Action Taken", fields.action_taken)}
  ${optBlock("Follow-up / Next Steps", fields.follow_up)}
  <div style="display:flex;gap:40px;margin-top:36px;">
    <div style="flex:1;"><div style="border-top:1px solid #111;padding-top:4px;font-size:11px;color:#555;">Employee Signature / Date</div></div>
    <div style="flex:1;"><div style="border-top:1px solid #111;padding-top:4px;font-size:11px;color:#555;">Manager Signature / Date</div></div>
  </div>
  <p style="font-size:11px;color:#999;margin-top:24px;">SureFlow POS · ${tier.label} · Confidential</p>`;
};

export const printDocument = (template, employee, fields) => {
  const body = renderDocumentBody(template, employee, fields);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${template.title}</title><style>*{font-family:Arial,Helvetica,sans-serif;}body{color:#111;padding:32px;max-width:820px;margin:0 auto;}@media print{.toolbar{display:none;}}</style></head><body><div class="toolbar" style="position:fixed;top:12px;right:12px;"><button onclick="window.print()" style="padding:6px 14px;font-size:13px;cursor:pointer;">Print / Save PDF</button></div>${body}</body></html>`;
  const w = window.open("", "_blank", "width=860,height=1000");
  if (!w) return false;
  w.document.write(html); w.document.close(); w.focus();
  return true;
};

// Build an evidence item (for LP investigation evidence) from a feedback record.
export const buildEvidenceFromFeedback = (feedback, employee) => {
  const template = getTemplate(feedback.template_type) || { tier: feedback.tier || "yellow", type: feedback.template_type, title: feedback.title || "Disciplinary Record" };
  const fields = { situation: feedback.situation, behavior: feedback.behavior, impact: feedback.impact, action_taken: feedback.action_taken, date: feedback.date };
  const emp = { ...(employee || {}), full_name: feedback.employee_name || employee?.full_name, employee_id: feedback.employee_id, operator_id: feedback.operator_id };
  const body = renderDocumentBody(template, emp, fields);
  const tier = TIER_META[template.tier] || TIER_META.yellow;
  return {
    type: "document",
    document_title: `${template.title} — ${emp.full_name || emp.employee_id || ""} (${tier.label.split(" — ")[0]})`,
    document_html: body,
    detail: `Disciplinary record · ${feedback.category || "disciplinary"}${feedback.severity ? ` · ${feedback.severity}` : ""}`,
    date: feedback.date ? new Date(feedback.date).toISOString() : new Date().toISOString(),
  };
};