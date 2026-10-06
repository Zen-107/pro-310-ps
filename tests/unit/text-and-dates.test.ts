import { describe, expect, test } from 'bun:test';
import { cleanText, graphemes, safeTruncate, sanitizeText } from '@/lib/text-safe';
import { cleanClinicalSummary, thaiMeasurementName } from '@/lib/clinical-markdown';
import { allowTts, chunkThai } from '@/lib/tts-server';
import { addDays, dayOfWeek, isValidDay, localDateString } from '@/lib/dates';
import { printFileName } from '@/components/physio/report-print';
import { TERMS_VERSION, hasAcceptedTerms, termsFor } from '@/lib/terms';

describe('Thai-safe text', () => {
  test('safeTruncate never splits a Thai character from its marks', () => {
    const text = 'ผู้ป่วยที่ได้รับการผ่าตัดเข่า';
    for (let max = 1; max < graphemes(text).length; max++) {
      const out = safeTruncate(text, max, '');
      expect(text.startsWith(out)).toBe(true);
      // the next character is a base letter, not an orphaned vowel/tone mark
      const rest = text.slice(out.length);
      expect(rest).not.toMatch(/^\p{M}/u);
    }
    expect(safeTruncate(text, 5)).toEndWith('…');
  });

  test('safeTruncate keeps surrogate pairs (emoji) whole', () => {
    // 'ดี' is one grapheme (consonant + vowel mark): 4 graphemes in total
    expect(safeTruncate('ดี👍👍👍', 4, '')).toBe('ดี👍👍👍');
    expect(safeTruncate('ดี👍👍👍', 3, '')).toBe('ดี👍👍');
  });

  test('sanitizeText drops control characters, lone surrogates and leading marks', () => {
    expect(sanitizeText('a\u0000b\u0007c\nd')).toBe('abc\nd');
    expect(sanitizeText('x\uD800y')).toBe('xy');
    expect(sanitizeText('ิ่ก')).toBe('ก');
  });

  test('cleanText trims and returns null for empty input', () => {
    expect(cleanText('   ', 10)).toBeNull();
    expect(cleanText(42, 10)).toBeNull();
    expect(cleanText('  สวัสดี  ', 10)).toBe('สวัสดี');
  });
});

describe('AI summary cleanup', () => {
  test('removes self-made header fields, rules and engine identifiers', () => {
    const md = [
      '**ผู้ป่วย:** – – –',
      '**วันที่ตรวจ:** [วันที่]',
      '---',
      '## 1. สรุปผล',
      '- มุมเข่าซ้าย (มุม left_hip‑left_knee‑left_ankle) เฉลี่ย 95°',
      '- พบ INCOMPLETE_ROM 3 ครั้ง ที่ right_knee',
    ].join('\n');
    const out = cleanClinicalSummary(md);
    expect(out).not.toContain('ผู้ป่วย:');
    expect(out).not.toContain('---');
    expect(out).not.toMatch(/[a-z]+_[a-z]+/);
    expect(out).toContain('ทำไม่สุดระยะ');
    expect(out).toContain('เข่าขวา');
    expect(out.startsWith('## 1. สรุปผล')).toBe(true);
  });

  test('a markdown table gets the blank line GFM needs', () => {
    const out = cleanClinicalSummary('ผลการวัด:\n| ข้อต่อ | มุม |\n|---|---|\n| เข่า | 95 |');
    expect(out).toContain('ผลการวัด:\n\n| ข้อต่อ');
  });

  test('thaiMeasurementName', () => {
    expect(thaiMeasurementName('left_knee')).toBe('เข่าซ้าย');
    expect(thaiMeasurementName('trunk_rotation')).toBe('บิดลำตัว');
    expect(thaiMeasurementName('left_knee', { left_knee: 'เข่า (ซ้าย)' })).toBe('เข่า (ซ้าย)');
    expect(thaiMeasurementName('unknown_thing')).toBe('unknown_thing');
  });
});

describe('server TTS helpers', () => {
  test('chunkThai keeps short text whole', () => {
    expect(chunkThai('ยกแขนขึ้นอีกนิดครับ')).toEqual(['ยกแขนขึ้นอีกนิดครับ']);
    expect(chunkThai('   ')).toEqual([]);
  });

  test('chunkThai splits long Thai (no spaces) at word boundaries within the limit', () => {
    const text = 'ค่อยๆยกแขนขึ้นจนสุดแล้วค้างไว้สักครู่จากนั้นค่อยๆลดแขนลงมาที่ตำแหน่งเดิม'.repeat(6);
    const chunks = chunkThai(text, 180);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(180);
    expect(chunks.join('')).toBe(text);
  });

  test('rate limit: 200 requests per 10 minutes per user', () => {
    const user = `test-${Math.random()}`;
    for (let i = 0; i < 200; i++) expect(allowTts(user, 1_000 + i)).toBe(true);
    expect(allowTts(user, 2_000)).toBe(false);
    expect(allowTts(`${user}-other`, 2_000)).toBe(true);
    expect(allowTts(user, 1_000 + 10 * 60_000 + 1)).toBe(true); // window passed
  });
});

describe('clinic-time dates', () => {
  test('"today" follows Asia/Bangkok, not UTC', () => {
    expect(localDateString(new Date('2026-10-05T18:30:00Z'))).toBe('2026-10-06');
    expect(localDateString(new Date('2026-10-05T16:30:00Z'))).toBe('2026-10-05');
  });

  test('addDays, dayOfWeek and isValidDay', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayOfWeek('2026-10-05')).toBe(1); // Monday
    expect(isValidDay('2026-10-05')).toBe(true);
    expect(isValidDay('2026-13-40')).toBe(false);
    expect(isValidDay('5/10/2026')).toBe(false);
  });
});

describe('report file name and terms', () => {
  test('printresult_<last 6 of session id>_<patient name>', () => {
    const base = { patient: { name: 'คุณวิชัย กล้าหาญ', hn: null, age: null, gender: '', condition: null } };
    expect(printFileName({ ...base, sessionId: 'cmuqj7o0c003rmwqsq5e15htr' })).toBe('printresult_e15htr_คุณวิชัย กล้าหาญ');
    expect(printFileName({ sessionId: 'abcdefGHIJKL', patient: { ...base.patient, name: ' สมชาย/ใจดี: "x" ' } })).toBe('printresult_ghijkl_สมชาย ใจดี x');
    expect(printFileName({ sessionId: 'abcdef', patient: { ...base.patient, name: '***' } })).toBe('printresult_abcdef_patient');
  });

  test('terms acceptance is tied to the current version; roles get their own section', () => {
    expect(hasAcceptedTerms({ termsVersion: TERMS_VERSION })).toBe(true);
    expect(hasAcceptedTerms({ termsVersion: 'terms-th-v0' })).toBe(false);
    expect(hasAcceptedTerms(null)).toBe(false);
    expect(termsFor('PATIENT').some((s) => s.points.some((p) => p.includes('1669')))).toBe(true);
    expect(termsFor('CLINICIAN').some((s) => s.heading.includes('บุคลากร'))).toBe(true);
  });
});
