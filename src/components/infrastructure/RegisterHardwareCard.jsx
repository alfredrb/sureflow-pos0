import React from "react";
import { Monitor, Printer, ScanLine, Wallet, Wifi, WifiOff, Wrench } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LaneRebootButton from "@/components/infrastructure/LaneRebootButton";

const STATUS_META = {
  online: { label: "Online", icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  offline: { label: "Offline", icon: WifiOff, color: "text-gray-500", bg: "bg-gray-100", dot: "bg-gray-400" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500" },
};

const HW_DOT = { connected: "bg-emerald-500", disconnected: "bg-red-500", unknown: "bg-gray-300" };

// Printer condition from the lane's DLE EOT health probes, worst state first —
// a printer can be low on paper AND erroring, but one badge is enough to act on.
function PrinterHealthRow({ health }) {
  if (!health) return null;
  const meta = health.paper_out
    ? { dot: "bg-red-500", label: "Paper out" }
    : health.online === false
      ? { dot: "bg-red-500", label: "Offline / cover" }
      : health.error
        ? { dot: "bg-amber-500", label: "Error" }
        : health.paper_low
          ? { dot: "bg-amber-500", label: "Paper low" }
          : { dot: "bg-emerald-500", label: "Healthy" };
  return (
    <div className="flex items-center gap-2">
      <Printer className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-[11px] text-gray-600 w-20 flex-shrink-0">Paper / health</span>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
      <span className="text-[11px] text-gray-700">
        {meta.label}
        <span className="text-emerald-500 font-medium"> · live</span>
      </span>
    </div>
  );
}

// Physical drawer state read off the printer's DK sense line and carried up on the
// lane's heartbeat. Green closed / amber open / grey unknown, matching the language
// already used by the connected-disconnected rows above it.
function DrawerStateRow({ open }) {
  const meta = open === true
    ? { dot: "bg-amber-500", label: "Open" }
    : open === false
      ? { dot: "bg-emerald-500", label: "Closed" }
      : { dot: "bg-gray-300", label: "Unknown" };
  return (
    <div className="flex items-center gap-2">
      <Wallet className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-[11px] text-gray-600 w-20 flex-shrink-0">Drawer state</span>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
      <span className="text-[11px] text-gray-700">
        {meta.label}
        {open !== null && open !== undefined && <span className="text-emerald-500 font-medium"> · live</span>}
      </span>
    </div>
  );
}

function HardwareRow({ icon: Icon, label, liveValue, manualValue, relayLive, onOverride }) {
  const value = relayLive && liveValue ? liveValue : manualValue || "unknown";
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-[11px] text-gray-600 w-20 flex-shrink-0">{label}</span>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${HW_DOT[value] || HW_DOT.unknown}`} />
      {relayLive && liveValue ? (
        <span className="text-[11px] text-gray-700 capitalize">{liveValue} <span className="text-emerald-500 font-medium">· live</span></span>
      ) : (
        <Select value={manualValue || "unknown"} onValueChange={onOverride}>
          <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="disconnected">Disconnected</SelectItem>
            <SelectItem value="unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// One register's hardware block. Live values come from the relay poll (matched by
// register_id); the manual dropdowns remain as fallback when the relay is offline.
export default function RegisterHardwareCard({ register, relayRegister, relayLive, onOverride, relayBase, store, direct = false, onQueueCommand }) {
  const sm = STATUS_META[register.status] || STATUS_META.offline;
  return (
    <div className="border border-gray-100 rounded-xl px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{register.name || register.register_id}</p>
            <p className="text-[10px] font-mono text-gray-400 truncate">
              {register.ip_address && `IP ${register.ip_address}`}{register.subnet_mask && ` · ${register.subnet_mask}`}{register.gateway && ` · GW ${register.gateway}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {register.paused && <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Paused</span>}
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />{sm.label}
          </span>
        </div>
      </div>
      {register.assigned_operator && <p className="text-[11px] text-gray-500">Operator: <span className="text-gray-700">{register.assigned_operator}</span></p>}
      <div className="space-y-1.5">
        <HardwareRow icon={Printer} label="Printer" liveValue={relayRegister?.printer_status} manualValue={register.printer_status} relayLive={relayLive} onOverride={(v) => onOverride(register, "printer_status", v)} />
        <HardwareRow icon={ScanLine} label="Scanner" liveValue={relayRegister?.scanner_status} manualValue={register.scanner_status} relayLive={relayLive} onOverride={(v) => onOverride(register, "scanner_status", v)} />
        <HardwareRow icon={Wallet} label="Drawer" liveValue={relayRegister?.cash_drawer_status} manualValue={register.cash_drawer_status} relayLive={relayLive} onOverride={(v) => onOverride(register, "cash_drawer_status", v)} />
        {relayLive && relayRegister && <DrawerStateRow open={relayRegister.drawer_open ?? null} />}
        {relayLive && relayRegister && <PrinterHealthRow health={relayRegister.printer_health} />}
      </div>
      <div className="flex justify-end pt-0.5 border-t border-gray-50">
        <LaneRebootButton
          register={register}
          relayBase={relayBase}
          store={store}
          direct={direct}
          onQueueCommand={onQueueCommand}
          disabled={!store}
        />
      </div>
    </div>
  );
}