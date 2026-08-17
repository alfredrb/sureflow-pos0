import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/data";
import { UserPlus, ArrowLeft, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

const emptyEmp = { employee_id: "", full_name: "", email: "", phone: "", address_street: "", address_city: "", address_state: "", address_zip: "", hire_date: "", position: "", department: "", status: "active", emergency_contact_name: "", emergency_contact_phone: "", notes: "" };
const emptyOp = { operator_id: "", pin: "", role: "cashier", pos_access: true, company_id: "" };

export default function AdminEmployeeCreation() {
  const [emp, setEmp] = useState(emptyEmp);
  const [op, setOp] = useState(emptyOp);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const setEmpF = (k, v) => setEmp(p => ({ ...p, [k]: v }));
  const onRoleChange = (v) => {
    setOp(p => ({ ...p, role: v, pos_access: (v === "loss_prevention" || v === "vendor") ? false : true }));
  };

  const submit = async () => {
    if (!emp.employee_id.trim() || !emp.full_name.trim()) { toast({ title: "Employee ID and Full Name are required", variant: "destructive" }); return; }
    if (!op.pin.trim()) { toast({ title: "Operator PIN is required", variant: "destructive" }); return; }
    if (op.role === "vendor" && !op.company_id.trim()) { toast({ title: "Company ID required for vendor role", variant: "destructive" }); return; }

    const operatorId = op.operator_id.trim() || emp.employee_id.trim();
    setSaving(true);
    try {
      const existing = await base44.entities.Operator.filter({ operator_id: operatorId });
      if (existing.length > 0) {
        toast({ title: "Operator ID already exists", description: `Operator "${operatorId}" already exists — choose another.`, variant: "destructive" });
        setSaving(false);
        return;
      }
      await base44.entities.Operator.create({
        operator_id: operatorId,
        full_name: emp.full_name,
        pin: op.pin,
        role: op.role,
        status: emp.status,
        email: emp.email,
        pos_access: op.pos_access,
        ...(op.role === "vendor" ? { company_id: op.company_id } : {})
      });
      await base44.entities.Employee.create({
        ...emp,
        hire_date: emp.hire_date || null,
        operator_id: operatorId
      });
      toast({ title: "Employee & Operator created", description: `${emp.full_name} — Operator ${operatorId} (${op.role})` });
      setEmp(emptyEmp); setOp(emptyOp);
      navigate("/admin/operators");
    } catch (e) {
      toast({ title: "Error creating employee", description: e?.message || "Failed to create", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-3xl mx-auto">
      <button onClick={() => navigate("/admin/operators")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Operators
      </button>

      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center"><UserPlus className="w-5 h-5 text-white" /></div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">New Employee</h1>
      </div>
      <p className="text-gray-500 text-sm mb-6">Enter the employee's info and POS operator details. An operator login is created automatically and linked to this employee.</p>

      {/* Employee Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Employee Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Employee ID *</label>
            <Input value={emp.employee_id} onChange={e => setEmpF("employee_id", e.target.value)} placeholder="e.g. EMP-001" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
            <Input value={emp.full_name} onChange={e => setEmpF("full_name", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
            <Input type="email" value={emp.email} onChange={e => setEmpF("email", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
            <Input value={emp.phone} onChange={e => setEmpF("phone", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Address</label>
            <Input value={emp.address_street} onChange={e => setEmpF("address_street", e.target.value)} placeholder="Street" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
            <Input value={emp.address_city} onChange={e => setEmpF("address_city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">State</label>
              <Input value={emp.address_state} onChange={e => setEmpF("address_state", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">ZIP</label>
              <Input value={emp.address_zip} onChange={e => setEmpF("address_zip", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Hire Date</label>
            <Input type="date" value={emp.hire_date} onChange={e => setEmpF("hire_date", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Position / Title</label>
            <Input value={emp.position} onChange={e => setEmpF("position", e.target.value)} placeholder="e.g. Front End Cashier" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Department</label>
            <Input value={emp.department} onChange={e => setEmpF("department", e.target.value)} placeholder="e.g. Front End" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
            <Select value={emp.status} onValueChange={v => setEmpF("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Contact</label>
            <Input value={emp.emergency_contact_name} onChange={e => setEmpF("emergency_contact_name", e.target.value)} placeholder="Name" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Emergency Phone</label>
            <Input value={emp.emergency_contact_phone} onChange={e => setEmpF("emergency_contact_phone", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
            <Input value={emp.notes} onChange={e => setEmpF("notes", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Operator Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2"><IdCard className="w-4 h-4 text-blue-600" /> Operator Info</h2>
        <p className="text-xs text-gray-500 mb-4">This creates the POS login for this employee. Operator ID defaults to the Employee ID if left blank.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Operator ID</label>
            <Input value={op.operator_id} onChange={e => setOp(p => ({ ...p, operator_id: e.target.value }))} placeholder={emp.employee_id || "auto from Employee ID"} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">PIN *</label>
            <Input type="password" value={op.pin} onChange={e => setOp(p => ({ ...p, pin: e.target.value }))} placeholder="e.g. 1234" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Role</label>
            <Select value={op.role} onValueChange={onRoleChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier">Cashier</SelectItem>
                <SelectItem value="csm">CSM</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="loss_prevention">Loss Prevention</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3 w-full">
              <div>
                <p className="text-sm font-medium text-gray-700">POS Access</p>
                <p className="text-xs text-gray-400">Allow login to the POS terminal.</p>
              </div>
              <Switch checked={op.pos_access} onCheckedChange={v => setOp(p => ({ ...p, pos_access: v }))} />
            </div>
          </div>
          {op.role === "vendor" && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-1 block">Company ID *</label>
              <Input value={op.company_id} onChange={e => setOp(p => ({ ...p, company_id: e.target.value }))} placeholder="e.g. VEND-001" />
              <p className="text-xs text-gray-400 mt-1">Ties this vendor to inventory tagged with this Company ID.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate("/admin/operators")} className="flex-1">Cancel</Button>
        <Button onClick={submit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700">
          {saving ? "Creating…" : "Create Employee & Operator"}
        </Button>
      </div>
    </div>
  );
}