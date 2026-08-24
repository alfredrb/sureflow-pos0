import React from "react";
import { Lock } from "lucide-react";

// Marks a setting as chain policy so a store manager knows it is not broken, just
// not theirs to change.
export default function HqLockBadge({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 ${className}`}>
      <Lock className="h-2.5 w-2.5" /> Set by HQ
    </span>
  );
}