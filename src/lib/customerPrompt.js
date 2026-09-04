// Touch prompts on the customer-facing monitor — the web replacement for the Ingenico
// pinpad flows.
//
// WHY THIS EXISTS INSTEAD OF THE PINPAD: driving the iSC250's glass needs a signed Retail
// Base Application that these pads do not carry, and loading one is a procurement task
// gated by Ingenico. The customer monitor on these lanes is already a touch panel the app
// controls end to end, so amount approval, signature, number entry and the rating are
// captured there instead. No pad, no gateway, no processor.
//
// The transport is the SAME single CustomerDisplayState record the cart mirror uses: the POS
// writes `prompt`, the monitor window writes `response`, both watch via realtime. The two
// windows share nothing else — they are separate browsing contexts on separate Xorg outputs.

import { base44 } from "@/api/data";
import { patchState, readState } from "@/lib/customerDisplayState";

// How long a prompt waits for a customer who has walked away or is simply ignoring it.
export const PROMPT_TIMEOUT_MS = 90000;

export const newPromptId = () =>
  `P-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();

// Put a prompt on the customer's screen. Clears any previous answer in the same write, so a
// response left over from the last prompt can never be mistaken for this one's.
export async function requestPrompt(registerId, prompt) {
  const id = prompt.id || newPromptId();
  await patchState(registerId, {
    prompt: { allow_cancel: true, ...prompt, id, requested_at: new Date().toISOString() },
    response: {},
  });
  return id;
}

// Take the prompt back down — after an answer, on timeout, or when the operator abandons it.
export const clearPrompt = (registerId) => patchState(registerId, { prompt: {}, response: {} });

// Wait for the customer to act. Resolves with { timed_out: true } rather than throwing,
// because a lane must never be left stuck on an unanswered customer prompt: the caller
// decides what an unanswered prompt means for its own flow.
export function awaitPromptResponse({ registerId, promptId, timeoutMs = PROMPT_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (out) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub();
      clearPrompt(registerId).catch(() => {});
      resolve(out);
    };

    const check = async () => {
      const s = await readState(registerId);
      const r = s?.response;
      if (r?.id === promptId) finish(r);
    };

    const timer = setTimeout(() => finish({ id: promptId, timed_out: true }), timeoutMs);
    const unsub = base44.entities.CustomerDisplayState.subscribe(() => check().catch(() => {}));
    check().catch(() => {});
  });
}

// Request + wait in one call — what the POS actually uses.
export async function askCustomer(registerId, prompt, timeoutMs) {
  const id = await requestPrompt(registerId, prompt);
  return awaitPromptResponse({ registerId, promptId: id, timeoutMs });
}

// MONITOR SIDE — the customer's answer. Only ever called from the customer display window.
export function answerPrompt(registerId, promptId, answer) {
  return patchState(registerId, {
    response: { ...answer, id: promptId, answered_at: new Date().toISOString() },
  });
}