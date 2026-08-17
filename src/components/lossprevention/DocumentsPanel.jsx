import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Scale, AlertTriangle, FileSignature, Printer, ChevronRight, Paperclip, Upload, Utensils } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const today = moment().format("YYYY-MM-DD");

const DOCS = [
  { id: "raf", label: "Register Audit Form", desc: "Cash variance acknowledgment signed by the operator and supervisor.", icon: Scale, color: "text-amber-600 bg-amber-50" },
  { id: "robbery", label: "Robbery Report", desc: "Incident details, amount stolen, suspect info, and police notification.", icon: AlertTriangle, color: "text-red-600 bg-red-50" },
  { id: "incident", label: "Incident Report", desc: "General incident log — theft, damage, injury, disputes, or other.", icon: FileText, color: "text-blue-600 bg-blue-50" },
  { id: "statement", label: "Employee Statement", desc: "Written statement from an employee regarding an incident or case.", icon: FileSignature, color: "text-purple-600 bg-purple-50" },
  { id: "meal", label: "Meal Exception Report", desc: "Record of a meal break exception — lunch not taken, taken late, or supervisor override to work past lunch.", icon: Utensils, color: "text-orange-600 bg-orange-50" },
];

const initial = {
  raf: { register_id: "", register_name: "", date: today, operator_name: "", operator_id: "", shift: "", expected_cash: "", counted_cash: "", variance: "", variance_type: "short", reason: "", supervisor_name: "", operator_signature: "", supervisor_signature: "", witness: "" },
  robbery: { incident_date: "", register_id: "", operator_name: "", operator_id: "", amount_stolen: "", description: "", suspect: "", police_notified: "No", police_report: "", witnesses: "", reported_by: "", signature: "" },
  incident: { date: today, location: "", type: "theft", operator_name: "", operator_id: "", description: "", action_taken: "", reported_by: "", supervisor_name: "", signature: "" },
  statement: { employee_name: "", employee_id: "", date: today, subject: "", statement: "", witness: "", signature: "" },
  meal: { date: today, operator_name: "", operator_id: "", register_id: "", exception_type: "not_taken", scheduled_lunch: "", actual_lunch: "", minutes_late: "", override_by: "", description: "", supervisor_name: "", signature: "" },
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function printDoc(title, bodyHtml) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    * { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; box-sizing: border-box; }
    body { color: #111; padding: 32px; max-width: 850px; margin: 0 auto; }
    .head { text-align: center; border-bottom: 3px double #111; padding-bottom: 12px; margin-bottom: 18px; }
    .head h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
    .head .sub { font-size: 12px; color: #555; margin-top: 4px; }
    .row { display: flex; gap: 16px; margin-bottom: 10px; }
    .field { flex: 1; }
    .field .k { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #666; font-weight: 600; }
    .field .v { font-size: 14px; border-bottom: 1px solid #999; padding: 4px 0 2px; min-height: 22px; }
    .section { font-weight: 700; text-transform: uppercase; font-size: 12px; letter-spacing: .5px; color: #444; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
    .body { font-size: 13px; line-height: 1.6; margin: 8px 0 14px; white-space: pre-wrap; }
    .sigs { display: flex; gap: 40px; margin-top: 40px; }
    .sig { flex: 1; }
    .sig .line { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; color: #555; text-align: center; }
    .toolbar { position: fixed; top: 12px; right: 12px; }
    .toolbar button { padding: 6px 14px; font-size: 13px; cursor: pointer; }
    @media print { .toolbar { display: none; } }
  </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Print</button></div>
    <div class="head"><h1>${esc(title)}</h1><div class="sub">SureFlow POS — Loss Prevention Workbench · Generated ${moment().format("MMM D, YYYY h:mm A")}</div></div>
    ${bodyHtml}
    <p style="margin-top:40px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:8px;text-align:center;">SureFlow POS Loss Prevention Document</p>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=850,height=1000");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  return true;
}

const field = (k, v) => `<div class="field"><div class="k">${esc(k)}</div><div class="v">${esc(v || "—")}</div></div>`;

const docSummary = (doc, f) => {
  if (doc === "raf") return `RAF — ${f.operator_name || "—"} — ${f.variance_type} $${Number(f.variance || 0).toFixed(2)} (reg ${f.register_id || "—"})`;
  if (doc === "robbery") return `Robbery Report — ${f.operator_name || "—"} — $${Number(f.amount_stolen || 0).toFixed(2)} stolen`;
  if (doc === "incident") return `Incident Report — ${f.type || "—"} — ${f.operator_name || "—"}`;
  if (doc === "meal") return `Meal Exception — ${f.exception_type || "—"} — ${f.operator_name || "—"} (${f.date || "—"})`;
  return `Employee Statement — ${f.employee_name || "—"} — ${f.subject || "—"}`;
};
const docAmount = (doc, f) => (doc === "raf" ? Number(f.variance || 0) : doc === "robbery" ? Number(f.amount_stolen || 0) : doc === "meal" ? Number(f.minutes_late || 0) : 0);

export default function DocumentsPanel({ logs = [], audits = [], registers = [] }) {
  const [active, setActive] = useState("raf");
  const [forms, setForms] = useState(initial);
  const [operators, setOperators] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [selectedInvs, setSelectedInvs] = useState(new Set());
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const [linking, setLinking] = useState(false);
  const { toast } = useToast();
  const adminName = (() => { try { return JSON.parse(sessionStorage.getItem("admin_operator"))?.full_name || "Admin"; } catch { return "Admin"; } })();

  useEffect(() => { base44.entities.Operator.list().then(setOperators).catch(() => {}); }, []);
  useEffect(() => { base44.entities.Investigation.list("-updated_date", 200).then(list => setInvestigations(list.filter(i => i.status !== "closed"))).catch(() => {}); }, []);

  const set = (doc, k, v) => setForms(f => ({ ...f, [doc]: { ...f[doc], [k]: v } }));
  const assignOperator = (doc, opId) => {
    const op = operators.find(o => o.id === opId);
    if (!op) return;
    setForms(f => ({ ...f, [doc]: { ...f[doc], operator_name: op.full_name || op.operator_id || "", operator_id: op.operator_id || "", employee_name: doc === "statement" ? (op.full_name || op.operator_id || "") : (f[doc].employee_name || ""), employee_id: doc === "statement" ? (op.operator_id || "") : (f[doc].employee_id || "") } }));
  };

  const buildDoc = (doc) => {
    const f = forms[doc];
    let title = "", body = "";
    if (doc === "raf") {
      title = "Register Audit Form (RAF)";
      body = `<div class="row">${field("Date", f.date)}${field("Register", f.register_name || f.register_id)}${field("Register ID", f.register_id)}${field("Shift", f.shift)}</div>
        <div class="row">${field("Operator", f.operator_name)}${field("Operator ID", f.operator_id)}</div>
        <div class="section">Cash Count</div>
        <div class="row">${field("Expected Cash", f.expected_cash ? `$${Number(f.expected_cash).toFixed(2)}` : "")}${field("Counted Cash", f.counted_cash ? `$${Number(f.counted_cash).toFixed(2)}` : "")}${field("Variance Type", f.variance_type)}${field("Variance Amount", f.variance ? `$${Number(f.variance).toFixed(2)}` : "")}</div>
        <div class="section">Explanation</div>
        <div class="body">${esc(f.reason || "—")}</div>
        <div class="section">Acknowledgment</div>
        <div class="body">I acknowledge the cash variance stated above. The information provided is accurate to the best of my knowledge. I understand this form becomes part of the loss prevention record and may be reviewed by management.</div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.operator_signature || " ")}</div>Operator Signature</div><div class="sig"><div class="line">${esc(f.supervisor_signature || " ")}</div>Supervisor Signature (${esc(f.supervisor_name || "—")})</div></div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.witness || " ")}</div>Witness (if any)</div></div>`;
    } else if (doc === "robbery") {
      title = "Robbery Report";
      body = `<div class="row">${field("Date / Time of Incident", f.incident_date ? moment(f.incident_date).format("MMM D, YYYY h:mm A") : "")}${field("Register", f.register_id)}</div>
        <div class="row">${field("Operator on Duty", f.operator_name)}${field("Operator ID", f.operator_id)}</div>
        <div class="row">${field("Amount Stolen", f.amount_stolen ? `$${Number(f.amount_stolen).toFixed(2)}` : "")}</div>
        <div class="section">Incident Description</div>
        <div class="body">${esc(f.description || "—")}</div>
        <div class="section">Suspect Description</div>
        <div class="body">${esc(f.suspect || "—")}</div>
        <div class="row">${field("Police Notified", f.police_notified)}${field("Police Report #", f.police_report)}${field("Witnesses", f.witnesses)}</div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.signature || " ")}</div>Reported By (${esc(f.reported_by || "—")})</div></div>`;
    } else if (doc === "incident") {
      title = "Incident Report";
      body = `<div class="row">${field("Date", f.date)}${field("Location / Register", f.location)}${field("Incident Type", f.type)}</div>
        <div class="row">${field("Operator Involved", f.operator_name)}${field("Operator ID", f.operator_id)}</div>
        <div class="section">Description</div>
        <div class="body">${esc(f.description || "—")}</div>
        <div class="section">Action Taken</div>
        <div class="body">${esc(f.action_taken || "—")}</div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.signature || " ")}</div>Reported By (${esc(f.reported_by || "—")})</div><div class="sig"><div class="line">${esc(f.supervisor_name || " ")}</div>Supervisor</div></div>`;
    } else if (doc === "meal") {
      title = "Meal Exception Report";
      body = `<div class="row">${field("Date", f.date)}${field("Register", f.register_id)}${field("Exception Type", f.exception_type)}</div>
        <div class="row">${field("Operator", f.operator_name)}${field("Operator ID", f.operator_id)}</div>
        <div class="row">${field("Scheduled Lunch", f.scheduled_lunch)}${field("Actual Lunch Start", f.actual_lunch ? moment(f.actual_lunch).format("MMM D, YYYY h:mm A") : "")}${field("Minutes Late", f.minutes_late)}</div>
        <div class="row">${field("Override Authorized By", f.override_by)}</div>
        <div class="section">Description</div>
        <div class="body">${esc(f.description || "—")}</div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.signature || " ")}</div>Operator Signature</div><div class="sig"><div class="line">${esc(f.supervisor_name || " ")}</div>Supervisor (${esc(f.supervisor_name || "—")})</div></div>`;
    } else {
      title = "Employee Statement";
      body = `<div class="row">${field("Employee Name", f.employee_name)}${field("Employee ID", f.employee_id)}${field("Date", f.date)}</div>
        <div class="row">${field("Statement Regarding", f.subject)}</div>
        <div class="section">Statement</div>
        <div class="body">${esc(f.statement || "—")}</div>
        <div class="body" style="font-size:11px;color:#555;">I declare that the statement above is true and accurate to the best of my knowledge.</div>
        <div class="sigs"><div class="sig"><div class="line">${esc(f.signature || " ")}</div>Employee Signature</div><div class="sig"><div class="line">${esc(f.witness || " ")}</div>Witness</div></div>`;
    }
    return { title, body };
  };
  const handlePrint = (doc) => {
    const { title, body } = buildDoc(doc);
    if (!printDoc(title, body)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the document.", variant: "destructive" });
  };

  const toggleInv = (id) => setSelectedInvs(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelectedInvs(prev => (prev.size === investigations.length && investigations.length > 0) ? new Set() : new Set(investigations.map(i => i.id)));

  const addToInvestigation = async () => {
    if (selectedInvs.size === 0) { toast({ title: "Select at least one investigation", variant: "destructive" }); return; }
    const f = forms[active];
    setLinking(true);
    try {
      const { title, body } = buildDoc(active);
      const docLabel = DOCS.find(d => d.id === active).label;
      const now = new Date().toISOString();
      const entry = { type: "document", ref: active, detail: docSummary(active, f), amount: docAmount(active, f), date: now, document_title: title, document_html: body };
      const ids = [...selectedInvs];
      await Promise.all(ids.map(async id => {
        const inv = await base44.entities.Investigation.get(id);
        const evidence = Array.isArray(inv.evidence) ? inv.evidence : [];
        const activity = Array.isArray(inv.activity_log) ? inv.activity_log : [];
        evidence.push(entry);
        activity.push({ date: now, by: adminName, action: "document_added", note: `Added ${docLabel}` });
        return base44.entities.Investigation.update(id, { evidence, activity_log: activity });
      }));
      toast({ title: `Added to ${ids.length} investigation${ids.length > 1 ? "s" : ""}`, description: docSummary(active, f) });
      setSelectedInvs(new Set());
    } catch (e) {
      toast({ title: "Failed to add", description: String(e.message || e), variant: "destructive" });
    } finally { setLinking(false); }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast({ title: "Choose a file to upload", variant: "destructive" }); return; }
    if (selectedInvs.size === 0) { toast({ title: "Select at least one investigation", variant: "destructive" }); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const now = new Date().toISOString();
      const label = uploadTitle.trim() || file.name;
      const entry = { type: "document", ref: file.name, detail: label, date: now, document_title: label, document_html: `<p style="font-size:13px;">Uploaded document/receipt: <a href="${file_url}" target="_blank" rel="noopener">${file.name}</a></p>` };
      const ids = [...selectedInvs];
      await Promise.all(ids.map(async id => {
        const inv = await base44.entities.Investigation.get(id);
        const evidence = Array.isArray(inv.evidence) ? inv.evidence : [];
        const activity = Array.isArray(inv.activity_log) ? inv.activity_log : [];
        evidence.push(entry);
        activity.push({ date: now, by: adminName, action: "document_uploaded", note: `Uploaded ${file.name}` });
        return base44.entities.Investigation.update(id, { evidence, activity_log: activity });
      }));
      toast({ title: `Linked to ${ids.length} investigation${ids.length > 1 ? "s" : ""}`, description: file.name });
      setUploadTitle(""); if (fileRef.current) fileRef.current.value = ""; setSelectedInvs(new Set());
    } catch (e) {
      toast({ title: "Upload failed", description: String(e.message || e), variant: "destructive" });
    } finally { setUploading(false); }
  };

  const renderAssign = (doc) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <Label>Assign Operator</Label>
        <Select value="" onValueChange={v => assignOperator(doc, v)}>
          <SelectTrigger><span className="text-gray-400">Select from operators...</span></SelectTrigger>
          <SelectContent>{operators.filter(o => o.status !== "inactive").map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}{o.operator_id ? ` (${o.operator_id})` : ""} · {o.role}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>
  );

  const F = ({ k, label, value, type = "text", opts = [] }) => (
    <div><Label>{label}</Label>{type === "select" ? (
      <Select value={value} onValueChange={v => set(active, k, v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
    ) : type === "textarea" ? (
      <Textarea rows={3} value={value} onChange={e => set(active, k, e.target.value)} />
    ) : (
      <Input type={type} value={value} onChange={e => set(active, k, e.target.value)} />
    )}</div>
  );

  const f = forms[active];

  const renderForm = () => {
    if (active === "raf") return (
      <div className="space-y-4">
        {renderAssign("raf")}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <F k="date" label="Date" value={f.date} type="date" />
          <F k="register_name" label="Register Name" value={f.register_name} />
          <F k="register_id" label="Register ID" value={f.register_id} />
          <F k="shift" label="Shift" value={f.shift} />
          <F k="operator_name" label="Operator Name" value={f.operator_name} />
          <F k="operator_id" label="Operator ID" value={f.operator_id} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <F k="expected_cash" label="Expected Cash" value={f.expected_cash} type="number" />
          <F k="counted_cash" label="Counted Cash" value={f.counted_cash} type="number" />
          <F k="variance_type" label="Variance Type" value={f.variance_type} type="select" opts={["short", "over"]} />
          <F k="variance" label="Variance Amount" value={f.variance} type="number" />
        </div>
        <F k="reason" label="Explanation / Reason" value={f.reason} type="textarea" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="supervisor_name" label="Supervisor Name" value={f.supervisor_name} />
          <F k="operator_signature" label="Operator Signature (typed)" value={f.operator_signature} />
          <F k="supervisor_signature" label="Supervisor Signature (typed)" value={f.supervisor_signature} />
          <F k="witness" label="Witness" value={f.witness} />
        </div>
      </div>
    );
    if (active === "robbery") return (
      <div className="space-y-4">
        {renderAssign("robbery")}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="incident_date" label="Date / Time of Incident" value={f.incident_date} type="datetime-local" />
          <F k="register_id" label="Register" value={f.register_id} />
          <F k="amount_stolen" label="Amount Stolen" value={f.amount_stolen} type="number" />
          <F k="operator_name" label="Operator on Duty" value={f.operator_name} />
          <F k="operator_id" label="Operator ID" value={f.operator_id} />
        </div>
        <F k="description" label="Incident Description" value={f.description} type="textarea" />
        <F k="suspect" label="Suspect Description" value={f.suspect} type="textarea" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="police_notified" label="Police Notified" value={f.police_notified} type="select" opts={["Yes", "No"]} />
          <F k="police_report" label="Police Report #" value={f.police_report} />
          <F k="witnesses" label="Witnesses" value={f.witnesses} />
          <F k="reported_by" label="Reported By" value={f.reported_by} />
          <F k="signature" label="Signature (typed)" value={f.signature} />
        </div>
      </div>
    );
    if (active === "incident") return (
      <div className="space-y-4">
        {renderAssign("incident")}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="date" label="Date" value={f.date} type="date" />
          <F k="location" label="Location / Register" value={f.location} />
          <F k="type" label="Incident Type" value={f.type} type="select" opts={["theft", "damage", "injury", "dispute", "other"]} />
          <F k="operator_name" label="Operator Involved" value={f.operator_name} />
          <F k="operator_id" label="Operator ID" value={f.operator_id} />
        </div>
        <F k="description" label="Description" value={f.description} type="textarea" />
        <F k="action_taken" label="Action Taken" value={f.action_taken} type="textarea" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="reported_by" label="Reported By" value={f.reported_by} />
          <F k="supervisor_name" label="Supervisor" value={f.supervisor_name} />
          <F k="signature" label="Signature (typed)" value={f.signature} />
        </div>
      </div>
    );
    if (active === "meal") return (
      <div className="space-y-4">
        {renderAssign("meal")}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="date" label="Date" value={f.date} type="date" />
          <F k="exception_type" label="Exception Type" value={f.exception_type} type="select" opts={["not_taken", "late", "override"]} />
          <F k="register_id" label="Register" value={f.register_id} />
          <F k="operator_name" label="Operator Name" value={f.operator_name} />
          <F k="operator_id" label="Operator ID" value={f.operator_id} />
          <F k="scheduled_lunch" label="Scheduled Lunch" value={f.scheduled_lunch} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="actual_lunch" label="Actual Lunch Start" value={f.actual_lunch} type="datetime-local" />
          <F k="minutes_late" label="Minutes Late" value={f.minutes_late} type="number" />
          <F k="override_by" label="Override Authorized By" value={f.override_by} />
        </div>
        <F k="description" label="Description / Notes" value={f.description} type="textarea" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <F k="supervisor_name" label="Supervisor Name" value={f.supervisor_name} />
          <F k="signature" label="Signature (typed)" value={f.signature} />
        </div>
      </div>
    );
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Assign Employee</Label>
            <Select value="" onValueChange={v => assignOperator("statement", v)}>
              <SelectTrigger><span className="text-gray-400">Select from operators...</span></SelectTrigger>
              <SelectContent>{operators.filter(o => o.status !== "inactive").map(o => <SelectItem key={o.id} value={o.id}>{o.full_name}{o.operator_id ? ` (${o.operator_id})` : ""} · {o.role}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <F k="date" label="Date" value={f.date} type="date" />
          <F k="employee_name" label="Employee Name" value={f.employee_name} />
          <F k="employee_id" label="Employee ID" value={f.employee_id} />
        </div>
        <F k="subject" label="Statement Regarding" value={f.subject} />
        <F k="statement" label="Statement" value={f.statement} type="textarea" />
        <div className="grid grid-cols-2 gap-3">
          <F k="witness" label="Witness" value={f.witness} />
          <F k="signature" label="Signature (typed)" value={f.signature} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {DOCS.map(d => (
          <button key={d.id} onClick={() => setActive(d.id)} className={`text-left p-4 rounded-2xl border transition-all ${active === d.id ? "border-amber-400 shadow-md bg-white" : "border-gray-100 bg-white hover:border-gray-300"}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${d.color}`}><d.icon className="w-5 h-5" /></div>
            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1">{d.label}{active === d.id && <ChevronRight className="w-3.5 h-3.5 text-amber-600" />}</p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{d.desc}</p>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{DOCS.find(d => d.id === active).label}</h3>
          <Button onClick={() => handlePrint(active)} className="bg-amber-600 hover:bg-amber-500"><Printer className="w-4 h-4 mr-1.5" /> Print Document</Button>
        </div>
        {renderForm()}
        <div className="mt-5 pt-4 border-t border-gray-100 space-y-4">
          <div>
            <Label>Upload Document / Receipt</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="flex-1 text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:font-medium hover:file:bg-gray-200" />
              <Input placeholder="Title / note (optional)" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="sm:w-64" />
              <Button variant="outline" onClick={handleUpload} disabled={uploading}><Upload className="w-4 h-4 mr-1.5" />{uploading ? "Uploading..." : "Upload & Link"}</Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Link to Open Investigations</Label>
              <button onClick={toggleAll} className="text-xs text-amber-600 hover:text-amber-700 font-medium">{selectedInvs.size === investigations.length && investigations.length > 0 ? "Clear all" : "Select all"}</button>
            </div>
            <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50">
              {investigations.length === 0 ? <div className="px-3 py-4 text-sm text-gray-400 text-center">No open investigations</div> : investigations.map(i => (
                <label key={i.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={selectedInvs.has(i.id)} onChange={() => toggleInv(i.id)} className="w-4 h-4" />
                  <span className="text-sm text-gray-800 flex-1 truncate">{i.title}</span>
                  <span className="text-[11px] text-gray-400">{i.status} · {i.operator_name || "—"}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Button onClick={addToInvestigation} disabled={linking || selectedInvs.size === 0} className="bg-amber-600 hover:bg-amber-500"><Paperclip className="w-4 h-4 mr-1.5" />{linking ? "Adding..." : `Add Form to ${selectedInvs.size || "Selected"} Investigation${selectedInvs.size === 1 ? "" : "s"}`}</Button>
            <span className="text-xs text-gray-400">The current {DOCS.find(d => d.id === active).label} will be attached as evidence to each selected case.</span>
          </div>
        </div>
      </div>
    </div>
  );
}