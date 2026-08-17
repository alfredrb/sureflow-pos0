import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { UserCog, Search, UserPlus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { STATUSES, daysUntil } from "@/lib/employeeActions";
import EmployeeProfile from "@/components/employeemanager/EmployeeProfile";
import UnprofiledOperators from "@/components/employeemanager/UnprofiledOperators";

export default function AdminEmployeeManager() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showUnprofiled, setShowUnprofiled] = useState(false);
  const [unprofiledCount, setUnprofiledCount] = useState(0);
  const { toast } = useToast();

  const load = async () => {
    try {
      const data = await base44.entities.Employee.list();
      setEmployees(data);
      // compute unprofiled operators count
      try {
        const ops = await base44.entities.Operator.list();
        const empOpIds = new Set((data || []).map(e => e.operator_id).filter(Boolean));
        setUnprofiledCount((ops || []).filter(o => o.role !== "vendor" && o.full_name && !empOpIds.has(o.operator_id)).length);
      } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useRealtimeSync("Employee", load, { intervalMs: 20000 });

  const selected = employees.find(e => e.id === selectedId);
  if (selectedId && selected) {
    return <EmployeeProfile employee={selected} onBack={() => setSelectedId(null)} onReload={load} />;
  }

  const counts = {
    active: employees.filter(e => e.status === "active").length,
    on_leave: employees.filter(e => e.status === "on_leave").length,
    terminated: employees.filter(e => e.status === "terminated").length,
  };

  const filtered = employees
    .filter(e => !search || e.full_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_id?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2"><UserCog className="w-6 h-6 text-blue-600" /> Employee Manager</h1>
          <p className="text-gray-500 text-sm mt-1">{employees.length} employees · {counts.active} active · {counts.on_leave} on leave · {counts.terminated} terminated</p>
        </div>
        {unprofiledCount > 0 && (
          <Button variant="outline" onClick={() => setShowUnprofiled(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Create Profiles ({unprofiledCount})
          </Button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.4fr_1fr_1fr_1.2fr_1.2fr] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Employee</span><span>Position</span><span>Status</span><span>Operator</span><span>HR Details</span>
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map(e => {
            const st = STATUSES[e.status] || STATUSES.inactive;
            const leaveDays = e.status === "on_leave" ? daysUntil(e.leave_end) : null;
            const rehireDays = e.status === "terminated" ? daysUntil(e.rehire_eligible_date) : null;
            return (
              <button key={e.id} onClick={() => setSelectedId(e.id)} className="lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1.2fr_1.2fr] lg:gap-4 lg:px-5 lg:py-3.5 lg:items-center w-full text-left flex flex-col gap-2 p-4 sm:p-5 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.full_name}</p>
                  <p className="text-xs text-gray-400">ID: {e.employee_id}</p>
                </div>
                <p className="text-sm text-gray-600">{e.position || "—"}<br /><span className="text-xs text-gray-400">{e.department || ""}</span></p>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                  {e.blacklisted && <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-900 text-white flex items-center gap-1"><Ban className="w-3 h-3" /> Blacklisted</span>}
                </div>
                <div className="text-sm text-gray-600">
                  {e.operator_id ? <>Op ID: <span className="font-mono">{e.operator_id}</span></> : <span className="text-gray-400">No operator</span>}
                </div>
                <div className="text-xs text-gray-500">
                  {e.status === "on_leave" && <>Until {e.leave_end}{leaveDays != null ? ` (${leaveDays}d left)` : ""}</>}
                  {e.status === "terminated" && (e.blacklisted ? "Blacklisted — no rehire" : <>Rehire until {e.rehire_eligible_date}{rehireDays != null ? (rehireDays >= 0 ? ` (${rehireDays}d left)` : " (expired)") : ""}</>)}
                  {e.status === "active" && <span className="text-gray-400">View profile →</span>}
                  {e.status === "inactive" && <span className="text-gray-400">—</span>}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">No employees found.</div>}
        </div>
      </div>

      <UnprofiledOperators open={showUnprofiled} onClose={() => setShowUnprofiled(false)} onCreated={load} />
    </div>
  );
}