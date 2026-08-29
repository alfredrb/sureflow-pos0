import React, { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import POSCredentialPinpad from "@/components/pos/POSCredentialPinpad";
import { SCO_REASONS, SUPERVISOR_REQUIRED } from "@/lib/scoAssist";

// 'Help is on the way' lock screen — holds the lane until an attendant resolves
// the request remotely, or walks over and keys their credentials here.
export default function SCOHelpScreen({ request, product, onUnlock, unlockError, unlockLoading, onCancel }) {
  const [showUnlock, setShowUnlock] = useState(false);
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const [serial, setSerial] = useState("");
  const releaseOnly = SUPERVISOR_REQUIRED.includes(request.reason);
  const needsSerial = request.reason === "serialized";

  return (
    <div className="fixed inset-0 z-50 bg-[#3a1d05]/97 backdrop-blur flex flex-col items-center justify-center p-8 overflow-y-auto">
      <AlertTriangle className="w-20 h-20 text-orange-400 animate-pulse" />
      <h1 className="text-white text-4xl font-bold mt-6 text-center">Help is on the way</h1>
      <p className="text-orange-200/80 text-xl mt-3 text-center">
        {SCO_REASONS[request.reason] || "An attendant has been called"}
        {product ? ` — ${product.name}` : ""}
      </p>
      <p className="text-orange-300/50 mt-2 text-center">An attendant has been notified. Please wait at the lane.</p>

      {onCancel && (
        <button onClick={onCancel} className="mt-6 text-orange-200/70 hover:text-orange-100 underline text-lg">
          Never mind — cancel help
        </button>
      )}

      <div className="mt-10 w-full max-w-xs">
        {!showUnlock ? (
          <button
            onClick={() => setShowUnlock(true)}
            className="w-full text-orange-300/40 hover:text-orange-200 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 py-3"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Attendant unlock
          </button>
        ) : (
          <div className="bg-[#111638] border border-orange-500/20 rounded-2xl p-4 space-y-3">
            {needsSerial && (
              <Input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Scan / key item serial number"
                autoFocus
                className="bg-[#0a0e27] border-orange-500/20 text-white font-mono"
              />
            )}
            <POSCredentialPinpad
              active={showUnlock}
              accent="orange"
              prompt={releaseOnly
                ? "CSM / Manager ID + PIN to release this lane (the item will not be added):"
                : "Attendant ID + PIN to approve and continue:"}
              operatorId={operatorId}
              setOperatorId={setOperatorId}
              pin={pin}
              setPin={setPin}
              loading={unlockLoading}
              error={unlockError}
              onSubmit={() => onUnlock({ operatorId, pin, serial, release: releaseOnly })}
            />
            {!releaseOnly && (
              <button
                onClick={() => onUnlock({ operatorId, pin, serial: "", release: true })}
                className="w-full text-orange-300/50 hover:text-orange-200 text-xs underline"
              >
                Release without adding the item
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}