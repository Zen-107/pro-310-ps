import { describe, expect, test } from 'bun:test';
import { LandmarkSmoother, OneEuroFilter } from '@/lib/landmark-smoother';
import { pose, rng } from '../helpers/pose';

const std = (xs: number[]) => {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

describe('OneEuroFilter', () => {
  test('passes a constant signal through unchanged', () => {
    const f = new OneEuroFilter();
    for (let i = 0; i < 30; i++) expect(f.filter(0.5, i / 30)).toBeCloseTo(0.5, 10);
  });

  test('reduces jitter on a still landmark by at least 2×', () => {
    const f = new OneEuroFilter();
    const r = rng(1);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const v = 0.5 + 0.005 * r.gauss();
      raw.push(v);
      out.push(f.filter(v, i / 30));
    }
    expect(std(out.slice(30))).toBeLessThan(std(raw.slice(30)) / 2);
  });

  test('follows a fast movement closely (low lag when moving)', () => {
    const f = new OneEuroFilter();
    let last = 0;
    for (let i = 0; i <= 30; i++) last = f.filter(i / 30, i / 30); // 0 → 1 in one second
    expect(last).toBeGreaterThan(0.9);
  });
});

/** Side view: hips/shoulders close together in x (narrow spread), legs apart */
function sideView(leftKneeX: number, rightKneeX: number) {
  return pose({
    LEFT_SHOULDER: { x: 0.5, y: 0.3 },
    RIGHT_SHOULDER: { x: 0.52, y: 0.3 },
    LEFT_HIP: { x: 0.5, y: 0.55 },
    RIGHT_HIP: { x: 0.52, y: 0.55 },
    LEFT_KNEE: { x: leftKneeX, y: 0.75 },
    RIGHT_KNEE: { x: rightKneeX, y: 0.75 },
    LEFT_ANKLE: { x: leftKneeX, y: 0.95 },
    RIGHT_ANKLE: { x: rightKneeX, y: 0.95 },
  });
}

describe('LandmarkSmoother', () => {
  test('corrects a sudden left/right leg label swap in side view', () => {
    const s = new LandmarkSmoother();
    let t = 0;
    for (let i = 0; i < 20; i++) s.process(sideView(0.4, 0.62), null, (t += 33));
    // The model swaps the leg labels for one frame
    const out = s.process(sideView(0.62, 0.4), null, (t += 33));
    expect(out.image[25].x).toBeCloseTo(0.4, 1); // left knee stays on the left track
    expect(out.image[26].x).toBeCloseTo(0.62, 1);
    expect(s.correctingSwap).toBe(true);
  });

  test('landmarks predicted outside the image are reported as not visible', () => {
    const s = new LandmarkSmoother();
    const lm = sideView(0.4, 0.62);
    let out = s.process(lm, null, 0);
    lm[27] = { ...lm[27], y: 1.3 }; // left ankle far below the frame
    for (let i = 1; i < 15; i++) out = s.process(lm, null, i * 33);
    expect(out.image[27].visibility).toBe(0);
    expect(out.image[25].visibility).toBeGreaterThan(0.5);
  });

  test('low-visibility landmarks drop out with hysteresis, then recover', () => {
    const s = new LandmarkSmoother();
    const lm = sideView(0.4, 0.62);
    let out = s.process(lm, null, 0);
    expect(out.image[25].visibility).toBeGreaterThan(0.5);
    lm[25] = { ...lm[25], visibility: 0.1 };
    for (let i = 1; i < 15; i++) out = s.process(lm, null, i * 33);
    expect(out.image[25].visibility).toBe(0);
    lm[25] = { ...lm[25], visibility: 1 };
    for (let i = 15; i < 30; i++) out = s.process(lm, null, i * 33);
    expect(out.image[25].visibility).toBeGreaterThan(0.5);
  });

  test('reset forgets the swap state', () => {
    const s = new LandmarkSmoother();
    let t = 0;
    for (let i = 0; i < 10; i++) s.process(sideView(0.4, 0.62), null, (t += 33));
    s.process(sideView(0.62, 0.4), null, (t += 33));
    s.reset();
    expect(s.correctingSwap).toBe(false);
  });
});
