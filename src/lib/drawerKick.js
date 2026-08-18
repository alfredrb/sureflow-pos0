// Pops the cash drawer on this register's receipt printer via the Local Relay VM.
// Silent by design: if the relay or printer is unreachable the operator opens the
// drawer manually — a failed kick must never block a cash flow.

import { base44 } from "@/api/base44Client";
import { openCashDrawer } from "@/lib/relayClient";

let cachedIp;

async function resolvePrinterIp() {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    cachedIp = regs[0]?.printer_ip || "";
  } catch {
    cachedIp = "";
  }
  return cachedIp;
}

export async function kickDrawer() {
  try {
    await openCashDrawer(await resolvePrinterIp());
    return true;
  } catch (e) {
    console.warn("Cash drawer kick failed:", e.message);
    return false;
  }
}