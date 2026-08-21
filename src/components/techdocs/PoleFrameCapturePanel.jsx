import React, { useState } from "react";
import { Radio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { POLE_CAPTURE_CODE, POLE_CAPTURE_ROUTES_CODE, POLE_CAPTURE_STEPS } from "@/lib/poleFrameCapture";
import { logAuditEvent } from "@/lib/auditLogger";

// Frame-capture helper for the reserved IBM/Toshiba pole profiles. Recording runs
// on the relay; this panel documents the procedure and records each capture run in
// the audit trail so the profile's provenance is traceable.
export default function PoleFrameCapturePanel() {
  const [profileKey, setProfileKey] = useState("");
  const [address, setAddress] = useState("");
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);

  const logRun = async () => {
    setLogging(true);
    await logAuditEvent({
      action: "Pole Frame Capture Run",
      category: "configuration",
      description: `Recorded IBM/ADX pole display frames for profile "${profileKey || "unspecified"}" from ${address || "an unspecified device address"}.`,
      page: "/admin/technical-docs",
      changes: [
        { field: "pole_profile_key", from: "reserved", to: profileKey || "" },
        { field: "capture_address", from: "", to: address || "" },
      ],
    });
    setLogging(false);
    setLogged(true);
    setTimeout(() => setLogged(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Radio className="h-5 w-5 text-rose-600" /> Pole Frame Capture
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          The IBM and Toshiba poles are reserved for one reason — nobody has their IBM/ADX byte frames. This helper
          records them from a live unit: the pole is driven by a known-good controller while the relay listens on the
          same line and splits the stream into frames on a 600ms quiet period, the same settle logic the cheque reader
          uses.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Procedure</p>
        <div className="mt-3 space-y-2">
          {POLE_CAPTURE_STEPS.map((s) => (
            <div key={s.step} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-800">{s.step}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <CodeBlock
        title="Relay capture module"
        filename="polecapture.js"
        note="Drop next to poledisplay.js. Emits a ready-to-paste frame() body plus every recorded frame as hex and printable text."
        code={POLE_CAPTURE_CODE}
      />
      <CodeBlock
        title="Capture routes"
        filename="server.js (excerpt)"
        note="Technician use only — mount alongside the pole routes."
        code={POLE_CAPTURE_ROUTES_CODE}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <p className="text-sm font-semibold text-gray-900">Record this capture run</p>
        <p className="mt-1 text-xs text-gray-500">
          Logs the run to the audit trail so a pole profile's frames can always be traced back to the unit and address
          they came from.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Profile key</label>
            <Input value={profileKey} onChange={(e) => setProfileKey(e.target.value)}
              placeholder="ibm_4610_2x20" className="font-mono text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Captured from</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="10.0.40.21:9101 (lane bridge) or printer:9100" className="font-mono text-sm" />
          </div>
        </div>
        <Button onClick={logRun} disabled={logging} className="mt-3">
          {logging && <Loader2 className="h-4 w-4 animate-spin" />}
          {logged ? "Logged to audit trail" : "Log capture run"}
        </Button>
      </div>
    </div>
  );
}