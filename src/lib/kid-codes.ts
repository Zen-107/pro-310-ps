// Kid login formats shared by the browser (login screen) and the server
// (src/lib/kid-login.ts). No Node imports here.

/** No 0/O, 1/I/L: easy for a child to read and type */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const KID_CODE_LENGTH = 6;
export const PARENT_CODE_LENGTH = 8;

/** Upper-cases and drops spaces/dashes ("ab3-k9q" → "AB3K9Q") */
export function normalizeCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[\s-]/g, '') : '';
}

export const isKidCode = (code: string) => code.length === KID_CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

// ─── Picture password ────────────────────────────────────────────────
export const PICTURES = [
  { id: 'cat', emoji: '🐱', label: 'แมว' },
  { id: 'dog', emoji: '🐶', label: 'หมา' },
  { id: 'rabbit', emoji: '🐰', label: 'กระต่าย' },
  { id: 'bear', emoji: '🐻', label: 'หมี' },
  { id: 'frog', emoji: '🐸', label: 'กบ' },
  { id: 'fish', emoji: '🐟', label: 'ปลา' },
  { id: 'bird', emoji: '🐦', label: 'นก' },
  { id: 'elephant', emoji: '🐘', label: 'ช้าง' },
  { id: 'turtle', emoji: '🐢', label: 'เต่า' },
] as const;
export type PictureId = (typeof PICTURES)[number]['id'];
export const PICTURE_PIN_LENGTH = 3;

const PICTURE_IDS = new Set<string>(PICTURES.map((p) => p.id));

export function isPicturePin(value: unknown): value is PictureId[] {
  return Array.isArray(value) && value.length === PICTURE_PIN_LENGTH && value.every((v) => typeof v === 'string' && PICTURE_IDS.has(v));
}

// ─── Adult PIN (leave kid mode) ──────────────────────────────────────
export const isAdultPin = (value: unknown): value is string => typeof value === 'string' && /^\d{4}$/.test(value);

