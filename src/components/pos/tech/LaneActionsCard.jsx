import React, { useState } from "react";
import { FileText, ClipboardCopy, Power, Wrench } from "lucide-react";
import TechDiagCard from "@/components/pos/tech/TechDiagCard";
import TechDiagTile from "@/components/pos/tech/TechDiagTile";
import { printNoticeSlip } from "@/lib/noticeSlip";
import { rebootThisLane } from "@/lib/relayClient";

// What the technician does with the findings: leave a printed record at the lane, or
// carry the details off it. A lane sits on the isolated PXE VLAN, so its own agent on
// loopback is the only way the POS can restart it.
export default function LaneActionsCard({ register, operator, writeLog, toast }) {
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState({});
  const [armed, setArmed] = useState(false);

  const reportLines = () => [
    `REGISTER   ${register?.register_id || "—"}`,
    `STORE      ${register?.store_id || "—"}`,
    `LANE IP    ${register?.ip_address || "—"}`,
    `TERMINAL   ${register?.terminal_model || "—"}`,
    `BOOT       ${register?.boot_profile || "—"}`,
    `PRINTER    ${register?.printer_model || "—"} @ ${register?.printer_ip || "—"} (${register?.printer_transport || "—"})`,
    `SCANNER    ${register?.scanner_model || "—"} (${register?.scanner_interface || "—"})`,
    `DRAWER     ${register?.cash_drawer_model || "—"} (${register?.drawer_transport || "—"})`,
    `PINPAD     ${register?.pinpad_model || "none"} @ ${register?.pinpad_ip || "—"}`,
    `POLE       ${register?.pole_display_model || "none"}`,
    `PANEL      ${window.screen?.width}x${window.screen?.height} @ ${(window.devicePixelRatio || 1).toFixed(2)}x`,
    `TOUCH      ${navigator.maxTouchPoints || 0} points`,
    `NETWORK    ${navigator.onLine ? "link up" : "LINK DOWN"}`,
    `TECHNICIAN ${(operator?.full_name || "—").toUpperCase()}`,
    `CAPTURED   ${new Date().toLocaleString()}`,
  ];

  const run = async (key, fn) => {
    setBusy(key);
    setRes((p) => ({ ...p, [key]: { status: null, detail: "" } }));
    try {
      const detail = await fn();
      setRes((p) => ({ ...p, [key]: { status: "pass", detail } }));
    } catch (e) {
      setRes((p) => ({ ...p, [key]: { status: "fail", detail: e.message || "failed" } }));
    }
    setBusy(null);
  };
  const at = (k) => res[k] || {};

  const printReport = () => run("slip", async () => {
    await printNoticeSlip({
      heading: "LANE DIAGNOSTIC REPORT",
      lines: reportLines(),
      footer: "***NOT A RECEIPT***",
      barcode: register?.register_id || "",
    }, operator);
    writeLog?.("no_sale", `Lane diagnostic report printed by technician ${operator?.full_name || ""}`);
    return "Report printed at this lane";
  });

  const copyReport = () => run("copy", async () => {
    await navigator.clipboard.writeText(reportLines().join("\n"));
    return "Report copied to the clipboard";
  });

  const reboot = () => run("reboot", async () => {
    await rebootThisLane(register?.register_id);
    writeLog?.("register_change", `Lane reboot requested from diagnostics by ${operator?.full_name || ""}`);
    toast?.({ title: "Reboot Requested", description: "The lane agent is restarting this terminal" });
    setArmed(false);
    return "Lane agent accepted the reboot";
  });

  return (
    <TechDiagCard icon={Wrench} title="Technician Actions">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <TechDiagTile icon={FileText} label="Print Report" onClick={printReport} busy={busy === "slip"} {...at("slip")} />
        <TechDiagTile icon={ClipboardCopy} label="Copy Report" onClick={copyReport} busy={busy === "copy"} {...at("copy")} />
        <TechDiagTile
          icon={Power}
          label={armed ? "Confirm Reboot" : "Reboot Lane"}
          onClick={() => (armed ? reboot() : setArmed(true))}
          busy={busy === "reboot"}
          {...at("reboot")}
        />
      </div>
      {armed && (
        <p className="mt-2 text-amber-400 text-[10px] leading-snug">
          Press Confirm Reboot to restart this terminal now. Any sale in progress is lost.
        </p>
      )}
    </TechDiagCard>
  );
}