// Role-specific training guides shared by the Training Guides admin page
// and the New Employee onboarding printout. The built-in POS cashier guide
// lives in TrainingGuideContent.jsx and is intentionally not duplicated here.

export const ROLE_GUIDES = {
  cashier: {
    label: "Cashier",
    icon: "ShoppingCart",
    sections: [
      { title: "Daily Login & Start of Day", body: "Enter your Operator ID and PIN on the POS login screen and select your assigned register. Complete the SOD Protocol by counting and confirming your starting till balance — no sales are permitted until SOD is complete." },
      { title: "Ringing Sales & Payments", body: "Tap items from the function grid or open the Item List to search by name or SKU. Use the Quantity key to change amounts, then press PAY and choose the payment method (Cash, Credit, Debit, Check, Store Credit, or Gift Card). Enter the tendered amount and complete the sale." },
      { title: "Returns, Exchanges & CS Mode", body: "If enabled on your register, use the Returns tab to locate the original transaction and refund items to the original payment method. Use the Exchange tab to swap items in one transaction. Customer Service Mode handles gift card sales." },
      { title: "Overrides & Supervisor Help", body: "Voids, price overrides, and return-period extensions require a CSM or Manager PIN, or a remote override request. Keys marked MGR or CSM prompt for authorization. All overrides are logged." },
      { title: "Cash Management & End of Shift", body: "Use Cash Management to request cash pickups (remove excess cash) or advances (add cash). Watch for cash limit alerts. Always log out at the end of your shift so your drawer can be reconciled for End of Day." },
    ],
  },
  csm: {
    label: "CSM",
    icon: "Headphones",
    sections: [
      { title: "Approving Overrides", body: "Approve voids, price overrides, and return-period extensions using your PIN. Verify the request is legitimate before entering your credentials — every override you approve is logged against your Operator ID." },
      { title: "Customer Service Mode", body: "Oversee gift card sales, tax-exempt verification, and loyalty enrollment. Confirm tax-exempt IDs against the database before removing tax. Gift cards are non-refundable — confirm amounts with the customer before sale." },
      { title: "Cash Handling & Till Audits", body: "Perform cash pickups when a drawer exceeds the configured cash limit. Audit tills mid-shift if a discrepancy is suspected. Record any over/short immediately and flag repeated issues for investigation." },
      { title: "Managing Cashiers", body: "Monitor cashier activity and handle escalations. Use remote logout to free up or secure a register. Direct unresolved issues or suspected theft to the Manager or Loss Prevention team with supporting context." },
      { title: "Incident Response", body: "Respond to robbery reports and emergency log entries. Confirm the register is paused after a robbery, document what occurred, and escalate to the Manager immediately. Log all incidents with timestamps." },
    ],
  },
  manager: {
    label: "Manager",
    icon: "ShieldCheck",
    sections: [
      { title: "Admin Panel Access", body: "Log into the admin panel to manage operators, employees, inventory, registers, and store settings. Create new employees from the New Employee page — an Operator login is generated automatically and linked to the employee record." },
      { title: "Register Control", body: "Configure registers and network settings. Enable feature flags (Returns, Customer Service Mode, Exchange) per register. Use the Remote Workstation tool to monitor and control live registers, including remote logout." },
      { title: "Financial Oversight", body: "Review EOD reports, cash reconciliation, cash exports, and cash audits. Confirm audit discrepancies are resolved. Oversee payroll, staff reports, and the daily financial close at midnight." },
      { title: "Staff & Scheduling", body: "Create and manage operators and employees, assign roles, and configure admin permissions per role. Build shift schedules, manage shift templates, and approve shift swaps. Maintain training guides for your team." },
      { title: "Security & Loss Prevention", body: "Oversee the Loss Prevention workbench: investigations, theft trends, merchandise protection plans, and follow-up tasks. Review the emergency log, system alerts, and any flagged operator activity. Coordinate with LP on active cases." },
    ],
  },
  loss_prevention: {
    label: "Loss Prevention",
    icon: "ShieldAlert",
    sections: [
      { title: "LP Workbench Access", body: "Your access is admin-only: register logs, transactions, and the Loss Prevention workbench. You have no POS access. Use the workbench tabs for Loss Overview, Theft Trends, Investigations, AI Insights, Merchandise Protection, Documents, and Tasks." },
      { title: "Investigations", body: "Open and manage investigations by type (cash short/over, voids, overrides, refunds, no-sales, stock theft, patterns). Set severity, assign a supervisor, attach linked operators, and maintain the activity log. Close cases with a resolution note." },
      { title: "Merchandise Protection", body: "Review theft trends by category and apply protection plans (wrapped, case, counter, locked) to high-risk items. Set ID-required flags (18/21) for age-restricted products. Manage the category exclusion list to keep food/produce out of protection suggestions." },
      { title: "Stolen Inventory & Reconciliation", body: "For stock-theft investigations, log stolen items with quantity and unit cost. Saving the case deducts the stolen quantity from inventory and auto-calculates the dollar exposure. Use AI Insights to surface items needing protection." },
      { title: "Tasks & Follow-ups", body: "Create follow-up tasks — interview operators, review camera footage, pull receipts. Assign tasks to supervisors with due dates and severity. Use the Documents panel to print incident, robbery, and audit reports and attach them as evidence." },
    ],
  },
  technician: {
    label: "Technician",
    icon: "Wrench",
    sections: [
      { title: "POS Diagnostics", body: "Your POS access runs in locked Training Mode with diagnostic tools available. Use Diagnostic Tools to check device IP, connectivity, and register health. You cannot process live sales." },
      { title: "Hardware Status", body: "Monitor each register's hardware — printer, scanner, and cash drawer connectivity, plus make/model and serial numbers. Resolve disconnected or unknown device states and clear hardware alerts when resolved." },
      { title: "Maintenance Logs", body: "Log hardware repairs, software updates, register service, and preventive maintenance. Always capture the technician name and timestamps when updating a log entry's status." },
      { title: "Register Upgrades", body: "When replacing a device (printer, scanner, cash drawer, or terminal), record the new model and serial in the maintenance log. The register record auto-updates with the new device details." },
      { title: "System Health", body: "Track system alerts and network status across registers. Resolve hardware alerts with resolution notes and escalate recurring issues. Keep the maintenance log current so managers have an accurate service history." },
    ],
  },
};

export const getRoleGuideHtml = (role) => {
  const g = ROLE_GUIDES[role];
  if (!g) return "<p>No role-specific training guide is available for this role.</p>";
  return g.sections
    .map(
      (s) =>
        `<div style="margin:0 0 12px 0;padding:10px 12px;border-left:3px solid #2563eb;background:#f8fafc;border-radius:4px"><strong style="color:#0f172a">${s.title}</strong><p style="margin:6px 0 0 0;color:#475569;font-size:12px;line-height:1.5">${s.body}</p></div>`
    )
    .join("");
};