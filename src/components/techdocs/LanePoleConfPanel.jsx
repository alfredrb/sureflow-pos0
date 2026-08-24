import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/data";
import CodeBlock from "@/components/techdocs/CodeBlock";
import { poleConfForRegister } from "@/lib/bootStatusCodes";
import { getAdminAccess } from "@/lib/adminAccess";
import { scopeRegisters } from "@/lib/cashScope";

// Per-lane provisioning: the controller writes one pole.conf per MAC, and it must
// point at the SAME address the relay drives the pole on at runtime — otherwise the
// boot codes go somewhere the pole isn't. Generated straight off the register profile
// so the two can never drift.
export default function LanePoleConfPanel() {
  const [registers, setRegisters] = useState([]);
  const [selected, setSelected] = useState("");

  const access = useMemo(
    () => getAdminAccess(JSON.parse(sessionStorage.getItem("admin_operator") || "null")),
    []
  );

  useEffect(() => {
    base44.entities.Register.list().then((r) => setRegisters(scopeRegisters(access, r)));
  }, [access]);

  const register = registers.find((r) => r.id === selected) || registers[0] || null;
  const missingPole = register && !register.pole_display_model;
  const missingHost = register && !register.pole_display_ip && !register.printer_ip;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="text-sm font-semibold text-gray-900">Lane provisioning file</p>
      <p className="mt-1 text-xs text-gray-500">
        Pick a lane to generate its <span className="font-mono">/etc/sureflow/pole.conf</span>. Pass-through and chain
        poles use the printer IP on port 9100; a USB pole uses the lane's own IP on 9101.
      </p>

      <select
        value={register?.id || ""}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-3 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80"
      >
        {registers.length === 0 && <option value="">No registers in your scope</option>}
        {registers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.register_id} — {r.name}
          </option>
        ))}
      </select>

      {missingPole && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
          This lane has no pole display assigned, so it will boot silently — the codes still land in
          <span className="font-mono"> /run/sureflow-bootstatus.log</span>.
        </p>
      )}
      {missingHost && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          No pole IP and no printer IP on this lane — the writer exits immediately. Set the printer IP on the register
          first.
        </p>
      )}

      {register && (
        <div className="mt-3">
          <CodeBlock
            title={`pole.conf — ${register.register_id}`}
            filename="/etc/sureflow/pole.conf"
            note="Install it into the lane's per-MAC provisioning directory on the controller, then rebuild the initramfs so the pre-root codes can read it."
            code={poleConfForRegister(register)}
          />
        </div>
      )}
    </div>
  );
}