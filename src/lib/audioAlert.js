// Simple tone generator for soft chime alert
export const playChime = async () => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    
    // Create a soft double-beep chime (two tones)
    const createTone = (freq, startTime, duration) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    // First tone: 800Hz for 150ms
    createTone(800, now, 0.15);
    // Second tone: 1000Hz for 150ms, delayed by 100ms
    createTone(1000, now + 0.1, 0.15);
  } catch (e) {
    // Silently fail if audio context unavailable
  }
};

export const getSoundEnabled = () => {
  return localStorage.getItem('alertSoundEnabled') !== 'false';
};

export const setSoundEnabled = (enabled) => {
  localStorage.setItem('alertSoundEnabled', enabled ? 'true' : 'false');
};