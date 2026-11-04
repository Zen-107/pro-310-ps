// A child's own "น้องยืด": body colour, eyes, mouth, hat, outfit and glasses.
// Stored in Patient.avatar as "color.eyes.mouth.hat.outfit.glasses"
// (e.g. "sky.star.grin.cap.scarf.none"). A bare colour ("peach", the old
// format) means the default look in that colour. Browser-safe (no server code).

import { AVATARS } from '@/lib/kids';

export interface LookOption {
  id: string;
  label: string;
  /** Completed rounds needed before the child can pick it */
  unlock?: number;
}

export const LOOK_PARTS = {
  color: AVATARS.map((a, i) => ({ id: a.id, label: ['ส้มพีช', 'ฟ้าใส', 'เขียวมินต์', 'ม่วงองุ่น', 'เหลืองแดด', 'ชมพูปะการัง'][i] ?? a.id })),
  eyes: [
    { id: 'shiny', label: 'ตาแป๋ว' },
    { id: 'smile', label: 'ตายิ้ม' },
    { id: 'dot', label: 'ตาจุด' },
    { id: 'wink', label: 'ขยิบตา' },
    { id: 'star', label: 'ตาดาว', unlock: 3 },
    { id: 'heart', label: 'ตาหัวใจ', unlock: 6 },
  ],
  mouth: [
    { id: 'cat', label: 'ปากแมว' },
    { id: 'grin', label: 'ยิ้มกว้าง' },
    { id: 'o', label: 'ปากโอ' },
    { id: 'tongue', label: 'แลบลิ้น' },
    { id: 'teeth', label: 'ฟันกระต่าย', unlock: 2 },
  ],
  hat: [
    { id: 'none', label: 'ไม่ใส่' },
    { id: 'bow', label: 'โบว์' },
    { id: 'flower', label: 'ดอกไม้' },
    { id: 'headband', label: 'ผ้าคาดหัว' },
    { id: 'cap', label: 'หมวกแก๊ป', unlock: 1 },
    { id: 'party', label: 'หมวกปาร์ตี้', unlock: 5 },
    { id: 'crown', label: 'มงกุฎ', unlock: 10 },
  ],
  outfit: [
    { id: 'none', label: 'ไม่ใส่' },
    { id: 'scarf', label: 'ผ้าพันคอ' },
    { id: 'bowtie', label: 'หูกระต่าย' },
    { id: 'medal', label: 'เหรียญทอง', unlock: 7 },
    { id: 'cape', label: 'ผ้าคลุมฮีโร่', unlock: 15 },
  ],
  glasses: [
    { id: 'none', label: 'ไม่ใส่' },
    { id: 'round', label: 'แว่นกลม' },
    { id: 'sun', label: 'แว่นกันแดด', unlock: 4 },
  ],
} satisfies Record<string, LookOption[]>;

export type LookPart = keyof typeof LOOK_PARTS;
export const LOOK_ORDER: LookPart[] = ['color', 'eyes', 'mouth', 'hat', 'outfit', 'glasses'];
export type MascotLook = Record<LookPart, string>;

export const DEFAULT_LOOK: MascotLook = { color: 'peach', eyes: 'shiny', mouth: 'cat', hat: 'none', outfit: 'none', glasses: 'none' };

const known = (part: LookPart, id: string | undefined) => !!id && LOOK_PARTS[part].some((o) => o.id === id);

/** Tolerant: unknown or missing parts fall back to the default */
export function parseLook(avatar: string | null | undefined): MascotLook {
  const bits = (avatar ?? '').split('.');
  const look = { ...DEFAULT_LOOK };
  LOOK_ORDER.forEach((part, i) => {
    if (known(part, bits[i])) look[part] = bits[i];
  });
  return look;
}

export function encodeLook(look: MascotLook): string {
  return LOOK_ORDER.map((p) => look[p]).join('.');
}

/** Strict: every part present and known (for saving) */
export function isValidLook(avatar: unknown): avatar is string {
  if (typeof avatar !== 'string' || avatar.length > 80) return false;
  const bits = avatar.split('.');
  return bits.length === LOOK_ORDER.length && LOOK_ORDER.every((p, i) => known(p, bits[i]));
}

export function unlockNeeded(part: LookPart, id: string): number {
  return (LOOK_PARTS[part] as LookOption[]).find((o) => o.id === id)?.unlock ?? 0;
}

/** Parts of a look the child has not unlocked yet with `rounds` completed rounds */
export function lockedParts(look: MascotLook, rounds: number): LookPart[] {
  return LOOK_ORDER.filter((p) => unlockNeeded(p, look[p]) > rounds);
}

/** A random look from what the child has unlocked */
export function randomLook(rounds: number, rnd: () => number = Math.random): MascotLook {
  const look = { ...DEFAULT_LOOK };
  for (const part of LOOK_ORDER) {
    const open = (LOOK_PARTS[part] as LookOption[]).filter((o) => (o.unlock ?? 0) <= rounds);
    look[part] = open[Math.floor(rnd() * open.length)].id;
  }
  return look;
}
