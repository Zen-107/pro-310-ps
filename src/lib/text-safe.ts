// Unicode-safe text helpers for Thai (and other multi-code-point) strings.
//
// String.prototype.slice cuts UTF-16 code units. Thai is in the BMP, so it never
// splits a code point, but it does split grapheme clusters: a consonant and its
// combining vowel/tone marks (e.g. "ที่" = ท + ี + ่) are separate code units, and
// slicing between them leaves a dangling mark that renders as a dotted circle
// and can confuse byte-offset based tooling. Emoji and other astral characters
// (surrogate pairs) can be split outright. These helpers cut on grapheme
// boundaries (Intl.Segmenter) and fall back to code points (Array.from).

type Segmenter = { segment: (s: string) => Iterable<{ segment: string }> };

let segmenter: Segmenter | null | undefined;

function getSegmenter(): Segmenter | null {
  if (segmenter === undefined) {
    const Ctor = (Intl as unknown as { Segmenter?: new (locale: string, opts: { granularity: 'grapheme' }) => Segmenter }).Segmenter;
    segmenter = Ctor ? new Ctor('th', { granularity: 'grapheme' }) : null;
  }
  return segmenter;
}

/** User-perceived characters (grapheme clusters), falling back to code points */
export function graphemes(text: string): string[] {
  const seg = getSegmenter();
  return seg ? Array.from(seg.segment(text), (s) => s.segment) : Array.from(text);
}

/**
 * Remove characters that break rendering or downstream byte-offset tooling:
 * lone UTF-16 surrogates, C0/C1 control characters (except \n and \t),
 * and leading combining marks with no base character.
 */
export function sanitizeText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) out += text[i] + text[++i]; // valid pair
      continue; // lone high surrogate
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue; // lone low surrogate
    if ((c < 0x20 && c !== 0x0a && c !== 0x09) || (c >= 0x7f && c <= 0x9f)) continue;
    out += text[i];
  }
  return out.normalize('NFC').replace(LEADING_MARKS, '');
}

// Built with the constructor: the `u` flag / \p{} need ES2018 regex literals
const LEADING_MARKS = new RegExp('^\\p{M}+', 'u');

/**
 * Truncate to at most `max` grapheme clusters, appending `ellipsis` when cut.
 * Never splits a Thai consonant from its vowel/tone marks or a surrogate pair.
 */
export function safeTruncate(text: string, max: number, ellipsis = '…'): string {
  const clean = sanitizeText(text);
  // Fast path: code-unit length is an upper bound on grapheme count
  if (clean.length <= max) return clean;
  const parts = graphemes(clean);
  if (parts.length <= max) return clean;
  const keep = Math.max(0, max - (ellipsis ? 1 : 0));
  return parts.slice(0, keep).join('').trimEnd() + ellipsis;
}

/** sanitize + trim + truncate for free text stored from user/AI input; null when empty */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = safeTruncate(sanitizeText(value).trim(), max, '');
  return text || null;
}
