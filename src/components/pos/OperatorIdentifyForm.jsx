import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Operator ID + PIN identification used by the self-service Time Clock and the
// Shift Lookup so both screens ask for credentials the same way.
export default function OperatorIdentifyForm({ onIdentify, buttonLabel = "Identify", accentClass = "bg-amber-600 hover:bg-amber-700" }) {
  const [operatorId, setOperatorId] = useState("");
  const [pin, setPin] = useState("");
  const pinRef = React.useRef(null);

  const submit = () => onIdentify(operatorId.trim(), pin.trim(), () => { setOperatorId(""); setPin(""); });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Operator ID</label>
        <Input
          value={operatorId}
          onChange={(e) => setOperatorId(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pinRef.current?.focus(); } }}
          placeholder="Enter your operator ID"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">PIN</label>
        <Input
          ref={pinRef}
          type="password"
          placeholder="****"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      <Button onClick={submit} className={`w-full ${accentClass}`}>
        <LogIn className="w-4 h-4" /> {buttonLabel}
      </Button>
    </div>
  );
}