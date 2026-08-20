// Shared printer for non-sale operator notice slips (42-column 4690 format).
// Used by maintenance notices and lunch/shift notices.
import { base44 } from "@/api/data";
import { printReceipt } from "@/lib/printReceipt";

const WIDTH = 42;

// Wraps text to the 42-column receipt width, preserving blank lines.
export function wrapNotice(text, width = WIDTH) {
  const out = [];
  for (const para of String(text || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if ((line + " " + word).trim().length > width) {
        if (line) out.push(line);
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * Prints one notice slip to this register's printer (browser fallback if the
 * relay is unreachable). notice = { heading, lines[], footer, barcode }.
 * When notice.barcode is set it prints as a scannable CODE128 symbol.
 */
export async function printNoticeSlip(notice, operator) {
  const registerNum = sessionStorage.getItem("pos_register_num") || "";
  const regs = registerNum ? await base44.entities.Register.filter({ register_id: registerNum }) : [];
  const settings = (await base44.entities.StoreSettings.list())[0] || {};
  // Slips honour the Receipt Customizer's barcode/QR choice too.
  const receiptConfig = (await base44.entities.ReceiptConfig.list())[0] || null;
  await printReceipt({
    storeConfig: receiptConfig,
    docType: "notice",
    notice,
    transactionId: notice?.barcode || "",
    printerIp: regs[0]?.printer_ip,
    registerName: registerNum,
    registerId: registerNum,
    operatorName: operator?.full_name || "",
    operatorPin: operator?.operator_id || "",
    // Notice slips share the sale receipt header, so the store number has to come
    // from the register (or the store's settings) the same way sales do.
    storeNumber:
      sessionStorage.getItem("pos_store_id") || regs[0]?.store_id || settings.store_id || "",
    storeInfo: settings,
    openDrawer: false,
  });
}