import { useEffect, useState } from "react";
import { getPinpadStatus, subscribePinpadStatus } from "@/lib/pinpadStatus";

// Subscribes the operator screen to the lane pinpad's live status.
export default function usePinpadStatus() {
  const [status, setStatus] = useState(getPinpadStatus());
  useEffect(() => subscribePinpadStatus(setStatus), []);
  return status;
}