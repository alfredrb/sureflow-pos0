import React, { useState } from "react";
import { FileSearch, FlaskConical, GitBranch, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logAuditEvent } from "@/lib/auditLogger";
import VendorFindingsPanel from "@/components/techdocs/VendorFindingsPanel";
import CheckDualSideResolution from "@/components/techdocs/CheckDualSideResolution";
import { CURRENT_FLOW, CAPTURE_STEPS, DECISION_GATE, VENDOR_FINDINGS, SOURCE_REFERENCES } from "@/lib/checkDualSideInvestigation";

const OUTCOMES = [
  { value: "go", label: "GO — endorsement (E/P) option fitted, frames captured" },
  { value: "no_go", label: "NO-GO — standard model, face printing only" },
  { value: "mixed", label: "MIXED FLEET — E/P on some lanes only" },
];

export default function CheckDualSideInvestigation() {
  const [model, setModel] = useState("");
  const [outcome, setOutcome] = useState("");
  const [findings, setFindings] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const record = async () => {
    if (!outcome) return;
    setSaving(true);
    const label = OUTCOMES.find((o) => o.value === outcome)?.label || outcome;
    await logAuditEvent({
      action: "Recorded Cheque Dual-Side Investigation Finding",
      category: "system",
      description:
        `Cheque dual-side print investigation on ${model || "unspecified unit"} — decision: ${label}. ` +
        `Findings: ${findings || "none recorded"}.`,
      page: "/admin/technical-docs",
      changes: [
        { field: "printer_model", from: "", to: model || "" },
        { field: "decision", from: "", to: outcome },
      ],
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
            <FlaskConical className="h-4 w-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Cheque Dual-Side Printing</p>
            <p className="text-[11px] text-gray-400">Investigation closed · NO-GO · endorsement unit not installed on the inspected lane</p>
          </div>
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-gray-600">
          <p>
            A cheque tender is one insertion today and prints one side only, which is why the store reinserts the cheque by
            hand. Epson's manuals now answer the architecture: the <strong>slip station prints the face</strong>, and
            printing the <strong>back</strong> requires the separate <strong>endorsement (E/P) mechanism</strong> — a second
            impact head that is a <strong>factory-installed option</strong>.
          </p>
          <p>
            The inspected lane's capability report shows that option is <strong>not installed</strong>, which closes the
            question for this printer and carries a consequence for the existing franking legend — see below.
          </p>
        </div>
      </div>

      <CheckDualSideResolution />

      <VendorFindingsPanel findings={VENDOR_FINDINGS} sources={SOURCE_REFERENCES} />

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-900">What the lane does today</p>
          <p className="mt-0.5 text-[11px] text-gray-400">One insertion, one side — the current relay cheque sequence</p>
        </div>
        <ol className="divide-y divide-gray-100">
          {CURRENT_FLOW.map((f) => (
            <li key={f.cmd} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
              <span className="w-48 shrink-0 font-mono text-[11px] text-blue-700">{f.cmd}</span>
              <span className="text-xs leading-relaxed text-gray-600">{f.detail}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <FileSearch className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Capture procedure</p>
        </div>
        <ol className="divide-y divide-gray-100">
          {CAPTURE_STEPS.map((s, i) => (
            <li key={s.step} className="flex gap-3 p-4">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                {i + 1}
              </span>
              <div>
                <p className="text-xs font-semibold text-gray-900">{s.step}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <GitBranch className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-900">Decision gate</p>
        </div>
        <ul className="divide-y divide-gray-100">
          {DECISION_GATE.map((d) => (
            <li key={d.outcome} className="p-4">
              <p className="text-xs font-semibold text-gray-900">{d.outcome}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">{d.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Record the finding</p>
        <p className="mt-0.5 mb-4 text-[11px] leading-snug text-gray-400">
          Writes the decision to the audit trail so the outcome has provenance — which unit was inspected, what was found,
          and who decided.
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Printer model / serial inspected</label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="TM-H6000IV — serial X4YZ00123" className="font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Decision</label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue placeholder="Select the go/no-go outcome" /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Findings</label>
            <Textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={4}
              placeholder="Self-test station list, E/P option present?, which side the current legend printed on, captured frames, two-pass timing…"
              className="text-sm"
            />
          </div>
          <Button onClick={record} disabled={!outcome || saving} className="w-full bg-purple-600 hover:bg-purple-700">
            {saved ? <><Check className="mr-2 h-4 w-4" /> Recorded to audit trail</> : saving ? "Recording…" : "Record finding"}
          </Button>
        </div>
      </div>
    </div>
  );
}