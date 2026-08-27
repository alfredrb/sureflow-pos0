import React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

// Post-tender summary. Shown only after a SUCCESSFUL tender, holds briefly, then the
// lane hands the screen back to the idle rotation.
export default function CustomerThankYouView({ thanks = {}, trainingMode }) {
  const savings = Number(thanks.savings || 0);
  const points = Number(thanks.loyalty_points_earned || 0);
  const change = Number(thanks.change_due || 0);

  return (
    <div className="h-full w-full bg-[#0a0e27] flex flex-col items-center justify-center text-white px-16 text-center">
      {trainingMode && (
        <div className="absolute top-0 inset-x-0 bg-orange-500 text-center py-3 text-2xl font-bold tracking-widest">
          TRAINING MODE — NOT A REAL SALE
        </div>
      )}

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center mb-10"
      >
        <Check className="w-16 h-16 text-white" strokeWidth={3} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="text-7xl font-bold font-heading mb-4"
      >
        Thank You
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-4xl text-blue-300/70 font-mono tabular-nums"
      >
        ${Number(thanks.total_paid || 0).toFixed(2)} paid
      </motion.p>

      {change > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-5xl font-bold text-amber-400 mt-8 font-mono tabular-nums"
        >
          Change ${change.toFixed(2)}
        </motion.p>
      )}

      {(savings > 0 || points > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 border-t border-blue-500/20 pt-10 flex gap-16"
        >
          {savings > 0 && (
            <div>
              <p className="text-2xl uppercase tracking-widest text-blue-300/50 mb-2">You Saved</p>
              <p className="text-6xl font-bold text-emerald-400 font-mono tabular-nums">
                ${savings.toFixed(2)}
              </p>
            </div>
          )}
          {points > 0 && (
            <div>
              <p className="text-2xl uppercase tracking-widest text-blue-300/50 mb-2">Points Earned</p>
              <p className="text-6xl font-bold text-emerald-400 font-mono tabular-nums">
                {points.toLocaleString()}
              </p>
              {thanks.loyalty_name && (
                <p className="text-xl text-blue-300/50 mt-2">{thanks.loyalty_name}</p>
              )}
            </div>
          )}
        </motion.div>
      )}

      {thanks.note && (
        <p className="text-2xl text-blue-300/50 mt-12 max-w-3xl">{thanks.note}</p>
      )}
    </div>
  );
}