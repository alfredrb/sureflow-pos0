// Printing from the Admin site (till slips, transaction reprints, cash slips).
//
// The admin panel has no POS session, so store identity and the assigned admin
// printer are resolved from Store Settings and cached for the page session.
// Everything then goes through the same 42-column 4690 pipeline the POS uses.
import { base44 } from "@/api/data";
import { printReceipt } from "@/lib/printReceipt";

let cached = null;

export function clearAdminPrintCache() {
  cached = null;
}

export async function getAdminPrintContext(force = false) {
  if (cached && !force) return cached;
  const settings = (await base44.entities.StoreSettings.list("-created_date", 5))[0] || null;
  let store = null;
  if (settings?.store_id) {
    store = (await base44.entities.Store.filter({ store_number: settings.store_id }))[0] || null;
  }
  if (!store) store = (await base44.entities.Store.filter({ status: "active" }))[0] || null;
  cached = {
    printerIp: settings?.admin_printer_ip || "",
    // The admin panel runs on the cloud origin, so print jobs must be addressed to the
    // store's Local Relay VM explicitly (Store > Relay URL in the Command Center).
    relayBase: store?.relay_url || "",
    storeConfig: settings,
    storeInfo: {
      store_number: store?.store_number || settings?.store_id || "",
      manager_name: store?.manager_name || "",
      default_tax_rate: settings?.default_tax_rate ?? 0,
      store_name: store?.name || settings?.store_name || "",
      store_address: store
        ? [store.address_street, store.address_city, store.address_state, store.address_zip].filter(Boolean).join(", ")
        : settings?.store_address || "",
      store_phone: store?.phone || settings?.store_phone || "",
    },
  };
  return cached;
}

// Prints on the admin-assigned printer, falling back to the browser print window.
export async function adminPrintReceipt(props) {
  const ctx = await getAdminPrintContext();
  return printReceipt({ ...ctx, ...props });
}

// Convenience wrapper for admin cash / till slips.
export function adminPrintCashSlip({ title, kind, amount, reason, registerId, registerName, operatorName, date, denominations }) {
  return adminPrintReceipt({
    docType: "cash",
    transactionId: "",
    openDrawer: false,
    operatorName,
    registerId: registerId || "ADMIN",
    registerName: registerName || registerId || "ADMIN",
    cashSlip: { title, kind, amount: Number(amount || 0), reason: reason || "", denominations: denominations || [] },
    date,
  });
}