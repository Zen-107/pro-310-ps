import { describe, expect, test } from 'bun:test';
import { angleAt, calculateAllAngles, getAngleStatus, isAngleCorrect } from '@/lib/angle-utils';
import { pose, standing } from '../helpers/pose';

describe('angleAt', () => {
  test('right angle and straight line', () => {
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(90);
    expect(angleAt({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(180);
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBe(0);
  });

  test('uses all three axes (3D)', () => {
    expect(angleAt({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBe(90);
  });

  test('zero-length vectors give null, never 0°', () => {
    expect(angleAt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })).toBeNull();
  });
});

describe('calculateAllAngles', () => {
  test('standing upright: straight knees, arms down, trunk vertical', () => {
    const a = calculateAllAngles(standing());
    expect(a.left_knee).toBe(180);
    expect(a.right_knee).toBe(180);
    expect(a.left_shoulder).toBeLessThan(20);
    expect(a.trunk_lateral_flexion).toBe(0);
    expect(a.trunk_inclination).toBe(0);
  });

  test('bent knee measured at 90°', () => {
    const a = calculateAllAngles(
      pose({ LEFT_HIP: { x: 0.5, y: 0.5 }, LEFT_KNEE: { x: 0.5, y: 0.7 }, LEFT_ANKLE: { x: 0.7, y: 0.7 } })
    );
    expect(a.left_knee).toBe(90);
  });

  test('image x is scaled by the aspect ratio', () => {
    // 45° in a square image becomes atan(2) ≈ 63.4° from vertical when width = 2 × height
    const lm = pose({ LEFT_HIP: { x: 0.5, y: 0.5 }, LEFT_KNEE: { x: 0.5, y: 0.7 }, LEFT_ANKLE: { x: 0.7, y: 0.9 } });
    expect(calculateAllAngles(lm).left_knee).toBe(135);
    expect(calculateAllAngles(lm, { aspect: 2 }).left_knee).toBeCloseTo(180 - 63.4, 0);
  });

  test('measurements with a hidden landmark are omitted', () => {
    const lm = standing();
    lm[25].visibility = 0.2; // left knee
    const a = calculateAllAngles(lm);
    expect(a.left_knee).toBeUndefined();
    expect(a.right_knee).toBe(180);
  });

  test('world landmarks are preferred when complete; trunk rotation needs them', () => {
    const image = standing();
    expect(calculateAllAngles(image).trunk_rotation).toBeUndefined();
    const world = standing().map((p) => ({ ...p, z: 0 }));
    // Shoulders rotated 30° about the vertical axis relative to the hips
    const rad = (30 * Math.PI) / 180;
    world[11] = { ...world[11], x: 0.5 + 0.1 * Math.cos(rad), z: 0.1 * Math.sin(rad) };
    world[12] = { ...world[12], x: 0.5 - 0.1 * Math.cos(rad), z: -0.1 * Math.sin(rad) };
    expect(calculateAllAngles(image, { world }).trunk_rotation).toBeCloseTo(30, 0);
  });
});

describe('scoring', () => {
  test('isAngleCorrect: 100% at ideal, 50% at the range edge, incorrect outside', () => {
    expect(isAngleCorrect(90, 90, 80, 100)).toEqual({ correct: true, deviation: 0, percentAccuracy: 100 });
    expect(isAngleCorrect(100, 90, 80, 100).percentAccuracy).toBe(50);
    expect(isAngleCorrect(100, 90, 80, 100).correct).toBe(true);
    expect(isAngleCorrect(101, 90, 80, 100).correct).toBe(false);
    expect(isAngleCorrect(130, 90, 80, 100).percentAccuracy).toBe(0);
  });

  test('getAngleStatus: in range good, within 15° warn, else bad', () => {
    expect(getAngleStatus(90, 80, 100)).toBe('good');
    expect(getAngleStatus(110, 80, 100)).toBe('warn');
    expect(getAngleStatus(116, 80, 100)).toBe('bad');
    expect(getAngleStatus(66, 80, 100)).toBe('warn');
  });
});
