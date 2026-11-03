import { describe, expect, test } from 'bun:test';
import {
  createTicket,
  hashPicturePin,
  isAdultPin,
  isKidCode,
  isPicturePin,
  newCode,
  normalizeCode,
  PARENT_CODE_LENGTH,
  randomPicturePin,
  readTicket,
  verifyPicturePin,
} from '@/lib/kid-login';
import { KID_EXERCISES, kidExercise, starsFor } from '@/lib/kids';
import { EXERCISES, exerciseIdFromName } from '@/lib/exercises-data';
import { DEMO_KIDS } from '@/lib/demo-accounts';

process.env.NEXTAUTH_SECRET ??= 'unit-test-secret';

describe('kid codes', () => {
  test('new codes use the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const c = newCode();
      expect(isKidCode(c)).toBe(true);
      expect(c).not.toMatch(/[01ILO]/);
    }
    expect(newCode(PARENT_CODE_LENGTH)).toHaveLength(8);
  });

  test('typing is forgiving: case, spaces and dashes are ignored', () => {
    expect(normalizeCode(' ab3-k9q ')).toBe('AB3K9Q');
    expect(normalizeCode(42)).toBe('');
    expect(isKidCode('AB3K9Q')).toBe(true);
    expect(isKidCode('AB0K9Q')).toBe(false); // zero is not in the alphabet
    expect(isKidCode('AB3K9')).toBe(false);
  });

  test('demo kid codes and link codes are valid', () => {
    for (const k of DEMO_KIDS) {
      expect(isKidCode(k.kidCode)).toBe(true);
      expect(k.parentLinkCode).toHaveLength(PARENT_CODE_LENGTH);
      expect(isPicturePin([...k.pictures])).toBe(true);
    }
  });
});

describe('picture password', () => {
  test('3 known pictures only', () => {
    expect(isPicturePin(['cat', 'dog', 'fish'])).toBe(true);
    expect(isPicturePin(['cat', 'dog'])).toBe(false);
    expect(isPicturePin(['cat', 'dog', 'unicorn'])).toBe(false);
    expect(isPicturePin('cat-dog-fish')).toBe(false);
    expect(isPicturePin(randomPicturePin())).toBe(true);
  });

  test('order matters', async () => {
    const hash = await hashPicturePin(['cat', 'dog', 'fish']);
    expect(await verifyPicturePin(['cat', 'dog', 'fish'], hash)).toBe(true);
    expect(await verifyPicturePin(['fish', 'dog', 'cat'], hash)).toBe(false);
  });

  test('adult PIN is exactly 4 digits', () => {
    expect(isAdultPin('1234')).toBe(true);
    expect(isAdultPin('123')).toBe(false);
    expect(isAdultPin('12a4')).toBe(false);
    expect(isAdultPin(1234)).toBe(false);
  });
});

describe('switch tickets', () => {
  test('valid once, then refused', () => {
    const t = createTicket({ userId: 'u1', returnUserId: 'a1' });
    expect(readTicket(t)).toEqual(expect.objectContaining({ userId: 'u1', returnUserId: 'a1' }));
    expect(readTicket(t)).toBeNull();
  });

  test('garbage and tampering are refused', () => {
    expect(readTicket(undefined)).toBeNull();
    expect(readTicket('abc')).toBeNull();
    const [payload] = createTicket({ userId: 'u1' }).split('.');
    expect(readTicket(`${payload}.forged`)).toBeNull();
  });
});

describe('stars and kid exercise text', () => {
  test('accuracy → 1–3 stars', () => {
    expect(starsFor(100)).toBe(3);
    expect(starsFor(85)).toBe(3);
    expect(starsFor(84.9)).toBe(2);
    expect(starsFor(60)).toBe(2);
    expect(starsFor(10)).toBe(1);
    expect(starsFor(0)).toBe(1);
  });

  test('every catalogue exercise has a kid name and at most 3 short steps', () => {
    for (const ex of EXERCISES) {
      const slug = exerciseIdFromName(ex.name);
      expect(KID_EXERCISES[slug]).toBeDefined();
      const k = kidExercise(slug, ex);
      expect(k.steps.length).toBeGreaterThan(0);
      expect(k.steps.length).toBeLessThanOrEqual(3);
    }
  });

  test('lying-down rehab moves are hidden from kids', () => {
    expect(kidExercise('ex_seated_heel_slides', { nameTh: 'x', instructions: [] }).forKids).toBe(false);
    expect(kidExercise('ex_unknown', { nameTh: 'ชื่อ', instructions: ['a', 'b', 'c', 'd'] })).toEqual({ name: 'ชื่อ', steps: ['a', 'b', 'c'], forKids: true });
  });
});
