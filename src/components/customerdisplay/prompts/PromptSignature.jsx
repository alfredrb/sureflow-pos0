import React, { useRef, useState } from "react";
import PromptShell from "@/components/customerdisplay/PromptShell";
import { base44 } from "@/api/data";

// Finger signature on the lane's touch panel.
//
// The drawing is UPLOADED and stored as a URL, never inlined into the display record: an
// inline PNG would be a large blob re-read on every cart update on this lane. Pointer events
// (not mouse or touch events separately) because these IBM/Toshiba panels report as touch on
// the lane and as a mouse on a technician's desk, and both must draw.
export default function PromptSignature({ prompt, trainingMode, onAnswer }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const ctx = () => {
    const c = canvasRef.current;
    const g = c.getContext("2d");
    g.lineWidth = 3;
    g.lineCap = "round";
    g.strokeStyle = "#0f172a";
    return g;
  };
  const at = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const c = canvasRef.current;
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const p = at(e);
    const g = ctx();
    g.beginPath();
    g.moveTo(p.x, p.y);
    setDirty(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = at(e);
    const g = ctx();
    g.lineTo(p.x, p.y);
    g.stroke();
  };
  const stop = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    setDirty(false);
  };

  const accept = async () => {
    setSaving(true);
    const blob = await new Promise((r) => canvasRef.current.toBlob(r, "image/png"));
    const file = new File([blob], "signature.png", { type: "image/png" });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onAnswer({ signature_url: file_url });
  };

  return (
    <PromptShell
      title={prompt.title || "Please sign below"}
      subtitle={prompt.subtitle}
      trainingMode={trainingMode}
      onCancel={prompt.allow_cancel === false ? null : () => onAnswer({ cancelled: true })}
    >
      <canvas
        ref={canvasRef}
        width={900}
        height={300}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerLeave={stop}
        className="mx-auto w-full max-w-3xl touch-none rounded-2xl bg-white"
      />
      <div className="mx-auto mt-5 grid w-full max-w-3xl grid-cols-2 gap-5">
        <button
          onClick={clear}
          className="rounded-2xl border-2 border-white/20 py-6 text-2xl font-semibold text-blue-200/80 active:bg-white/10"
        >
          Clear
        </button>
        <button
          disabled={!dirty || saving}
          onClick={accept}
          className="rounded-2xl bg-emerald-500 py-6 text-2xl font-bold text-white active:bg-emerald-600 disabled:bg-white/10 disabled:text-white/30"
        >
          {saving ? "Saving…" : "Done"}
        </button>
      </div>
    </PromptShell>
  );
}