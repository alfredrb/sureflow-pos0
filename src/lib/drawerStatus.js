// Reads whether this lane's cash drawer is physically open.
//
// The drawer's open/closed reed switch is wired to the printer's DK port sense pin
// (pin 3 on the IBM/Toshiba SDL pinout), so the receipt printer already knows the
// answer — the relay just asks it with the ESC/POS real-time status command and
// hands back { open: true|false }.
//
// A printer that does not answer reports "unknown", NEVER "open": an unreachable
// printer must never be able to block a lane from selling.

import { base44 } from "@/api/base44Client";
import { fetchDrawerStatus } from "@/lib/relayClient";

let cachedPrinterIp;

// Same resolution the receipt path uses — the lane's own printer, not just the
// first entry in the relay's PRINTER_IPS list (a USB-bridged lane publishes its
// printer on its own address).
async function resolvePrinterIp() {
  if (cachedPrinterIp !== undefined) return cachedPrinterIp;
  try {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    cachedPrinterIp = regs[0]?.printer_ip || "";
  } catch {
    cachedPrinterIp = "";
  }
  return cachedPrinterIp;
}

// "open" | "closed" | "unknown"
export async function readDrawerState() {
  try {
    const out = await fetchDrawerStatus(await resolvePrinterIp());
    if (typeof out?.open !== "boolean") return "unknown";
    return out.open ? "open" : "closed";
  } catch {
    return "unknown";
  }
}