// Resolves a lane's relay address from its STORE record instead of the boot URL.
//
// The boot URL handover (&relay=…) is fragile: the platform auth redirect can drop or
// re-encode the query string, which is how a lane ends up with a captured register but
// no relay address — and then prints to the cloud origin and falls back to the
// browser's print dialog. The register already tells us its store, and the Store
// record already carries relay_url for the Infrastructure Command Center, so use that
// as the authoritative source and treat the boot URL as a convenience only.
import { base44 } from "@/api/data";

export async function resolveRelayFromStore(storeId) {
  if (!storeId || typeof window === "undefined") return null;
  const stores = await base44.entities.Store.filter({ store_number: storeId });
  const url = (stores[0]?.relay_url || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) return null;
  window.localStorage.setItem("relay_base_url", url);
  return url;
}