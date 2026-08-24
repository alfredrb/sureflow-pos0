import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getAdminAccess } from "@/lib/adminAccess";
import { logAuditEvent } from "@/lib/auditLogger";
import { FACILITY_STATUSES, crossPostMaintenanceLog } from "@/lib/facilityRequests";
import FacilityRequestQueue from "@/components/facility/FacilityRequestQueue";
import FacilityRequestDetail from "@/components/facility/FacilityRequestDetail";
import FacilityRequestForm from "@/components/facility/FacilityRequestForm";
import FacilityDecisionPanel from "@/components/facility/FacilityDecisionPanel";

export default function AdminFacilityManagement() {
  const [operator, setOperator] = useState(null);
  const [requests, setRequests] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_operator");
    if (stored) setOperator(JSON.parse(stored));
  }, []);

  const access = getAdminAccess(operator);
  const isHQ = access.role === "hq_admin";
  const homeStore = operator?.home_store_id || operator?.store_id || "";
  // Store managers file for their own store only; HQ reviews the whole chain.
  const canSubmit = access.role === "store_manager" && !!homeStore;

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const [reqs, regs, ops] = await Promise.all([
      base44.entities.FacilityRequest.list("-created_date", 300),
      base44.entities.Register.list(),
      base44.entities.Operator.list(),
    ]);
    setRequests(isHQ ? reqs : reqs.filter((r) => !homeStore || r.store_id === homeStore));
    setRegisters(homeStore && !isHQ ? regs.filter((r) => r.store_id === homeStore) : regs);
    setTechnicians(ops.filter((o) => o.status === "active" && ["technician", "manager"].includes(o.role)));
    if (!silent) setLoading(false);
  };

  useEffect(() => { load(); }, [operator]);
  useRealtimeSync("FacilityRequest", () => load(true), { intervalMs: 30000 });

  const visible = requests.filter((r) => filterStatus === "all" || r.status === filterStatus);
  const current = visible.find((r) => r.id === selected?.id) || visible[0] || null;

  const submitRequest = async (form) => {
    setSaving(true);
    try {
      await base44.entities.FacilityRequest.create({
        ...form,
        store_id: homeStore,
        status: "submitted",
        submitted_by_operator_id: operator?.operator_id || "",
        submitted_by_operator_name: operator?.full_name || "",
      });
      await logAuditEvent({
        action: "Submitted Facility Request",
        category: "configuration",
        description: `Store ${homeStore} requested ${form.category.replace(/_/g, " ")}: ${form.subject}`,
        page: "/admin/facility",
      });
      toast({ title: "Request Submitted", description: "HQ will review and assign it." });
      setFormOpen(false);
      load(true);
    } catch (e) {
      toast({ title: "Could not submit", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  const decide = async (approved, values) => {
    setSaving(true);
    try {
      const status = approved ? (values.scheduled_date || values.assigned_operator_name ? "scheduled" : "approved") : "denied";
      const payload = {
        ...values,
        status,
        decided_by_name: operator?.full_name || "HQ",
        decided_at: new Date().toISOString(),
      };
      // Approved work cross-posts into the store's Maintenance Log so its timeline stays whole.
      if (approved) {
        const logId = await crossPostMaintenanceLog({ ...current, ...payload });
        if (logId) payload.maintenance_log_id = logId;
      }
      await base44.entities.FacilityRequest.update(current.id, payload);
      await logAuditEvent({
        action: approved ? "Approved Facility Request" : "Denied Facility Request",
        category: "configuration",
        description: `Store ${current.store_id} — "${current.subject}" was ${approved ? "approved" : "denied"}.${
          values.assigned_operator_name ? ` Assigned to ${values.assigned_operator_name}.` : ""
        }${values.assigned_hardware ? ` Hardware: ${values.assigned_hardware}.` : ""}${
          values.denial_reason ? ` Reason: ${values.denial_reason}` : ""
        }`,
        page: "/admin/facility",
      });
      toast({ title: approved ? "Request Approved" : "Request Denied" });
      load(true);
    } catch (e) {
      toast({ title: "Could not save decision", description: "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 sm:text-3xl">
            <Building2 className="h-7 w-7 text-blue-600" /> Facility Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isHQ
              ? "Every store's request for people, hardware, maintenance and supplies — approve and assign here."
              : `Requests for store ${homeStore || "—"}, with HQ's decision and who is coming.`}
          </p>
        </div>
        {canSubmit && (
          <Button onClick={() => setFormOpen(true)} className="bg-blue-600 hover:bg-blue-500">
            <Plus className="mr-2 h-4 w-4" /> New Request
          </Button>
        )}
      </div>

      <Select value={filterStatus} onValueChange={setFilterStatus}>
        <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {FACILITY_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <FacilityRequestQueue requests={visible} selectedId={current?.id} onSelect={setSelected} showStore={isHQ} />

        <div className="min-w-0 space-y-4">
          {current ? (
            <>
              <FacilityRequestDetail request={current} />
              {isHQ && current.status === "submitted" && (
                <FacilityDecisionPanel
                  request={current}
                  technicians={technicians}
                  saving={saving}
                  onApprove={(values) => decide(true, values)}
                  onDeny={(values) => decide(false, values)}
                />
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
              Select a request to see its details.
            </div>
          )}
        </div>
      </div>

      <FacilityRequestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        registers={registers}
        storeId={homeStore}
        onSubmit={submitRequest}
        saving={saving}
      />
    </div>
  );
}