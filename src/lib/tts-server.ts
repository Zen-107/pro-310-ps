// Server-side Thai text-to-speech for the live coach.
//
// Browsers often have no Thai voice installed (Chrome/Edge on Windows without
// the Thai language pack), so Web Speech would fall back to a chime. The
// server synthesises MP3 instead, with Google Translate's TTS endpoint: no
// API key, fast (~150 ms) and reliable in testing (10/10). It is an
// unofficial endpoint, so it can be switched off with TTS_PROVIDER="off";
// the client then uses the browser's Thai voice, or a chime.
//
// Only coaching text is sent (no names or identifiers). Coach cues repeat a
// lot, so audio is cached in memory.

const MAX_CHUNK = 180; // Google rejects requests over ~200 characters
export const MAX_TTS_TEXT = 400;
const CACHE_MAX = 400;
const TIMEOUT_MS = 6000;

export function ttsEnabled(): boolean {
  return (process.env.TTS_PROVIDER ?? 'google').toLowerCase() !== 'off';
}

/** Split at sentence/word boundaries (Thai has no spaces: use Intl.Segmenter) into ≤ MAX_CHUNK pieces */
export function chunkThai(text: string, max = MAX_CHUNK): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const words = Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(clean), (s) => s.segment);
  const chunks: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur.length + w.length > max && cur.trim()) {
      chunks.push(cur.trim());
      cur = '';
    }
    // A single "word" longer than max (unlikely): hard split
    for (let i = 0; i < w.length; i += max) {
      const piece = w.slice(i, i + max);
      if (cur.length + piece.length > max && cur.trim()) {
        chunks.push(cur.trim());
        cur = '';
      }
      cur += piece;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function googleChunk(text: string): Promise<Buffer> {
  const url =
    'https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&ttsspeed=1&q=' + encodeURIComponent(text);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('audio')) throw new Error(`TTS upstream ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const cache = new Map<string, Buffer>();
const inflight = new Map<string, Promise<Buffer>>();

/** MP3 audio for Thai text (MP3 frames can be concatenated directly) */
export async function synthesizeThai(text: string): Promise<Buffer> {
  const key = text.replace(/\s+/g, ' ').trim();
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key); // LRU: move to the end
    cache.set(key, hit);
    return hit;
  }
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const parts: Buffer[] = [];
    for (const chunk of chunkThai(key)) parts.push(await googleChunk(chunk));
    const audio = Buffer.concat(parts);
    cache.set(key, audio);
    if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    return audio;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}

// ─── Per-user rate limit (sliding window, in memory) ─────────────────
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 200; // a session speaks a cue every few seconds at most
const hits = new Map<string, number[]>();

export function allowTts(userId: string, now = Date.now()): boolean {
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return false;
  }
  recent.push(now);
  hits.set(userId, recent);
  return true;
}
