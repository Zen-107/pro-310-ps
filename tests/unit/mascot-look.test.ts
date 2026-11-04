import { describe, expect, test } from 'bun:test';
import { avatarColors } from '@/lib/kids';
import { DEFAULT_LOOK, encodeLook, isValidLook, LOOK_ORDER, LOOK_PARTS, lockedParts, parseLook, randomLook } from '@/lib/mascot-look';

describe('mascot look', () => {
  test('an old colour-only avatar is the default look in that colour', () => {
    expect(parseLook('sky')).toEqual({ ...DEFAULT_LOOK, color: 'sky' });
    expect(parseLook(null)).toEqual(DEFAULT_LOOK);
    expect(avatarColors('sky').id).toBe('sky');
    expect(avatarColors('sky.star.grin.cap.scarf.none').id).toBe('sky');
  });

  test('encode and parse round-trip; unknown parts fall back', () => {
    const look = { color: 'mint', eyes: 'heart', mouth: 'teeth', hat: 'crown', outfit: 'cape', glasses: 'sun' };
    expect(parseLook(encodeLook(look))).toEqual(look);
    expect(parseLook('mint.nope.grin')).toEqual({ ...DEFAULT_LOOK, color: 'mint', mouth: 'grin' });
  });

  test('saving needs every part and only known ids', () => {
    expect(isValidLook(encodeLook(DEFAULT_LOOK))).toBe(true);
    expect(isValidLook('peach')).toBe(false);
    expect(isValidLook('peach.shiny.cat.none.none.hacker')).toBe(false);
    expect(isValidLook(42)).toBe(false);
  });

  test('items unlock with completed rounds', () => {
    const fancy = parseLook('peach.heart.cat.crown.cape.none');
    expect(lockedParts(fancy, 0)).toEqual(['eyes', 'hat', 'outfit']);
    expect(lockedParts(fancy, 10)).toEqual(['outfit']);
    expect(lockedParts(fancy, 15)).toEqual([]);
    expect(lockedParts(DEFAULT_LOOK, 0)).toEqual([]);
  });

  test('a random look only uses unlocked items', () => {
    for (let i = 0; i < 50; i++) {
      const look = randomLook(0);
      expect(lockedParts(look, 0)).toEqual([]);
      expect(isValidLook(encodeLook(look))).toBe(true);
    }
  });

  test('every part has a free default option', () => {
    for (const part of LOOK_ORDER) expect((LOOK_PARTS[part] as { unlock?: number }[]).some((o) => !o.unlock)).toBe(true);
  });
});
