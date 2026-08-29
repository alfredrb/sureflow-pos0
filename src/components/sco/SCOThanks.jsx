import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function SCOThanks({ receipt, onDone }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <CheckCircle2 className="w-24 h-24 text-emerald-400" />
      <h1 className="text-white text-5xl font-bold">Thank you!</h1>
      <p className="text-blue-200/70 text-2xl">
        Paid <span className="font-mono font-bold text-white">${(receipt?.total || 0).toFixed(2)}</span>
        {receipt?.method === "giftcard" ? " with gift card" : ""}
      </p>
      {receipt?.rewardsEarned > 0 && (
        <p className="text-emerald-300/80 text-lg">
          {receipt.loyaltyName ? `${receipt.loyaltyName}, you` : "You"} earned ${receipt.rewardsEarned.toFixed(2)} in rewards.
        </p>
      )}
      <p className="text-blue-300/40 text-lg">Please take your receipt and bagged items.</p>
      <button onClick={onDone} className="mt-4 bg-blue-600 hover:bg-blue-500 rounded-2xl px-10 py-4 text-white text-xl font-bold active:scale-95 transition-all">
        Done
      </button>
    </div>
  );
}