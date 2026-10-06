import { describe, expect, test } from 'bun:test';
import { evaluateFormChecks, parseFormChecks, sideOf, type FormCheck } from '@/lib/form-checks';

const checks: FormCheck[] = [
  { id: 'elbow_straight', type: 'min', measurement: '{side}_elbow', threshold: 160, message: 'Keep your elbow straight' },
  { id: 'trunk_upright', type: 'max', measurement: 'trunk_inclination', threshold: 15, message: 'Upright' },
  { id: 'weight_even', type: 'symmetry', measurement: 'left_knee', other: 'right_knee', maxDiff: 15, message: 'Even' },
  { id: 'other_leg', type: 'min', measurement: '{other}_knee', threshold: 160, message: 'Other leg straight' },
];

describe('evaluateFormChecks', () => {
  test('no faults when every check passes', () => {
    const angles = { left_elbow: 175, trunk_inclination: 5, left_knee: 170, right_knee: 172 };
    expect(evaluateFormChecks(checks, angles, 'left_shoulder')).toEqual([]);
  });

  test('min, max and symmetry faults with their deficits', () => {
    const angles = { left_elbow: 140, trunk_inclination: 25, left_knee: 120, right_knee: 170 };
    const faults = evaluateFormChecks(checks, angles, 'left_shoulder');
    const by = Object.fromEntries(faults.map((f) => [f.checkId, f]));
    expect(by.elbow_straight.deficit).toBe(20);
    expect(by.trunk_upright.deficit).toBe(10);
    expect(by.weight_even.deficit).toBe(35);
  });

  test('{side} and {other} follow the counted side', () => {
    const angles = { left_elbow: 175, right_elbow: 120, left_knee: 120, right_knee: 175 };
    const right = evaluateFormChecks(checks, angles, 'right_shoulder').map((f) => f.checkId);
    expect(right).toContain('elbow_straight'); // right elbow bent
    expect(right).toContain('other_leg'); // other = left knee bent
    const left = evaluateFormChecks(checks, angles, 'left_shoulder').map((f) => f.checkId);
    expect(left).not.toContain('elbow_straight');
  });

  test('side templates are skipped for measurements without a side', () => {
    expect(evaluateFormChecks(checks, { left_elbow: 100 }, 'trunk_rotation')).toEqual([]);
    expect(sideOf('trunk_rotation')).toBeNull();
  });

  test('checks on measurements that are not visible are skipped', () => {
    expect(evaluateFormChecks(checks, {}, 'left_shoulder')).toEqual([]);
  });
});

describe('parseFormChecks', () => {
  test('keeps valid checks and drops malformed JSON entries', () => {
    const parsed = parseFormChecks([...checks, { id: 'x', type: 'min', measurement: 'a' }, null, 'junk', { type: 'symmetry' }]);
    expect(parsed).toHaveLength(checks.length);
    expect(parseFormChecks('not an array')).toEqual([]);
  });
});
