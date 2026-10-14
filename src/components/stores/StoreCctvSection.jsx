import React, { useEffect, useState } from "react";
import { base44 } from "@/api/data";
import { Input } from "@/components/ui/input";

// Blue Iris settings for a store: the server's web address, how far before an event
// footage starts, and which camera Short Names cover each register.
export default function StoreCctvSection({ form, set }) {
  const [registers, setRegisters] = useState([]);

  useEffect(() => {
    if (!form.store_number) return;
    base44.entities.Register.filter({ store_id: form.store_number }).then(setRegisters);
  }, [form.store_number]);

  const map = form.cctv_camera_map || [];
  const camerasFor = (rid) => map.find(r => r.register_id === rid)?.cameras || "";
  const setCameras = (rid, cameras) =>
    set("cctv_camera_map", [...map.filter(r => r.register_id !== rid), { register_id: rid, cameras }]);

  return (
    <div className="border-t pt-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">CCTV (Blue Iris)</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">Blue Iris Server URL</label>
          <Input value={form.blueiris_url || ""} onChange={(e) => set("blueiris_url", e.target.value)} placeholder="http://192.168.40.20:81" className="font-mono" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Pre-roll (sec)</label>
          <Input type="number" min={0} value={form.cctv_preroll_seconds ?? 30} onChange={(e) => set("cctv_preroll_seconds", Number(e.target.value))} />
        </div>
      </div>
      <p className="text-xs text-gray-400">Footage opens in Blue Iris on the store network. Keep the Blue Iris PC and lanes on the same time source so timestamps line up.</p>
      {registers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Cameras per register <span className="font-normal text-gray-400">(Short Names, comma-separated)</span></label>
          {registers.map(r => (
            <div key={r.id} className="flex items-center gap-2">
              <span className="w-28 text-xs font-mono text-gray-600 truncate">{r.register_id}</span>
              <Input value={camerasFor(r.register_id)} onChange={(e) => setCameras(r.register_id, e.target.value)} placeholder="lane1ovh, lane1cust" className="font-mono" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}