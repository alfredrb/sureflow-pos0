import React from "react";

// Full-width status banners under the POS top bar: training mode, tax exempt,
// linked loyalty member, and a pending admin logout request.
export default function POSStatusBanners({
  trainingMode, trainingLocked, taxExemptId,
  loyaltyMember, loyaltyAppliedAmount, onClearLoyalty,
  remoteLogoutPending, remoteLogoutReason,
  csmApproval, onEndCsmApproval,
}) {
  return (
    <>
      {csmApproval && (
        <div className="bg-violet-500/10 border-b-2 border-violet-500/50 px-3 py-2 flex items-center justify-center gap-3 flex-shrink-0">
          <span className="text-violet-300 font-bold text-xs uppercase tracking-widest">🔑 CSM APPROVED — {csmApproval.name} · ends when this sale completes</span>
          <button onClick={onEndCsmApproval} className="text-violet-300/60 hover:text-violet-200 text-xs">turn off</button>
        </div>
      )}

      {trainingMode && (
        <div className="bg-gradient-to-r from-orange-500/10 via-orange-500/15 to-orange-500/10 border-b-2 border-orange-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-xs uppercase tracking-widest">⚠ TRAINING MODE — TRANSACTIONS NOT RECORDED{trainingLocked ? " (LOCKED)" : ""}</span>
        </div>
      )}

      {taxExemptId && (
        <div className="bg-emerald-500/10 border-b-2 border-emerald-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-emerald-400 font-bold text-xs uppercase tracking-widest">✓ TAX EXEMPT — {taxExemptId}</span>
        </div>
      )}

      {loyaltyMember && (
        <div className="bg-sky-500/10 border-b-2 border-sky-500/50 px-3 py-2 flex items-center justify-center gap-3 flex-shrink-0">
          <span className="text-sky-400 font-bold text-xs uppercase tracking-widest">★ LOYALTY — {loyaltyMember.name} ({loyaltyMember.loyalty_id})</span>
          {loyaltyAppliedAmount > 0 && <span className="text-green-400 font-bold text-xs">−${loyaltyAppliedAmount.toFixed(2)} rewards applied</span>}
          <button onClick={onClearLoyalty} className="text-sky-400/60 hover:text-sky-300 text-xs">remove</button>
        </div>
      )}

      {remoteLogoutPending && (
        <div className="bg-blue-600/10 border-b-2 border-blue-500/50 px-3 py-2 flex items-center justify-center flex-shrink-0">
          <span className="text-blue-300 font-bold text-xs uppercase tracking-widest">⏱ REMOTE LOGOUT PENDING — {remoteLogoutReason || "Admin requested logout"}. Complete your transaction to log out.</span>
        </div>
      )}
    </>
  );
}