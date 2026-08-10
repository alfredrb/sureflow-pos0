import React, { useState, useEffect } from "react";
import { base44 } from "@/api/data";
import { adminPages, adminNavGroups } from "@/lib/adminNav";
import { Lock, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

export default function AdminPermissions() {
  const admin = JSON.parse(sessionStorage.getItem("admin_operator") || "{}");
  const [record, setRecord] = useState(null);
  const [allowed, setAllowed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const recs = await base44.entities.AdminPermission.filter({ role: "csm" });
        setRecord(recs[0] || null);
        setAllowed(recs[0]?.allowed_pages || []);
      } catch (e) {
        toast({ title: "Error", description: "Failed to load permissions", variant: "destructive" });
      }
      setLoading(false);
    })();
  }, []);

  if (admin.role !== "manager") {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <Lock className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-gray-700 font-semibold">Manager Access Required</p>
        <p className="text-gray-400 text-sm mt-1">Only managers can configure admin page permissions.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full p-10">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );

  const toggle = (path) => setAllowed(a => a.includes(path) ? a.filter(p => p !== path) : [...a, path]);
  const allSelected = allowed.length === adminPages.length;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (record?.id) {
        await base44.entities.AdminPermission.update(record.id, { allowed_pages: allowed, updated_by: admin.full_name });
      } else {
        const created = await base44.entities.AdminPermission.create({ role: "csm", allowed_pages: allowed, updated_by: admin.full_name });
        setRecord(created);
      }
      toast({ title: "Permissions Saved", description: "CSM page access updated." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to save permissions", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2"><Lock className="w-7 h-7 text-blue-600" /> Admin Page Permissions</h1>
          <p className="text-gray-500 text-sm mt-1">Choose which admin pages CSMs can access. Managers always have full access.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAllowed(allSelected ? [] : adminPages.map(p => p.path))}>{allSelected ? "Clear All" : "Select All"}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500"><Save className="w-4 h-4 mr-2" />{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-900 text-sm">Manager Role — Full Access</p>
          <p className="text-emerald-700 text-xs mt-0.5">Managers can access every admin page, including Reset Data. This cannot be restricted.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">CSM Access</h2>
          <span className="text-xs text-gray-400">{allowed.length} of {adminPages.length} pages selected</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">Dashboard is always available. Unchecked pages are hidden from the CSM navigation and blocked on direct access.</p>
        <div className="space-y-5">
          {adminNavGroups.map(g => (
            <div key={g.label}>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">{g.label}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.items.map(item => (
                  <label key={item.path} className="flex items-center gap-2.5 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <Checkbox checked={allowed.includes(item.path)} onCheckedChange={() => toggle(item.path)} />
                    <span className="text-sm text-gray-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}