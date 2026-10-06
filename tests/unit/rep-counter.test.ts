import { describe, expect, test } from 'bun:test';
import { RepCounter, REP_DEFAULTS, getRepTargets, type RepEvent, type MovementPhase } from '@/lib/rep-counter';

const shoulder = { name: 'left_shoulder', idealAngle: 165, minAngle: 150, maxAngle: 180, isPrimary: true };
const shoulderR = { name: 'right_shoulder', idealAngle: 165, minAngle: 150, maxAngle: 180 };
const FRAME = 33;

/** Feed a piecewise-linear angle trajectory: [durationMs, from, to][] → events and phases */
function play(counter: RepCounter, segments: [number, number, number][], joints = ['left_shoulder'], start = 0) {
  const events: RepEvent[] = [];
  const phases: MovementPhase[] = [];
  let t = start;
  for (const [dur, a0, a1] of segments) {
    for (let k = 0; k < dur; k += FRAME) {
      const angle = a0 + (a1 - a0) * (k / dur);
      const angles = Object.fromEntries(joints.map((j) => [j, angle]));
      events.push(...counter.update(angles, t));
      const ph = counter.motion(t).phase;
      if (phases[phases.length - 1] !== ph) phases.push(ph);
      t += FRAME;
    }
  }
  return { events, phases, end: t };
}

describe('getRepTargets', () => {
  test('primary target plus its left/right counterpart', () => {
    expect(getRepTargets([shoulderR, shoulder]).map((t) => t.name)).toEqual(['left_shoulder', 'right_shoulder']);
    expect(getRepTargets([{ ...shoulder, name: 'trunk_rotation' }]).map((t) => t.name)).toEqual(['trunk_rotation']);
  });
});

describe('RepCounter', () => {
  test('one rep: enter the range, hold, leave — scored on the best angle', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    const { events } = play(c, [
      [3000, 10, 10],
      [1500, 10, 165],
      [800, 165, 165],
      [1500, 165, 10],
      [1000, 10, 10],
    ]);
    const reps = events.filter((e) => e.type === 'rep');
    expect(reps).toHaveLength(1);
    expect(reps[0].type === 'rep' && reps[0].bestAccuracy).toBeGreaterThanOrEqual(95);
  });

  test('a touch of the range shorter than the minimum hold is not a rep', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    const { events } = play(c, [
      [3000, 10, 10],
      [1000, 10, 155],
      [1000, 155, 10],
    ]);
    expect(events.filter((e) => e.type === 'rep')).toHaveLength(0);
  });

  test('moving toward the range and back without reaching it is an incomplete attempt', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    const { events } = play(c, [
      [3000, 10, 10],
      [1200, 10, 120],
      [1200, 120, 10],
      [800, 10, 10],
    ]);
    const inc = events.filter((e) => e.type === 'incomplete');
    expect(inc).toHaveLength(1);
    expect(inc[0].type === 'incomplete' && inc[0].deficit).toBeCloseTo(30, 0);
    expect(events.some((e) => e.type === 'rep')).toBe(false);
  });

  test('attempts during the warm-up are ignored', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    const { events } = play(c, [
      [500, 10, 120],
      [500, 120, 10],
    ]);
    expect(events).toHaveLength(0);
  });

  test('both arms reaching together count once', () => {
    const c = new RepCounter([shoulder, shoulderR], REP_DEFAULTS);
    const { events } = play(
      c,
      [
        [3000, 10, 10],
        [1500, 10, 165],
        [800, 165, 165],
        [1500, 165, 10],
      ],
      ['left_shoulder', 'right_shoulder']
    );
    expect(events.filter((e) => e.type === 'rep')).toHaveLength(1);
  });

  test('movement phases: rest → moving → hold → returning → rest', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    const { phases } = play(c, [
      [3000, 10, 10],
      [1500, 10, 165],
      [800, 165, 165],
      [1500, 165, 10],
      [2000, 10, 10],
    ]);
    expect(phases).toEqual(['rest', 'moving', 'hold', 'returning', 'rest']);
  });

  test('ROM summary uses the side that moved most', () => {
    const c = new RepCounter([shoulder], REP_DEFAULTS);
    play(c, [
      [500, 10, 10],
      [1000, 10, 165],
      [1000, 165, 10],
    ]);
    const rom = c.romSummary();
    expect(rom.primaryJoint).toBe('left_shoulder');
    expect(rom.romMinAngle).toBeCloseTo(10, 0);
    expect(rom.romMaxAngle).toBeGreaterThan(160);
  });
});
