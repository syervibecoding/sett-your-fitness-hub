// Audio + haptic feedback for the student workout flow.
// Uses the Web Audio API (zero asset files). Mute state persists in localStorage.

const MUTE_KEY = "sett_sound_muted";

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Play `count` short beeps at a given frequency.
function beep(count = 1, frequency = 660, gap = 160): void {
  if (isSoundMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  const now = audio.currentTime;
  for (let i = 0; i < count; i++) {
    const start = now + i * (gap / 1000);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.14);
  }
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

// Fired when a rest timer reaches zero.
export function restDoneFeedback(): void {
  beep(2, 660);
  vibrate([200, 100, 200]);
}

// Fired when the student sets a new personal record.
export function prFeedback(): void {
  beep(3, 988);
  vibrate([100, 50, 100, 50, 300]);
}
