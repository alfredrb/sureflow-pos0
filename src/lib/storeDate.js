// Today's business date (YYYY-MM-DD) in the lane's local timezone, which the
// lane image inherits from the store controller. Using UTC rolled the day over
// at 8 PM Eastern, so start-of-day thought tomorrow had already begun.
export function storeToday(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}