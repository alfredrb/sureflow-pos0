// Pops the cash drawer on this register via the Local Relay VM.
// Silent by design: if the relay or drawer is unreachable the operator opens the
// drawer manually — a failed kick must never block a cash flow.
//
// Two transports. printer_dk (the fleet standard) sends ESC p to the receipt
// printer, whose controller fires the drawer's RJ11/SDL solenoid. usb_direct is
// the RESERVED path for a native USB drawer bridged at the lane: the model's own
// open command goes straight to the lane's drawer bridge socket.

import { base44 } from "@/api/base44Client";
import { openCashDrawer, openUsbDrawer } from "@/lib/relayClient";
import { DRAWER_BRIDGE_PORT, drawerOpenHex } from "@/lib/drawerProfiles";
import { announceDrawerOpen } from "@/lib/drawerActivity";

let cachedRegister;

async function resolveRegister() {
  if (cachedRegister !== undefined) return cachedRegister;
  try {
    const registerId = sessionStorage.getItem("pos_register_num") || "REG-001";
    const regs = await base44.entities.Register.filter({ register_id: registerId });
    cachedRegister = regs[0] || null;
  } catch {
    cachedRegister = null;
  }
  return cachedRegister;
}

// The drawer's open command lives in its HardwareLibrary profile, so a new USB
// drawer model is a profile entry rather than a code change.
async function resolveOpenHex(model) {
  if (!model) return drawerOpenHex(null);
  try {
    const profiles = await base44.entities.HardwareLibrary.filter({ model, device_type: "cash_drawer" });
    return drawerOpenHex(profiles[0]);
  } catch {
    return drawerOpenHex(null);
  }
}

// Every kick arms the lane's drawer-status watch. Broadcasting it means every path
// that pops the drawer (sale, no-sale, pickup, till checkout) is covered without
// each caller having to know the watch exists.
// The reason travels with the kick so the watch can tell a cash pickup from an
// unattributed release when it writes the Loss Prevention record.
function announceKick(reason) {
  announceDrawerOpen(reason);
}

export async function kickDrawer(reason = "manual") {
  try {
    const reg = await resolveRegister();

    if (reg?.drawer_transport === "usb_direct") {
      // Blank bridge IP = the lane's own address, matching the printer / pole /
      // pinpad bridges.
      await openUsbDrawer({
        drawer_ip: reg.drawer_bridge_ip || reg.ip_address || "",
        drawer_port: reg.drawer_bridge_port || DRAWER_BRIDGE_PORT,
        command_hex: await resolveOpenHex(reg.drawer_model),
        transport_hint: reg.drawer_transport_hint || "",
      });
      announceKick(reason);
      return true;
    }

    await openCashDrawer(reg?.printer_ip || "");
    announceKick(reason);
    return true;
  } catch (e) {
    console.warn("Cash drawer kick failed:", e.message);
    return false;
  }
}