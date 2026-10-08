import { describe, expect, test } from 'bun:test';
import { EXERCISES, exerciseIdFromName, exerciseMeta, targetsForSide } from '@/lib/exercises-data';
import { JOINT_FORMULAS } from '@/lib/joint-formulas';
import { parseFormChecks } from '@/lib/form-checks';
import { EXERCISE_DEMOS, buildSkeleton, measure, demoProgress, type DemoMeasurement } from '@/lib/exercise-poses';

// Data integrity of the exercise catalogue (the seed's source of truth)

describe('exercise catalogue', () => {
  test('slugs are unique', () => {
    const slugs = EXERCISES.map((e) => exerciseIdFromName(e.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  for (const ex of EXERCISES) {
    describe(ex.name, () => {
      test('targets: min ≤ ideal ≤ max, measurable formula', () => {
        expect(ex.targetJoints.length).toBeGreaterThan(0);
        for (const t of ex.targetJoints) {
          expect(t.minAngle).toBeLessThanOrEqual(t.idealAngle);
          expect(t.idealAngle).toBeLessThanOrEqual(t.maxAngle);
          expect(JOINT_FORMULAS[t.name] ?? null).not.toBeNull();
        }
      });

      test('form checks are well-formed and reference known measurements', () => {
        const checks = ex.formChecks ?? [];
        expect(parseFormChecks(checks)).toHaveLength(checks.length);
        for (const c of checks) {
          for (const m of [c.measurement, c.type === 'symmetry' ? c.other : null]) {
            if (!m) continue;
            const resolved = m.replace('{side}', 'left').replace('{other}', 'right');
            expect(JOINT_FORMULAS[resolved] ?? null).not.toBeNull();
          }
        }
      });
    });
  }

  // Floor exercises are hard for one webcam to see. Static Quads is the one
  // deliberate exception (requested by the clinical team; camera at floor level).
  const LYING_ALLOWED = new Set(['ex_static_quads']);
  test('only standing or sitting exercises, except the allowed lying ones', () => {
    const lying = /นอน|lying|supine|prone|side-lying|bridge|clamshell|straight leg raise/i;
    for (const ex of EXERCISES) {
      if (LYING_ALLOWED.has(exerciseIdFromName(ex.name))) continue;
      expect(`${ex.name} ${ex.instructions.join(' ')}`).not.toMatch(lying);
    }
  });

  test('one-side-at-a-time exercises have a left and a right target', () => {
    for (const ex of EXERCISES.filter((e) => e.unilateral)) {
      const names = ex.targetJoints.map((t) => t.name);
      expect(names.some((n) => n.startsWith('left_'))).toBe(true);
      expect(names.some((n) => n.startsWith('right_'))).toBe(true);
    }
  });

  test('hold exercises state the hold time in their instructions', () => {
    for (const ex of EXERCISES.filter((e) => e.holdSeconds)) {
      expect(ex.instructions.join(' ')).toContain(`${ex.holdSeconds} วินาที`);
    }
  });
});

describe('exercise demos', () => {
  test('every demo belongs to a catalogue exercise', () => {
    const slugs = new Set(EXERCISES.map((e) => exerciseIdFromName(e.name)));
    for (const slug of Object.keys(EXERCISE_DEMOS)) expect(slugs.has(slug)).toBe(true);
  });

  // The demo's end position must show what the app measures as the target
  const MEASURED: Record<DemoMeasurement, string> = {
    knee: 'knee',
    hip: 'hip',
    hip_flexion: 'hip_flexion',
    shoulder: 'shoulder',
    hip_opening: 'hip_opening',
  };
  for (const [slug, demo] of Object.entries(EXERCISE_DEMOS)) {
    test(`${slug}: end pose lies in the exercise's primary target range`, () => {
      const ex = EXERCISES.find((e) => exerciseIdFromName(e.name) === slug)!;
      const target = ex.targetJoints.find((t) => t.name.endsWith(MEASURED[demo.measurement]))!;
      // Continuous demos (arm circles) peak mid-cycle; others at t = 1
      const t = demo.continuous ? 0.5 : 1;
      const value = measure(buildSkeleton(demo.pose(t)), demo.measurement).value;
      expect(value).toBeGreaterThanOrEqual(target.minAngle - 5);
      expect(value).toBeLessThanOrEqual(target.maxAngle + 5);
    });
  }

  test('demo timeline holds at start and end positions', () => {
    const demo = EXERCISE_DEMOS.ex_squat;
    expect(demoProgress(demo, 0.1)).toBe(0);
    expect(demoProgress(demo, 0.7 + 1.5 + 0.5)).toBe(1);
  });
});

describe('one side at a time', () => {
  test('targetsForSide keeps the chosen side as the only primary target', () => {
    const targets = [
      { name: 'left_shoulder', isPrimary: true },
      { name: 'right_shoulder', isPrimary: false },
      { name: 'trunk_lateral_flexion', isPrimary: false },
    ];
    const right = targetsForSide(targets, 'right');
    expect(right.map((t) => t.name)).toEqual(['right_shoulder', 'trunk_lateral_flexion']);
    expect(right.filter((t) => t.isPrimary).map((t) => t.name)).toEqual(['right_shoulder']);
  });

  test('catalogue metadata: hold times and sides', () => {
    expect(exerciseMeta('ex_static_quads')).toMatchObject({ holdSeconds: 5, isometric: true, unilateral: false });
    expect(exerciseMeta('ex_static_quads').posture?.measurement).toBe('trunk_inclination');
    expect(exerciseMeta('ex_cross_body_shoulder_stretch')).toMatchObject({ holdSeconds: 10, unilateral: true });
    expect(exerciseMeta('ex_shoulder_abduction').unilateral).toBe(true);
    expect(exerciseMeta('ex_unknown')).toEqual({ holdSeconds: null, isometric: false, unilateral: false, posture: null });
  });

  test('arm circles demo draws the circle the hands trace', () => {
    const guides = EXERCISE_DEMOS.ex_arm_circles.guides!(0.25);
    expect(guides).toHaveLength(2);
    expect(guides[0].radius).toBeGreaterThan(4);
  });
});
