// Store identity + receipt config resolved once by the POS register and cached in
// sessionStorage, so any panel (returns, exchange, cash slips) can print a receipt
// with the same store number, manager name, tax rate and header/footer lines.
const KEY = "pos_receipt_context";

export function savePosReceiptContext({ storeInfo, storeConfig }) {
  sessionStorage.setItem(KEY, JSON.stringify({ storeInfo: storeInfo || null, storeConfig: storeConfig || null }));
}

export function getPosReceiptContext() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

// Merges the cached store context with the per-transaction fields a panel supplies.
export function buildPanelReceiptProps({ operator, ...rest }) {
  const { storeInfo, storeConfig } = getPosReceiptContext();
  return {
    storeInfo,
    storeConfig,
    registerName: sessionStorage.getItem("pos_register_num") || "REG-001",
    registerId: sessionStorage.getItem("pos_register_num") || "REG-001",
    operatorName: operator?.full_name,
    operatorPin: operator?.pin,
    storeNumber: storeInfo?.store_number || sessionStorage.getItem("pos_store_id") || "",
    managerName: storeInfo?.manager_name,
    taxRate: storeInfo?.default_tax_rate,
    ...rest,
  };
}