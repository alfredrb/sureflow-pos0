import React from "react";
import PromptConfirm from "@/components/customerdisplay/prompts/PromptConfirm";
import PromptRating from "@/components/customerdisplay/prompts/PromptRating";
import PromptNumeric from "@/components/customerdisplay/prompts/PromptNumeric";
import PromptSignature from "@/components/customerdisplay/prompts/PromptSignature";
import { answerPrompt } from "@/lib/customerPrompt";

const VIEWS = {
  confirm: PromptConfirm,
  rating: PromptRating,
  numeric: PromptNumeric,
  signature: PromptSignature,
};

// Draws whichever prompt the POS has open on this lane, and writes the customer's answer
// back onto the same record. An unknown prompt type renders nothing rather than an error
// screen — a customer must never be shown a fault, and the POS times the prompt out.
export default function CustomerPromptView({ registerId, prompt, trainingMode }) {
  const View = VIEWS[prompt?.type];
  if (!View) return null;

  const onAnswer = (answer) => {
    answerPrompt(registerId, prompt.id, { type: prompt.type, ...answer }).catch(() => {});
  };

  return <View prompt={prompt} trainingMode={trainingMode} onAnswer={onAnswer} />;
}