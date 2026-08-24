import { base44 } from "@/api/data";
import { Wrench, HardDrive, Building2, Package } from "lucide-react";

export const FACILITY_CATEGORIES = [
  { value: "technician_visit", label: "Technician Visit", icon: Wrench, blurb: "Send a person to the store." },
  { value: "hardware_replacement_repair", label: "Hardware Repair / Replacement", icon: HardDrive, blurb: "A POS device needs fixing or swapping." },
  { value: "general_maintenance", label: "General Maintenance", icon: Building2, blurb: "Building work — plumbing, HVAC, fixtures." },
  { value: "supplies", label: "Supplies", icon: Package, blurb: "Consumables — rolls, bags, cleaning." },
];

export const FACILITY_STATUSES = ["submitted", "approved", "scheduled", "denied", "completed"];

export const STATUS_STYLES = {
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  denied: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export const URGENCY_STYLES = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-gray-100 text-gray-600",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export function categoryMeta(value) {
  return FACILITY_CATEGORIES.find((c) => c.value === value) || FACILITY_CATEGORIES[0];
}

// Which extra fields a category actually asks for, so a supply request is not made to
// answer questions about a register and a plumbing job is not asked for a SKU.
export function categoryFields(category) {
  switch (category) {
    case "technician_visit":
      return { register: true, sku: false, quantity: false };
    case "hardware_replacement_repair":
      return { register: true, sku: true, quantity: false };
    case "supplies":
      return { register: false, sku: true, quantity: true };
    default:
      return { register: false, sku: false, quantity: false };
  }
}

// Approved requests cross-post into the store's Maintenance Log so its existing
// timeline stays complete. Supply requests are not maintenance work, so they are
// left out of the log. Only ever posted once per request.
export async function crossPostMaintenanceLog(request) {
  if (request.category === "supplies" || request.maintenance_log_id) return null;

  const entry = await base44.entities.MaintenanceLog.create({
    log_type: request.category === "hardware_replacement_repair" ? "hardware_repair" : "register_service",
    register_id: request.register_id || "",
    title: request.subject,
    description: request.description || "",
    technician_name: request.assigned_operator_name || "",
    service_date: request.scheduled_date || new Date().toISOString().split("T")[0],
    status: "scheduled",
    notes: `Raised by store ${request.store_id} as a facility request. ${request.hq_notes || ""}`.trim(),
    parts_used: request.assigned_hardware || "",
    store_id: request.store_id || "",
    sent_from_central: true,
    updated_by: request.decided_by_name || "HQ",
    updated_by_role: "hq_admin",
    updated_at: new Date().toISOString(),
  });
  return entry.id;
}