// Lightweight audio + haptic feedback for the athlete experience.
// Uses the Web Audio API (no audio assets needed) and the Vibration API.
// Sound respects a persisted mute preference; both fail silently when unsupported.

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

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Play `times` short beeps. No-op when muted or unsupported. */
export function beep(times = 2, frequency = 880): void {
  if (isSoundMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const now = ac.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      const start = now + i * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[] = 200): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/** Rest interval finished — call the athlete back to the bar. */
export function restDoneFeedback(): void {
  beep(2);
  vibrate([200, 100, 200]);
}

/** Personal record beaten — celebratory cue. */
export function prFeedback(): void {
  beep(3, 988);
  vibrate([80, 60, 80, 60, 200]);
}
