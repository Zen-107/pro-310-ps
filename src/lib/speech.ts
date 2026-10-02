// Browser speech for coaching cues (Web Speech API) with a Web Audio chime
// fallback when the device has no Thai voice. Browser only.

/**
 * Rank a voice for Thai coaching: neural/online voices sound far more
 * natural than legacy offline ones (Edge "Microsoft Premwadee/Niwat Online
 * (Natural)", Chrome "Google ภาษาไทย"); non-Thai voices score -1.
 */
export function scoreThaiVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace('_', '-');
  if (!lang.startsWith('th')) return -1;
  const name = v.name.toLowerCase();
  let score = lang === 'th-th' ? 1 : 0;
  if (/natural|neural|wavenet/.test(name)) score += 6;
  if (name.includes('google')) score += 5;
  if (name.includes('online')) score += 3;
  if (/premwadee|niwat|achara|kanya|nawat|pattara/.test(name)) score += 2;
  if (!v.localService) score += 1; // cloud voices are usually higher quality
  return score;
}

export function pickThaiVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreThaiVoice(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return bestScore >= 0 ? best : null;
}

/** Voices load asynchronously in Chrome/Edge; wait briefly for the list */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      clearTimeout(timer);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener('voiceschanged', done);
  });
}

// Natural Thai pacing: neutral pitch, slightly slower than default
export const SPEECH_RATE = 0.95;
export const SPEECH_PITCH = 1.0;

export function speak(text: string, voice: SpeechSynthesisVoice | null): void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text.slice(0, 300));
  u.lang = voice?.lang ?? 'th-TH';
  if (voice) u.voice = voice;
  u.rate = SPEECH_RATE;
  u.pitch = SPEECH_PITCH;
  synth.cancel(); // newest cue replaces any queued one
  // Chrome sometimes stays paused after cancel(); resume is a no-op otherwise
  synth.resume();
  synth.speak(u);
}

let audioCtx: AudioContext | null = null;

/**
 * Short two-note chime (Web Audio) used instead of speech when no Thai voice
 * is installed: the patient hears that new advice appeared on screen.
 * `kind` = 'cue' (rising, attention) or 'ok' (single soft note).
 */
export function chime(kind: 'cue' | 'ok' = 'cue'): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes = kind === 'cue' ? [659.25, 880] : [783.99];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.14;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // audio unavailable: silent
  }
}
