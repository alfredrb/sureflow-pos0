import React from "react";
import { ScanLine } from "lucide-react";

export default function SCOWelcome({ storeName, onStart }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 p-8">
      <div className="text-center space-y-3">
        <p className="text-blue-300/60 uppercase tracking-[0.3em] text-sm">{storeName || "Welcome"}</p>
        <h1 className="text-5xl sm:text-6xl font-bold text-white">Self Checkout</h1>
        <p className="text-blue-200/60 text-xl">Scan your first item to begin, or touch Start.</p>
      </div>
      <button
        onClick={onStart}
        className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white rounded-3xl px-16 py-8 text-3xl font-bold shadow-lg shadow-blue-600/30 flex items-center gap-4"
      >
        <ScanLine className="w-10 h-10" /> Start
      </button>
      <p className="text-blue-300/30 text-sm">Card and gift card only — for cash, please see a cashier.</p>
    </div>
  );
}