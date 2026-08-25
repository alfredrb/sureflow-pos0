import React from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { COMMAND_LABELS, openCommandsFor, lastFinishedCommand } from "@/lib/relayCommandQueue";

// Queued operations waiting on a store's relay, plus the outcome of the last one that
// finished. Without this an admin queues a reboot and has nothing telling them it is
// waiting rather than done.
export default function RelayCommandStatus({ storeNumber, commands = [] }) {
  const open = openCommandsFor(commands, storeNumber);
  const last = lastFinishedCommand(commands, storeNumber);
  if (open.length === 0 && !last) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
      {open.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-xs text-amber-700">
          <Clock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            <span className="font-medium">{COMMAND_LABELS[c.command_type] || c.command_type}</span>
            {c.register_id ? ` · lane ${c.register_id}` : ""} —{" "}
            {c.status === "claimed" ? "relay is running it now" : "waiting for the next sync pass"}
          </span>
        </div>
      ))}
      {last && (
        <div className={`flex items-start gap-2 text-xs ${last.status === "completed" ? "text-emerald-600" : "text-red-600"}`}>
          {last.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
          <span className="break-words">
            <span className="font-medium">{COMMAND_LABELS[last.command_type] || last.command_type}</span>{" "}
            {last.status === "completed" ? "completed" : "failed"}
            {last.completed_at ? ` ${format(new Date(last.completed_at), "MMM d, h:mm a")}` : ""}
            {last.result ? ` — ${last.result}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}