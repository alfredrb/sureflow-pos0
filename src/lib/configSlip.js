// Technician configuration slip (action code 402).
// Prints this lane's full configuration — features, hardware profile, boot profile,
// network and relay — so a technician has the register's setup on paper.
import { base44 } from "@/api/data";
import { printNoticeSlip, wrapNotice } from "@/lib/noticeSlip";
import { bootImageLabel } from "@/lib/pxeBootstrap";
import { laneNumber } from "@/lib/registerLabel";

const val = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));
const row = (label, v) => `${label.padEnd(13)}${val(v)}`;
const onOff = (b) => (b ? "ENABLED" : "disabled");

export async function printConfigSlip(operator) {
  const registerId = sessionStorage.getItem("pos_register_num") || "";
  const storeId = sessionStorage.getItem("pos_store_id") || "";
  const regs = registerId ? await base44.entities.Register.filter({ register_id: registerId }) : [];
  const reg = regs[0] || {};
  const stores = storeId ? await base44.entities.Store.filter({ store_number: storeId }) : [];
  const store = stores[0] || {};

  await printNoticeSlip({
    heading: "POS CONFIGURATION",
    lines: [
      "TECHNICIAN REFERENCE SLIP",
      "",
      "-- IDENTITY --",
      row("STORE", `${val(store.store_number || storeId)} ${store.name || ""}`.trim()),
      row("REGISTER", `${val(laneNumber(reg.register_id || registerId))} — ${val(reg.name)}`),
      row("LOCATION", reg.location),
      row("STATUS", reg.status),
      row("OPERATOR", (operator?.full_name || "").toUpperCase()),
      "",
      "-- FEATURES --",
      row("RETURNS", onOff(reg.feature_returns)),
      row("EXCHANGE", onOff(reg.feature_exchange)),
      row("CS MODE", onOff(reg.feature_customer_service)),
      row("PAUSED", onOff(reg.paused)),
      row("CASH LIMIT", reg.cash_limit != null ? `$${Number(reg.cash_limit).toFixed(2)}` : ""),
      "",
      "-- TERMINAL --",
      row("MODEL", reg.terminal_model),
      row("SERIAL", reg.terminal_serial),
      row("BOOT", bootImageLabel(reg)),
      row("MAC", reg.mac_address),
      "",
      "-- PERIPHERALS --",
      row("KEYBOARD", reg.keyboard_model),
      row("SCANNER", `${val(reg.scanner_model)} (${val(reg.scanner_interface)}) ${val(reg.scanner_status)}`),
      row("PRINTER", `${val(reg.printer_model)} ${val(reg.printer_status)}`),
      row("PRINTER IP", reg.printer_ip),
      row("DRAWER", `${val(reg.cash_drawer_model)} ${val(reg.cash_drawer_status)}`),
      "",
      "-- NETWORK --",
      row("IP", reg.ip_address),
      row("SUBNET", reg.subnet_mask),
      row("GATEWAY", reg.gateway),
      row("PXE VLAN", reg.pxe_vlan),
      row("BACKEND VL", reg.backend_vlan),
      ...wrapNotice(`RELAY ${val(store.relay_url)}`),
      "",
      `PRINTED ${new Date().toLocaleString()}`,
    ],
    footer: "***TECHNICIAN USE — NOT A RECEIPT***",
  }, operator);
}