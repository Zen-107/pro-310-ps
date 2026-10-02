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

// Coaching pace: a little faster than default sounds clear and energetic
// (default-speed Thai TTS comes across as slow); pitch stays neutral.
export const SPEECH_RATE = 1.15; // Web Speech fallback
export const PLAYBACK_RATE = 1.15; // server TTS clips (pitch preserved)
export const SPEECH_PITCH = 1.0;

// Chrome garbage-collects an utterance that is only referenced by the speech
// queue, and it then never plays. Keep the live one referenced.
let currentUtterance: SpeechSynthesisUtterance | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Speak Thai text. `voice` may be null (voice list not loaded yet): the
 * browser then picks its own voice for lang th-TH. The newest cue replaces
 * any queued one. Chrome silently drops an utterance passed to speak() in the
 * same tick as cancel(), so after a cancel the new one starts a moment later.
 */
export function speak(text: string, voice: SpeechSynthesisVoice | null): void {
  const synth = window.speechSynthesis;
  const u = new SpeechSynthesisUtterance(text.slice(0, 300));
  u.lang = voice?.lang ?? 'th-TH';
  if (voice) u.voice = voice;
  u.rate = SPEECH_RATE;
  u.pitch = SPEECH_PITCH;
  u.volume = 1;
  u.onend = u.onerror = () => {
    if (currentUtterance === u) {
      currentUtterance = null;
      activePriority = null;
    }
  };
  if (pendingTimer) clearTimeout(pendingTimer);
  const start = () => {
    pendingTimer = null;
    currentUtterance = u;
    synth.resume(); // Chrome can stay paused after cancel(); no-op otherwise
    synth.speak(u);
  };
  if (synth.speaking || synth.pending) {
    synth.cancel();
    pendingTimer = setTimeout(start, 80);
  } else {
    start();
  }
}

export function stopSpeech(): void {
  if (typeof window === 'undefined') return;
  speakToken++; // drops any cue still being fetched
  fetchAbort?.abort();
  fetchAbort = null;
  activePriority = null;
  if (audioEl) audioEl.pause();
  if (!('speechSynthesis' in window)) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  currentUtterance = null;
  window.speechSynthesis.cancel();
}

// ─── Coach voice: server TTS → browser Thai voice → chime ────────────

/**
 * 'superseded' = not played: replaced by a newer cue, dropped because a
 * higher-priority cue is playing, or ready too late to still be relevant.
 */
export type SpeechOutput = 'server' | 'browser' | 'chime' | 'superseded';

/** 'high' = corrections: always interrupt. 'normal' = coach/encouragement: never cut a correction short */
export type SpeechPriority = 'high' | 'normal';

/** A cue not playing within this time after it was requested is dropped (no late, stacked speech) */
export const MAX_CUE_LATENCY_MS = 1500;

let activePriority: SpeechPriority | null = null;

function somethingPlaying(): boolean {
  if (fetchAbort) return true;
  if (audioEl && !audioEl.paused && !audioEl.ended) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

let audioEl: HTMLAudioElement | null = null;
let fetchAbort: AbortController | null = null;
let speakToken = 0;
/** Server TTS is skipped until this time after repeated failures / when disabled */
let serverRetryAt = 0;
let serverFailures = 0;
const SERVER_BACKOFF_MS = 60_000;
const SERVER_TIMEOUT_MS = 2500;
const clipCache = new Map<string, string>(); // text → object URL (recent cues replay instantly)
const CLIP_CACHE_MAX = 60;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.preservesPitch = true; // faster playback without a higher pitch
    audioEl.defaultPlaybackRate = PLAYBACK_RATE;
    audioEl.addEventListener('ended', () => (activePriority = null));
  }
  return audioEl;
}

/** 50 ms of silence as a WAV data URI (primes the audio element inside a click) */
function silentWav(): string {
  const samples = 400; // 8 kHz × 0.05 s, 8-bit mono
  const buf = new Uint8Array(44 + samples);
  const dv = new DataView(buf.buffer);
  const str = (o: number, s: string) => [...s].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  dv.setUint32(4, 36 + samples, true);
  str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, 8000, true);
  dv.setUint32(28, 8000, true);
  dv.setUint16(32, 1, true);
  dv.setUint16(34, 8, true);
  str(36, 'data');
  dv.setUint32(40, samples, true);
  buf.fill(128, 44); // 8-bit silence
  let bin = '';
  buf.forEach((b) => (bin += String.fromCharCode(b)));
  return 'data:audio/wav;base64,' + btoa(bin);
}

async function serverClip(text: string, signal: AbortSignal): Promise<string> {
  const cached = clipCache.get(text);
  if (cached) return cached;
  const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`, {
    signal: AbortSignal.any ? AbortSignal.any([signal, AbortSignal.timeout(SERVER_TIMEOUT_MS)]) : signal,
  });
  if (res.status === 503) serverRetryAt = Number.POSITIVE_INFINITY; // disabled on this server
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  clipCache.set(text, url);
  if (clipCache.size > CLIP_CACHE_MAX) {
    const oldest = clipCache.keys().next().value!;
    URL.revokeObjectURL(clipCache.get(oldest)!);
    clipCache.delete(oldest);
  }
  return url;
}

/**
 * Speak a Thai coaching cue. Nothing is queued: a new cue flushes whatever
 * is playing or still loading (a 'normal' cue never cuts a 'high' one short;
 * it is dropped instead), and a cue that can't start within
 * MAX_CUE_LATENCY_MS is dropped rather than played late. Output order:
 *  1. server TTS (/api/tts) — works without any Thai voice installed;
 *  2. the browser's Thai voice (Web Speech), when the server is unavailable;
 *  3. a chime, when neither can speak.
 */
export async function speakThai(
  text: string,
  browserVoice: SpeechSynthesisVoice | null,
  priority: SpeechPriority = 'normal'
): Promise<SpeechOutput> {
  if (typeof window === 'undefined') return 'superseded';
  const clean = text.trim().slice(0, 300);
  if (!clean) return 'superseded';
  if (priority === 'normal' && activePriority === 'high' && somethingPlaying()) return 'superseded';
  stopSpeech(); // flush: no stacked cues
  const token = ++speakToken;
  activePriority = priority;
  const requestedAt = Date.now();
  const stale = () => Date.now() - requestedAt > MAX_CUE_LATENCY_MS;

  if (Date.now() >= serverRetryAt) {
    const ctrl = new AbortController();
    fetchAbort = ctrl;
    try {
      const url = await serverClip(clean, ctrl.signal);
      if (token !== speakToken || stale()) return 'superseded';
      const el = getAudioEl();
      el.src = url;
      el.playbackRate = PLAYBACK_RATE; // a new src resets the rate
      await el.play();
      serverFailures = 0;
      return 'server';
    } catch (e) {
      if (token !== speakToken || (e instanceof DOMException && e.name === 'AbortError' && ctrl.signal.aborted)) return 'superseded';
      if (++serverFailures >= 2 && serverRetryAt !== Number.POSITIVE_INFINITY) {
        serverRetryAt = Date.now() + SERVER_BACKOFF_MS;
        serverFailures = 0;
      }
    } finally {
      if (fetchAbort === ctrl) fetchAbort = null;
    }
  }

  if (token !== speakToken || stale()) return 'superseded';
  const canSpeak = 'speechSynthesis' in window && (!!browserVoice || !voicesReady());
  if (canSpeak) {
    try {
      speak(clean, browserVoice);
      return 'browser';
    } catch {
      // fall through to the chime
    }
  }
  chime('cue');
  return 'chime';
}

/** true once the browser has reported its voice list (it can be empty before that) */
export function voicesReady(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0;
}

/**
 * Call synchronously inside a click handler (e.g. "start session"). Browsers
 * only allow speech and Web Audio after a user gesture; a silent utterance
 * and resuming the AudioContext here unlock both for the rest of the session.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    // Priming the shared <audio> element lets later server clips autoplay (iOS Safari)
    const el = getAudioEl();
    el.src = silentWav();
    void el.play().catch(() => {});
  } catch {
    // ignore
  }
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'th-TH';
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(u);
    }
  } catch {
    // ignore
  }
  try {
    void getAudioCtx()?.resume();
  } catch {
    // ignore
  }
}

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/**
 * Short two-note chime (Web Audio) used instead of speech when no Thai voice
 * is installed: the patient hears that new advice appeared on screen.
 * `kind` = 'cue' (rising, attention) or 'ok' (single soft note).
 */
export function chime(kind: 'cue' | 'ok' = 'cue'): void {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
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
