import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// The live sale, as the customer reads it from across the counter. Type is deliberately
// far larger than the operator's cart — this is read at arm's length and often at an
// angle, so line height and contrast matter more than density.
export default function CustomerCartView({ items = [], subtotal = 0, tax = 0, total = 0, trainingMode }) {
  const listRef = useRef(null);

  // Newest line stays visible. A customer watching a long sale should always see the item
  // that was just scanned, not the top of a list that has scrolled past it.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div className="h-full w-full flex flex-col bg-[#0a0e27] text-white">
      {trainingMode && (
        <div className="bg-orange-500 text-white text-center py-3 text-2xl font-bold tracking-widest">
          TRAINING MODE — NOT A REAL SALE
        </div>
      )}

      <div className="px-10 pt-8 pb-4">
        <p className="text-blue-300/60 text-2xl uppercase tracking-[0.3em] font-heading">Your Order</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-10 scrollbar-hide">
        <AnimatePresence initial={false}>
          {items.map((item, i) => (
            <motion.div
              key={`${item.name}-${i}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex items-baseline justify-between gap-8 py-5 border-b border-blue-500/10"
            >
              <div className="min-w-0">
                <p className="text-4xl font-medium truncate">{item.name}</p>
                {item.qty > 1 && (
                  <p className="text-2xl text-blue-300/60 mt-1">
                    {item.qty} × ${Number(item.price).toFixed(2)}
                  </p>
                )}
              </div>
              <p className="text-4xl font-mono tabular-nums shrink-0">
                ${Number(item.total).toFixed(2)}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="px-10 py-8 border-t-2 border-blue-500/30 bg-[#070b1f]">
        <div className="flex justify-between text-3xl text-blue-300/70 mb-3">
          <span>Subtotal</span>
          <span className="font-mono tabular-nums">${Number(subtotal).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-3xl text-blue-300/70 mb-5">
          <span>Tax</span>
          <span className="font-mono tabular-nums">${Number(tax).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-5xl font-bold uppercase tracking-wide font-heading">Total</span>
          <motion.span
            key={total}
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            className="text-7xl font-bold font-mono tabular-nums text-emerald-400"
          >
            ${Number(total).toFixed(2)}
          </motion.span>
        </div>
      </div>
    </div>
  );
}