import { useEffect, useRef } from "react";
import { publishSale, publishIdle, publishThanks, THANKS_HOLD_MS } from "@/lib/customerDisplayState";

// POS-side publisher for the lane's customer-facing monitor.
//
// Mirrors usePinpadCartMirror's shape deliberately — same inputs, same "no hardware, no
// work" behavior — but writes to the shared state record instead of a socket, because the
// monitor is a separate browser window rather than a peripheral the relay can reach.
//
// Lanes with no monitor fitted publish NOTHING at all: enabled is false and every effect
// returns early, so this costs a lane without the hardware exactly one boolean check.
export default function useCustomerDisplayMirror({
  enabled, registerId, storeId, cart, subtotal, tax, total, trainingMode, lastReceipt,
}) {
  const thanksTimerRef = useRef(null);
  const shownReceiptRef = useRef(null);

  // Live cart <-> idle. A cleared cart returns the screen to the promotion rotation.
  useEffect(() => {
    if (!enabled || !registerId) return;
    // While the thank-you screen is holding, an empty cart is expected — publishing idle
    // here would cut the summary off the instant the sale completed.
    if (thanksTimerRef.current && cart.length === 0) return;
    if (cart.length === 0) {
      publishIdle({ registerId, storeId, trainingMode }).catch(() => {});
      return;
    }
    publishSale({ registerId, storeId, cart, subtotal, tax, total, trainingMode }).catch(() => {});
  }, [enabled, registerId, storeId, cart, subtotal, tax, total, trainingMode]);

  // Completed sale — thank the customer, hold, then hand the screen back to idle.
  // Keyed on the receipt id so a re-render never re-triggers it.
  useEffect(() => {
    if (!enabled || !registerId) return;
    const id = lastReceipt?.transactionId;
    if (!id || shownReceiptRef.current === id) return;
    shownReceiptRef.current = id;

    publishThanks({
      registerId,
      storeId,
      trainingMode,
      thanks: {
        total_paid: +(lastReceipt.total || 0),
        change_due: +(lastReceipt.change || 0),
        savings: +(lastReceipt.savings || lastReceipt.discount_total || 0),
        loyalty_points_earned: +(lastReceipt.loyalty_points_earned || 0),
        loyalty_name: lastReceipt.loyalty_member_name || "",
        note: lastReceipt.receipt_note || "",
      },
    }).catch(() => {});

    if (thanksTimerRef.current) clearTimeout(thanksTimerRef.current);
    thanksTimerRef.current = setTimeout(() => {
      thanksTimerRef.current = null;
      publishIdle({ registerId, storeId, trainingMode }).catch(() => {});
    }, THANKS_HOLD_MS);
  }, [enabled, registerId, storeId, trainingMode, lastReceipt?.transactionId]);

  // Leaving the lane must never strand a customer's cart on a public screen.
  useEffect(() => {
    if (!enabled || !registerId) return;
    return () => {
      if (thanksTimerRef.current) clearTimeout(thanksTimerRef.current);
      publishIdle({ registerId, storeId }).catch(() => {});
    };
  }, [enabled, registerId, storeId]);
}