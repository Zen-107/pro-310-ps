import { describe, expect, test } from 'bun:test';
import { buildPopulationPrior, estimateRate, poolRates, populationEstimate, POPULATION, type RateEstimate } from '@/lib/population-model';
import { dailyDeficits, type SessionPoint } from '@/lib/recovery-forecast';
import { addDays, localDateString } from '@/lib/dates';
import { generateDemoDays, referenceScenario } from '../../prisma/demo-history';

const knee = { name: 'left_knee', minAngle: 90, maxAngle: 110, isPrimary: true };
const DAY0 = '2026-07-01';

/** Exact saturating recovery: deficit(t) = (d0 + 1)·e^(rate·t) − 1, plus optional noise */
function series(d0: number, rate: number, days: number[], noise: (i: number) => number = () => 0): SessionPoint[] {
  return days.map((t, i) => {
    const deficit = Math.max(0, (d0 + 1) * Math.exp(rate * t) - 1 + noise(i));
    return { day: addDays(DAY0, t), romMinAngle: 110 + deficit, romMaxAngle: 170, target: knee };
  });
}

/** Seeded normal noise */
function gaussian(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

const rates = (values: number[], variance = 1e-5): RateEstimate[] => values.map((rate) => ({ rate, variance, days: 10 }));

describe('estimateRate', () => {
  test('recovers the rate of a noise-free saturating curve', () => {
    const r = estimateRate(dailyDeficits(series(50, -0.04, [0, 3, 6, 9, 12, 15])));
    expect(r!.rate).toBeCloseTo(-0.04, 2);
  });

  test('ignores days after the target was first reached (the deficit floors at 0)', () => {
    const pts = dailyDeficits(series(40, -0.08, [0, 5, 10, 15, 20, 25, 30, 35, 40, 45]));
    const r = estimateRate(pts)!;
    expect(r.rate).toBeCloseTo(-0.08, 2);
    expect(r.days).toBeLessThan(pts.length);
  });

  test('needs two distinct days', () => {
    expect(estimateRate(dailyDeficits(series(40, -0.05, [0])))).toBeNull();
  });
});

describe('poolRates (random effects)', () => {
  test('needs the minimum number of reference patients', () => {
    expect(poolRates('ex', rates([-0.03, -0.04, -0.05, -0.04]))).toBeNull();
    expect(poolRates('ex', rates([-0.03, -0.04, -0.05, -0.04, -0.035]))).not.toBeNull();
  });

  test('identical patients → no between-patient spread', () => {
    const p = poolRates('ex', rates([-0.04, -0.04, -0.04, -0.04, -0.04]))!;
    expect(p.mu).toBeCloseTo(-0.04, 6);
    expect(p.tau).toBe(0);
    expect(p.typicalHalfLifeDays).toBe(17); // ln 2 / 0.04
  });

  test('spread larger than measurement noise is attributed to patients', () => {
    const p = poolRates('ex', rates([-0.02, -0.03, -0.04, -0.05, -0.06, -0.07]))!;
    expect(p.mu).toBeCloseTo(-0.045, 3);
    expect(p.tau).toBeGreaterThan(0.015);
  });
});

describe('populationEstimate (empirical Bayes)', () => {
  const prior = poolRates('ex', rates([-0.02, -0.03, -0.04, -0.05, -0.06, -0.035, -0.045]))!;

  test('two days: mostly the population, with an ETA range', () => {
    const pts = dailyDeficits(series(40, -0.1, [0, 2]));
    const e = populationEstimate(pts, pts[1].deficit, prior)!;
    expect(e.ownWeight).toBeLessThan(0.5);
    expect(e.etaDays).toHaveLength(3);
    const [lo, mid, hi] = e.etaDays!;
    expect(lo).toBeLessThanOrEqual(mid);
    expect(mid).toBeLessThanOrEqual(hi);
    expect(e.fasterThanPercent).toBeNull(); // not compared until their own trend dominates
  });

  test('long history: mostly the patient, compared with the reference patients', () => {
    const days = Array.from({ length: 20 }, (_, i) => i * 2);
    const slow = series(60, -0.01, days);
    const pts = dailyDeficits(slow);
    const e = populationEstimate(pts, pts[pts.length - 1].deficit, prior)!;
    expect(e.ownWeight).toBeGreaterThan(0.5);
    expect(e.rate).toBeGreaterThan(-0.02);
    expect(e.fasterThanPercent).toBe(0); // slower than every reference patient
    expect(e.slowResponder).toBe(true);
  });

  test('percentile ranks against the measured reference rates', () => {
    const days = Array.from({ length: 20 }, (_, i) => i * 2);
    const pts = dailyDeficits(series(60, -0.042, days));
    const e = populationEstimate(pts, pts[pts.length - 1].deficit, prior)!;
    // references: −0.02 −0.03 −0.035 −0.04 −0.045 −0.05 −0.06 → 4 of 7 are slower than ≈ −0.042
    expect(e.fasterThanPercent).toBe(57);
    expect(e.slowResponder).toBe(e.fasterThanPercent! < POPULATION.SLOW_PERCENTILE);
  });

  test('deterministic', () => {
    const pts = dailyDeficits(series(40, -0.05, [0, 2, 4]));
    expect(populationEstimate(pts, 30, prior)).toEqual(populationEstimate(pts, 30, prior));
  });

  test('simulated clinic: early estimates beat the patient-only trend', () => {
    // Reference cohort and new patients drawn from the same population
    // (rate ~ N(−0.035, 0.012²) per day, pose noise 5°), as in the README.
    const g = gaussian(42);
    const draw = () => Math.min(-0.005, -0.035 + 0.012 * g());
    const refs = Array.from({ length: 12 }, () => {
      const r = draw();
      return series(30 + 30 * Math.abs(g()), r, Array.from({ length: 25 }, (_, i) => i * 2), () => 5 * g());
    });
    const pop = buildPopulationPrior('ex', refs)!;
    expect(pop.k).toBe(12);

    const errPooled: number[] = [];
    const errOwn: number[] = [];
    let covered = 0;
    for (let i = 0; i < 80; i++) {
      const r = draw();
      const d0 = 30 + 20 * Math.abs(g());
      const pts = dailyDeficits(series(d0, r, [0, 2, 4], () => 5 * g()));
      const level = [...pts.map((p) => p.deficit)].sort((a, b) => a - b)[1];
      const lastX = pts[pts.length - 1].x;
      const truth = Math.max(0, Math.log(4 / (d0 + 1)) / r - lastX);
      const est = populationEstimate(pts, level, pop)!;
      errPooled.push(Math.abs(Math.log((est.etaDays![1] + 1) / (truth + 1))));
      if (truth >= est.etaDays![0] && truth <= est.etaDays![2]) covered++;
      const own = estimateRate(pts)!;
      const ownEta = own.rate < 0 ? Math.min(180, (Math.log(level + 1) - Math.log(4)) / -own.rate) : 180;
      errOwn.push(Math.abs(Math.log((ownEta + 1) / (truth + 1))));
    }
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
    expect(median(errPooled)).toBeLessThan(median(errOwn) * 0.7);
    expect(covered / 80).toBeGreaterThan(0.6);
  });
});

describe('reference cohort scenarios (prisma/demo-history.ts)', () => {
  test('deterministic, discharged in the past, and improving', () => {
    const today = localDateString();
    const t = { name: 'left_knee', idealAngle: 100, minAngle: 90, maxAngle: 110 };
    const s = referenceScenario('knee', 3);
    const days = generateDemoDays(s, t, today);
    expect(generateDemoDays(referenceScenario('knee', 3), t, today)).toEqual(days);
    expect(days.every((d) => d.day <= addDays(today, -(s.endDaysAgo ?? 1)))).toBe(true);
    const done = days.filter((d) => d.done);
    const r = estimateRate(dailyDeficits(done.map((d) => ({ day: d.day, romMinAngle: d.romMinAngle!, romMaxAngle: d.romMaxAngle!, target: t }))));
    expect(r!.rate).toBeLessThan(0);
  });
});
