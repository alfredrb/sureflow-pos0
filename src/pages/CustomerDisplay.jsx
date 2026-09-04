import React from "react";
import useCustomerDisplayFeed from "@/hooks/useCustomerDisplayFeed";
import CustomerCartView from "@/components/customerdisplay/CustomerCartView";
import CustomerIdleView from "@/components/customerdisplay/CustomerIdleView";
import CustomerThankYouView from "@/components/customerdisplay/CustomerThankYouView";
import CustomerPromptView from "@/components/customerdisplay/CustomerPromptView";

// The customer-facing monitor. Opened by the lane's kiosk launcher as a SECOND fullscreen
// Chromium window on the second Xorg output:
//   /customer-display?register_id=REG-001
//
// It follows whatever the POS window publishes for its register and nothing else.
//
// It is read-only EXCEPT while the POS has a touch prompt open on the lane (approve an
// amount, sign, key a number, rate the visit). These IBM/Toshiba SurePOS panels are touch
// panels, so those flows live here rather than on an Ingenico pad — the pads on this fleet
// lack the signed Retail Base Application needed to drive their glass. With no prompt open
// there is deliberately nothing on this screen to press.
export default function CustomerDisplay() {
  const params = new URLSearchParams(window.location.search);
  const registerId = params.get("register_id") || "";
  const { state, slides, mode, loading } = useCustomerDisplayFeed(registerId);

  if (!registerId) {
    return (
      <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center text-center px-12">
        <div>
          <p className="text-blue-300/60 text-3xl uppercase tracking-[0.3em] font-heading mb-6">
            Customer Display
          </p>
          <p className="text-white text-2xl">
            No register was passed to this screen. The lane's boot entry supplies it as
            <span className="font-mono text-blue-300"> ?register_id=</span>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const prompt = state?.prompt?.type ? state.prompt : null;

  return (
    <div className={`relative h-screen w-screen overflow-hidden bg-[#0a0e27] select-none ${prompt ? "" : "cursor-none"}`}>
      {mode === "sale" && (
        <CustomerCartView
          items={state?.items || []}
          subtotal={state?.subtotal || 0}
          tax={state?.tax || 0}
          total={state?.total || 0}
          trainingMode={state?.training_mode}
        />
      )}
      {mode === "thanks" && (
        <CustomerThankYouView thanks={state?.thanks || {}} trainingMode={state?.training_mode} />
      )}
      {mode === "idle" && <CustomerIdleView slides={slides} />}

      {/* Drawn on top of whatever mode is showing: the cart stays published underneath, so
          the sale is still on screen the moment the prompt is answered. */}
      {prompt && (
        <CustomerPromptView
          registerId={registerId}
          prompt={prompt}
          trainingMode={state?.training_mode}
        />
      )}
    </div>
  );
}