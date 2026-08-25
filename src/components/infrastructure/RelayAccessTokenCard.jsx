import React, { useState } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

// The relay's RELAY_ACCESS_TOKEN, held server-side on the store's RelayCredential.
//
// The portal never reads this token again after generation — it is attached to
// privileged relay calls by the relayProxy backend function. That is why it is shown
// exactly once here, for pasting into the relay's .env.
export default function RelayAccessTokenCard({ store, credential, newToken, onGenerateToken }) {
  const [copied, setCopied] = useState(false);
  const has = !!credential?.access_token;

  const copy = () => {
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" /> Relay access token
        </span>
        <span className="text-[11px] font-medium text-gray-700">
          {has
            ? `Stored · ${credential.last_used_at ? `used ${format(new Date(credential.last_used_at), "MMM d, h:mm a")}` : "never used"}`
            : "Not set"}
        </span>
      </div>

      {newToken && (
        <>
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 flex items-center gap-2">
            <code className="text-[10px] text-emerald-300 font-mono break-all flex-1">{newToken}</code>
            <button onClick={copy} className="p-1 rounded text-gray-400 hover:text-white flex-shrink-0">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-amber-600 leading-snug">
            Copy this now — it is never shown again. Set it on the relay as
            <span className="font-mono"> RELAY_ACCESS_TOKEN </span>
            in <span className="font-mono">.env</span>, then restart
            <span className="font-mono"> sureflow-relay</span>.
          </p>
        </>
      )}

      <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => onGenerateToken(store)}>
        {has ? "Rotate Access Token" : "Generate Access Token"}
      </Button>
      {!newToken && (
        <p className="text-[10px] text-gray-400 leading-snug">
          Used by the cloud portal to authorize reboot, backup, self-update and lane reboot on this
          store's relay. Rotating it here means pasting the new value into the relay .env.
        </p>
      )}
    </div>
  );
}