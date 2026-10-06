import { describe, expect, test } from 'bun:test';
import { dailyDeficits, forecastRecovery, sessionDeficit, theilSen, type SessionPoint } from '@/lib/recovery-forecast';
import { DEMO_SCENARIOS, generateDemoDays } from '../../prisma/demo-history';
import { addDays, localDateString } from '@/lib/dates';

const knee = { name: 'left_knee', minAngle: 90, maxAngle: 110, idealAngle: 100, isPrimary: true }; // range below rest (170°)
const shoulder = { name: 'left_shoulder', minAngle: 160, maxAngle: 180, idealAngle: 180, isPrimary: true }; // range above rest (15°)
const DAY0 = '2026-09-01';

/** One session per listed day with the given knee deficit (best angle = 110 + deficit) */
const kneeSeries = (deficits: [number, number][]): SessionPoint[] =>
  deficits.map(([d, deficit]) => ({ day: addDays(DAY0, d), romMinAngle: 110 + deficit, romMaxAngle: 170, target: knee }));

describe('sessionDeficit', () => {
  test('target below the resting angle (knee flexion)', () => {
    expect(sessionDeficit(130, 170, knee)).toBe(20);
    expect(sessionDeficit(100, 170, knee)).toBe(0);
    expect(sessionDeficit(80, 170, knee)).toBe(0); // passed through the range
  });

  test('target above the resting angle (shoulder flexion)', () => {
    expect(sessionDeficit(15, 130, shoulder)).toBe(30);
    expect(sessionDeficit(15, 170, shoulder)).toBe(0);
  });
});

describe('dailyDeficits', () => {
  test('best session per day, oldest first, x in days', () => {
    const pts = dailyDeficits([
      { day: '2026-09-03', romMinAngle: 140, romMaxAngle: 170, target: knee },
      { day: '2026-09-01', romMinAngle: 150, romMaxAngle: 170, target: knee },
      { day: '2026-09-03', romMinAngle: 125, romMaxAngle: 170, target: knee },
      { day: '2026-09-02', romMinAngle: null, romMaxAngle: null, target: knee },
    ]);
    expect(pts).toEqual([
      { day: '2026-09-01', x: 0, deficit: 40 },
      { day: '2026-09-03', x: 2, deficit: 15 },
    ]);
  });
});

describe('theilSen', () => {
  test('exact on a line and robust to one outlier', () => {
    const xs = [0, 1, 2, 3, 4, 5, 6];
    expect(theilSen(xs, xs.map((x) => 50 - 2 * x)).slope).toBeCloseTo(-2, 10);
    const ys = xs.map((x) => 50 - 2 * x);
    ys[3] = 120; // one bad session
    expect(theilSen(xs, ys).slope).toBeCloseTo(-2, 1);
  });
});

describe('forecastRecovery', () => {
  test('too little data → insufficient, with days still needed', () => {
    const r = forecastRecovery(kneeSeries([[0, 40], [2, 38], [4, 35]]));
    expect(r.status).toBe('insufficient');
    expect(r.etaDays).toBeNull();
    expect(r.daysNeeded).toBe(10); // 14-day span − 4
  });

  test('steady improvement → on_track with an ETA range', () => {
    const r = forecastRecovery(kneeSeries(Array.from({ length: 15 }, (_, i) => [i * 2, 60 - i * 2] as [number, number])));
    expect(r.status).toBe('on_track');
    const [lo, mid, hi] = r.etaDays!;
    expect(lo).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(hi);
    // True linear ETA from the last day: deficit 32 at −1°/day → ~29–32 days to within 3°
    expect(lo).toBeLessThanOrEqual(32);
    expect(hi).toBeGreaterThanOrEqual(29);
  });

  test('improvement that stalls for two weeks → plateau', () => {
    const series = Array.from({ length: 18 }, (_, i) => [i * 2, i * 2 < 20 ? 50 - i * 2 : 30] as [number, number]);
    expect(forecastRecovery(kneeSeries(series)).status).toBe('plateau');
  });

  test('deficit growing beyond noise → declining', () => {
    const r = forecastRecovery(kneeSeries(Array.from({ length: 12 }, (_, i) => [i * 2, 10 + i * 1.5] as [number, number])));
    expect(r.status).toBe('declining');
  });

  test('last two days at the target → goal_reached', () => {
    expect(forecastRecovery(kneeSeries([[0, 30], [3, 15], [6, 2], [8, 0]])).status).toBe('goal_reached');
  });

  test('deterministic: the same data gives the same estimate', () => {
    const s = kneeSeries(Array.from({ length: 15 }, (_, i) => [i * 2, 60 - i * 2 + ((i * 7) % 5) - 2] as [number, number]));
    expect(forecastRecovery(s)).toEqual(forecastRecovery(s));
  });
});

describe('demo history (prisma/demo-history.ts)', () => {
  const today = localDateString();
  const cases = [
    ['improving', { name: 'left_knee', idealAngle: 100, minAngle: 90, maxAngle: 110 }, 'on_track'],
    ['plateau', { name: 'left_shoulder', idealAngle: 180, minAngle: 160, maxAngle: 180 }, 'plateau'],
    ['newPatient', { name: 'left_knee', idealAngle: 90, minAngle: 80, maxAngle: 100 }, 'insufficient'],
  ] as const;
  for (const [key, target, expected] of cases) {
    test(`${key} scenario produces "${expected}"`, () => {
      const days = generateDemoDays(DEMO_SCENARIOS[key], target, today).filter((d) => d.done);
      const r = forecastRecovery(days.map((d) => ({ day: d.day, romMinAngle: d.romMinAngle!, romMaxAngle: d.romMaxAngle!, target })));
      expect(r.status).toBe(expected);
    });
  }

  test('generation is deterministic and never includes today', () => {
    const t = { name: 'left_knee', idealAngle: 100, minAngle: 90, maxAngle: 110 };
    const a = generateDemoDays(DEMO_SCENARIOS.improving, t, today);
    expect(generateDemoDays(DEMO_SCENARIOS.improving, t, today)).toEqual(a);
    expect(a.every((d) => d.day < today)).toBe(true);
  });
});
