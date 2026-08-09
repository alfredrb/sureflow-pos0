import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Network, Wifi, WifiOff, Monitor, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

export default function AdminNetwork() {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => { setRegisters(await base44.entities.Register.list()); setLoading(false); };
  useEffect(() => { load(); }, []);

  const toggleStatus = async (reg) => {
    const newStatus = reg.status === "online" ? "offline" : "online";
    await base44.entities.Register.update(reg.id, { status: newStatus });
    toast({ title: `${reg.name} set to ${newStatus}` }); load();
  };

  const updateRegisterIP = async (reg) => {
    try {
      // Fetch client IP from an external service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      const newIP = data.ip;
      
      await base44.entities.Register.update(reg.id, { ip_address: newIP });
      toast({ title: `${reg.name} IP updated to ${newIP}` });
      load();
    } catch (e) {
      toast({ title: "Error", description: "Failed to detect IP address", variant: "destructive" });
    }
  };

  const online = registers.filter(r => r.status === "online").length;
  const offline = registers.filter(r => r.status === "offline").length;
  const maint = registers.filter(r => r.status === "maintenance").length;

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Network Management</h1>
          <p className="text-gray-500 text-sm mt-1">Monitor and manage register connections</p>
        </div>
        <Button variant="outline" onClick={load} className="w-full sm:w-auto"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 text-center">
          <div className="w-9 sm:w-10 h-9 sm:h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-2"><Wifi className="w-4 sm:w-5 h-4 sm:h-5 text-emerald-600" /></div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{online}</p>
          <p className="text-gray-500 text-xs">Online</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 text-center">
          <div className="w-9 sm:w-10 h-9 sm:h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-2"><WifiOff className="w-4 sm:w-5 h-4 sm:h-5 text-gray-500" /></div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{offline}</p>
          <p className="text-gray-500 text-xs">Offline</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-5 text-center">
          <div className="w-9 sm:w-10 h-9 sm:h-10 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-2"><Wrench className="w-4 sm:w-5 h-4 sm:h-5 text-amber-600" /></div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{maint}</p>
          <p className="text-gray-500 text-xs">Maintenance</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
          Network Devices
        </div>
        <div className="divide-y divide-gray-50">
          {registers.map(r => (
            <div key={r.id} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${r.status === "online" ? "bg-emerald-500 animate-pulse" : r.status === "maintenance" ? "bg-amber-500" : "bg-gray-300"}`} />
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Monitor className="w-5 h-5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{r.name} <span className="text-gray-400 text-xs">({r.register_id})</span></p>
                  <p className="text-xs text-gray-400 truncate">{r.location || "No location"}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 pl-4 sm:pl-0">
                <div className="sm:text-right">
                  <p className="font-mono text-sm text-gray-700">{r.ip_address || "No IP"}</p>
                  <div className="text-xs text-gray-400 space-x-3">
                    <span>Mask: {r.subnet_mask || "—"}</span>
                    <span>GW: {r.gateway || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => updateRegisterIP(r)} title="Detect IP from this device">
                    <Wifi className="w-3.5 h-3.5 mr-1" /> Update IP
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(r)}
                    className={r.status === "online" ? "text-red-600 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"}>
                    {r.status === "online" ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}