import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import PCIScoreHeader from "@/components/pci/PCIScoreHeader";
import PCIAutoChecksPanel from "@/components/pci/PCIAutoChecksPanel";
import PCIControlTable from "@/components/pci/PCIControlTable";
import PCIControlDialog from "@/components/pci/PCIControlDialog";
import { PCI_REQUIREMENTS, buildAutoChecks, scoreChecks, controlIsStale } from "@/lib/pciCompliance";

export default function AdminPCICompliance() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState([]);
  const [controls, setControls] = useState([]);
  const [editing, setEditing] = useState(null);
  const [me, setMe] = useState(null);

  const load = async () => {
    setLoading(true);
    const [audits, registers, transactions, operators, stores, saved, user] = await Promise.all([
      base44.entities.AuditTrail.list("-created_date", 500),
      base44.entities.Register.list(),
      base44.entities.Transaction.list("-created_date", 200),
      base44.entities.Operator.list(),
      base44.entities.Store.list(),
      base44.entities.PCIControl.list(),
      base44.auth.me().catch(() => null),
    ]);
    setMe(user);
    setChecks(buildAutoChecks({ audits, registers, transactions, operators, stores }));

    // Seed the 12 requirements once, so the dashboard is never an empty page waiting on
    // someone to invent the control list themselves.
    let list = saved;
    const missing = PCI_REQUIREMENTS.filter((r) => !saved.some((s) => s.control_id === r.control_id));
    if (missing.length) {
      await base44.entities.PCIControl.bulkCreate(missing.map((r) => ({ ...r, status: "in_progress" })));
      list = await base44.entities.PCIControl.list();
    }
    setControls([...list].sort((a, b) => a.requirement - b.requirement));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (control, form) => {
    await base44.entities.PCIControl.update(control.id, { ...form, reviewed_by: me?.full_name || "" });
    await base44.entities.AuditTrail.create({
      action: `PCI control attested — Requirement ${control.requirement}`,
      category: "system",
      description: `${control.title} set to "${form.status}". Owner: ${form.owner_name || "none"}. Last reviewed: ${form.last_reviewed || "not set"}. Evidence: ${form.evidence_notes || "none recorded"}.`,
      actor_name: me?.full_name || "",
      page: "/admin/pci-compliance",
    });
    setEditing(null);
    load();
  };

  const score = scoreChecks(checks);
  const attested = controls.filter((c) => c.status === "compliant" || c.status === "not_applicable").length;
  const stale = controls.filter(controlIsStale).length;

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading compliance status…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">PCI Compliance</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-2xl">
              This system never handles a card number — the pinpad captures and encrypts it, so the assessment scope is the environment around it: access control, logging and terminal integrity.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1.5" />Re-run checks
        </Button>
      </div>

      <PCIScoreHeader score={score} controlsAttested={attested} controlsTotal={controls.length} staleCount={stale} />
      <PCIAutoChecksPanel checks={checks} />
      <PCIControlTable controls={controls} checks={checks} onEdit={setEditing} />

      <p className="text-xs text-gray-400">
        This dashboard tracks your own controls and evidence. It is not a substitute for a formal assessment — an SAQ or a QSA audit is still what establishes compliance.
      </p>

      <PCIControlDialog control={editing} onClose={() => setEditing(null)} onSave={handleSave} />
    </div>
  );
}