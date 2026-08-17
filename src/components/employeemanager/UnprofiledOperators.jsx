import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function UnprofiledOperators({ open, onClose, onCreated }) {
  const [operators, setOperators] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [ops, emps] = await Promise.all([
        base44.entities.Operator.list(),
        base44.entities.Employee.list(),
      ]);
      const empOpIds = new Set((emps || []).map(e => e.operator_id).filter(Boolean));
      const unprofiled = (ops || []).filter(o => o.role !== "vendor" && o.full_name && !empOpIds.has(o.operator_id));
      setOperators(unprofiled);
      setEmployees(emps || []);
    } catch (e) { toast({ title: "Failed to load", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const genId = () => {
    const existing = new Set(employees.map(e => e.employee_id));
    let n = employees.length + 1;
    let id = `EMP-${String(n).padStart(3, "0")}`;
    while (existing.has(id)) { n++; id = `EMP-${String(n).padStart(3, "0")}`; }
    return id;
  };

  const createProfile = async (op) => {
    setCreating(op.id);
    try {
      await base44.entities.Employee.create({
        employee_id: genId(),
        full_name: op.full_name,
        email: op.email || null,
        operator_id: op.operator_id,
        status: "active",
        position: op.role || null,
      });
      toast({ title: `Profile created for ${op.full_name}` });
      await load();
      onCreated();
    } catch (e) { toast({ title: "Error", description: e?.message, variant: "destructive" }); }
    setCreating(null);
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create Profiles for Existing Operators</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 -mt-2">These operators were created before the Employee Manager existed. Create a basic employee profile to manage them here.</p>
        {loading ? <p className="text-sm text-gray-400 py-6 text-center">Loading…</p> :
          operators.length === 0 ? <p className="text-sm text-emerald-600 py-6 text-center">All operators already have employee profiles.</p> : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {operators.map(op => (
                <div key={op.id} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{op.full_name}</p>
                    <p className="text-xs text-gray-400">Op ID: <span className="font-mono">{op.operator_id}</span> · {op.role}</p>
                  </div>
                  <Button size="sm" onClick={() => createProfile(op)} disabled={creating === op.id}>
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> {creating === op.id ? "Creating…" : "Create Profile"}
                  </Button>
                </div>
              ))}
            </div>
          )
        }
      </DialogContent>
    </Dialog>
  );
}