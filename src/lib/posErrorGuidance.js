// Reviewed, static recovery steps for known POS errors, keyed by message title.
// Display only: nothing here changes how the error is handled. Unknown titles
// get no step and the status line shows the message as before.
const GUIDANCE = {
  "Print Failed": "Check the printer has paper and its cover is closed, then try again.",
  "Badge Failed": "Check the receipt printer, then print the badge again from Help.",
  "Still Offline": "Keep selling with cash or check. Sales are saved on the lane and upload when the connection returns.",
  "Tender Not Available": "Ask the customer for cash or check, or suspend the sale until the lane is back online.",
  "Sale Not Saved": "Do not hand over goods or redo the sale. Call a manager now.",
  "Suspend Failed": "Keep the sale on screen and call a manager.",
  "Transfer Failed": "Keep the sale on screen and call a manager.",
  "Resume Failed": "Scan the suspend slip again. If it still fails, call a manager.",
  "Retrieve Failed": "Scan the transfer slip again. If it still fails, call a manager.",
  "Reading Failed": "Check the register number and enter it again.",
  "Press Total First": "Press TOTAL, then choose the tender.",
  "Sale In Progress": "Tender or void the current sale first.",
  "Finish The Sale First": "Tender or abort the current sale first.",
  "Duplicate Serial": "Scan the serial on the unit in hand. Each unit has its own serial.",
  "Cannot Repeat": "Scan each serialized unit separately.",
  "Returns Disabled": "Send the customer to a register with returns or the service desk.",
  "Not Consolidated": "Wait for the overnight close, or ask a manager to check End of Day reports.",
  "Not Available": "Sign on with a non-technician ID to use this.",
  "Error": "Try again. If it keeps happening, call a supervisor.",
};

export function errorGuidance(message) {
  if (!message || message.variant !== "destructive") return "";
  return GUIDANCE[message.title] || "";
}