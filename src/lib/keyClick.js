// 4690-style keypad buzzer. The real lane keyboards have an internal piezo that
// clicks on every keystroke and screen touch; browsers can't drive that buzzer, so
// this reproduces it through the terminal's speaker with a short square-wave blip.

let ctx = null;

const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};

export const playKeyClick = () => {
  if (!isKeyClickEnabled()) return;
  try {
    const ac = getCtx();
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = 2000;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  } catch (e) {
    // No audio device on this lane — stay silent.
  }
};

export const isKeyClickEnabled = () => localStorage.getItem("posKeyClick") !== "false";

export const setKeyClickEnabled = (enabled) => {
  localStorage.setItem("posKeyClick", enabled ? "true" : "false");
};