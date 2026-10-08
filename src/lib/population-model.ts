// Population recovery model: what recovery usually looks like for one
// exercise across a clinic's patients, and how that sharpens one patient's
// forecast when their own history is still short.
//
// Model (two-level / random-effects, fit by method of moments):
//   deficit_i(t) + 1 = (D_i + 1) · exp(r_i · t)      saturating recovery
//   r_i ~ Normal(μ, τ²)                               patient rates vary around the clinic mean
//
//   1. For every reference patient (≥ REF_MIN_DAYS over ≥ REF_MIN_SPAN days),
//      r̂_i = Theil–Sen slope of ln(deficit + 1), with its sampling variance v_i.
//   2. μ = mean of the r̂_i, τ² = their variance minus the mean sampling
//      variance (unweighted method of moments). Inverse-variance weighting
//      (DerSimonian–Laird) is NOT used: fast recoverers reach the target
//      sooner, so their rates rest on fewer days and noisier ln-deficits;
//      weighting by precision would pull μ toward slow patients (in simulation
//      it biased μ by ~15% and halved τ, so early ETAs were too pessimistic).
//   3. One patient: empirical-Bayes posterior of r combines their own r̂ (if
//      any) with the prior N(μ, s² + se(μ)²), s = SD of the measured reference
//      rates (wider than τ: see populationEstimate). Few days → close to the
//      population; many days → close to their own trend.
//   4. "Faster than X% of reference patients": the share of measured reference
//      rates slower than the patient's (empirical, no normality assumption).
//
// No outcome labels are needed: the reference rates are measured ROM progress,
// not "recovered / not recovered". It answers "how fast does this patient's
// joint usually get to target?", not "will they get re-injured?".

import { FORECAST, dailyDeficits, theilSen, type DailyDeficit, type SessionPoint } from '@/lib/recovery-forecast';

export const POPULATION = {
  /** Reference patients needed before the population is used */
  MIN_REFERENCE_PATIENTS: 5,
  REF_MIN_DAYS: 4,
  REF_MIN_SPAN_DAYS: 7,
  /** Early estimate for a patient: days with data needed (fewer than the individual forecast) */
  EARLY_MIN_DAYS: 2,
  /** Day-to-day SD of the best angle from markerless pose estimation (degrees) */
  NOISE_DEG: 5,
  /** Theil–Sen is ~91% as efficient as least squares under normal noise */
  THEIL_SEN_EFFICIENCY: 0.91,
  Z80: 1.2816,
  /** Monte Carlo draws for the ETA interval (rate and current level both uncertain) */
  ETA_DRAWS: 2000,
  /** Slower than this share of the reference patients → "slow responder" */
  SLOW_PERCENTILE: 20,
};

const LOG_OFFSET = 1; // same offset as recovery-forecast's saturating shape
const toZ = (deficit: number) => Math.log(Math.max(0, deficit) + LOG_OFFSET);

export interface RateEstimate {
  /** ln-deficit change per day (negative = improving) */
  rate: number;
  variance: number;
  days: number;
}

/**
 * Recovery rate from one patient's daily deficits. Points after the target was
 * first reached are dropped (the deficit floors at 0, which would flatten the
 * slope). Variance = least-squares slope variance, with residual noise floored
 * at the pose-estimation noise, inflated for Theil–Sen's efficiency.
 */
export function estimateRate(points: DailyDeficit[], goalTol = FORECAST.GOAL_TOL_DEG): RateEstimate | null {
  const firstGoal = points.findIndex((p) => p.deficit <= goalTol);
  const pts = firstGoal >= 0 ? points.slice(0, firstGoal + 1) : points;
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => toZ(p.deficit));
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sxx = xs.reduce((a, x) => a + (x - xMean) ** 2, 0);
  if (sxx === 0) return null;

  const { slope, intercept } = theilSen(xs, zs);
  const resid = zs.map((z, i) => z - (intercept + slope * xs[i]));
  const residVar = pts.length > 2 ? resid.reduce((a, r) => a + r * r, 0) / (pts.length - 2) : 0;
  // Pose noise in degrees → ln scale at the patient's typical deficit
  const typical = [...pts.map((p) => p.deficit)].sort((a, b) => a - b)[pts.length >> 1];
  const noiseVar = (POPULATION.NOISE_DEG / (typical + LOG_OFFSET)) ** 2;
  const variance = Math.max(residVar, noiseVar) / sxx / POPULATION.THEIL_SEN_EFFICIENCY;
  return { rate: slope, variance, days: pts.length };
}

export interface PopulationPrior {
  exerciseId: string;
  /** Reference patients used */
  k: number;
  /** Mean ln-deficit rate per day, its standard error, and between-patient SD */
  mu: number;
  seMu: number;
  tau: number;
  /** SD of the rates as measured (patient spread + measurement noise): the prior width for a new patient */
  observedSd: number;
  /** Reference rates, sorted (aggregate numbers only, no identities) */
  referenceRates: number[];
  /** Days for the typical patient to halve their deficit (ln 2 / −μ); null when not improving */
  typicalHalfLifeDays: number | null;
}

/** Random-effects pooling of per-patient rates (unweighted method of moments) */
export function poolRates(exerciseId: string, rates: RateEstimate[]): PopulationPrior | null {
  const k = rates.length;
  if (k < POPULATION.MIN_REFERENCE_PATIENTS) return null;
  const mu = rates.reduce((a, r) => a + r.rate, 0) / k;
  const observedVar = rates.reduce((a, r) => a + (r.rate - mu) ** 2, 0) / (k - 1);
  const meanSamplingVar = rates.reduce((a, r) => a + r.variance, 0) / k;
  const tau2 = Math.max(0, observedVar - meanSamplingVar);
  return {
    exerciseId,
    k,
    mu,
    seMu: Math.sqrt(observedVar / k),
    observedSd: Math.sqrt(observedVar),
    tau: Math.sqrt(tau2),
    referenceRates: rates.map((r) => r.rate).sort((a, b) => a - b),
    typicalHalfLifeDays: mu < 0 ? Math.round(Math.LN2 / -mu) : null,
  };
}

/** Reference sessions grouped by patient (one exercise) → population prior */
export function buildPopulationPrior(exerciseId: string, sessionsByPatient: SessionPoint[][]): PopulationPrior | null {
  const rates: RateEstimate[] = [];
  for (const sessions of sessionsByPatient) {
    const pts = dailyDeficits(sessions);
    if (pts.length < POPULATION.REF_MIN_DAYS || pts[pts.length - 1].x < POPULATION.REF_MIN_SPAN_DAYS) continue;
    const r = estimateRate(pts);
    if (r) rates.push(r);
  }
  return poolRates(exerciseId, rates);
}

// ─── One patient ──────────────────────────────────────────────────────

export interface PopulationEstimate {
  /** Reference patients behind the prior */
  k: number;
  /** How much the patient's own data counts (0 = population only, 1 = own trend only) */
  ownWeight: number;
  /** Posterior rate (ln-deficit per day) and its 80% interval */
  rate: number;
  rateInterval: [number, number];
  /** Days from the last session to within GOAL_TOL of the range: fast / typical / slow (null when not expected to improve) */
  etaDays: [number, number, number] | null;
  etaCapped: boolean;
  /** Share (%) of reference patients recovering more slowly; null until the patient's own trend carries ≥ 50% weight */
  fasterThanPercent: number | null;
  slowResponder: boolean;
  typicalHalfLifeDays: number | null;
}

/**
 * Empirical-Bayes estimate for one patient. `points` are their daily
 * deficits; `currentDeficit` is the robust current level (median of the last
 * days, as in the individual forecast).
 */
export function populationEstimate(
  points: DailyDeficit[],
  currentDeficit: number,
  prior: PopulationPrior,
  opts = { goalTol: FORECAST.GOAL_TOL_DEG, maxEta: FORECAST.MAX_ETA_DAYS }
): PopulationEstimate | null {
  if (points.length < POPULATION.EARLY_MIN_DAYS) return null;
  // Prior width: the spread of the reference rates as measured, not the noise-corrected τ.
  // τ² subtracts the estimated measurement noise and collapses to 0 when that estimate
  // runs high, which made 80% intervals cover only ~30% of cases in simulation.
  const priorVar = prior.observedSd ** 2 + prior.seMu ** 2;
  const own = estimateRate(points, opts.goalTol);

  let rate = prior.mu;
  let variance = priorVar;
  let ownWeight = 0;
  if (own) {
    const pOwn = 1 / own.variance;
    const pPrior = 1 / priorVar;
    variance = 1 / (pOwn + pPrior);
    rate = variance * (own.rate * pOwn + prior.mu * pPrior);
    ownWeight = pOwn / (pOwn + pPrior);
  }
  const sd = Math.sqrt(variance);
  const fast = rate - POPULATION.Z80 * sd;
  const slow = rate + POPULATION.Z80 * sd;

  // ETA interval: the rate AND the current level are uncertain (the level is a
  // median of up to 3 noisy days), so draw both. Deterministic seed.
  const zNow = toZ(currentDeficit);
  const zGoal = toZ(opts.goalTol);
  const levelDays = Math.min(3, points.length);
  const zSd = (POPULATION.NOISE_DEG / (currentDeficit + LOG_OFFSET)) * Math.sqrt(Math.PI / 2 / levelDays);
  const eta = (z: number, r: number) => (z <= zGoal ? 0 : r < 0 ? (z - zGoal) / -r : Infinity);
  const rand = gaussian(points.length * 7919 + Math.round(currentDeficit * 10));
  const draws: number[] = [];
  for (let i = 0; i < POPULATION.ETA_DRAWS; i++) draws.push(eta(zNow + zSd * rand(), rate + sd * rand()));
  draws.sort((a, b) => a - b);
  const q = (p: number) => draws[Math.min(draws.length - 1, Math.floor(p * draws.length))];
  const cap = (v: number) => (Number.isFinite(v) ? Math.min(opts.maxEta, Math.round(v)) : opts.maxEta);
  const etaFast = q(0.1);
  const etaMid = eta(zNow, rate);
  const etaSlow = q(0.9);

  // Compare with the reference patients only once the patient's own trend carries real weight
  const fasterThanPercent =
    ownWeight >= 0.5 ? Math.round((prior.referenceRates.filter((r) => r > rate).length / prior.referenceRates.length) * 100) : null;

  return {
    k: prior.k,
    ownWeight: Math.round(ownWeight * 100) / 100,
    rate: round4(rate),
    rateInterval: [round4(fast), round4(slow)],
    etaDays: rate < 0 ? [cap(Math.min(etaFast, etaMid)), cap(etaMid), cap(Math.max(etaSlow, etaMid))] : null,
    etaCapped: rate < 0 && (!Number.isFinite(etaSlow) || etaSlow > opts.maxEta),
    fasterThanPercent,
    slowResponder: fasterThanPercent !== null && fasterThanPercent < POPULATION.SLOW_PERCENTILE,
    typicalHalfLifeDays: prior.typicalHalfLifeDays,
  };
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** Seeded standard-normal generator (mulberry32 + Box–Muller) */
function gaussian(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform() + 1e-12)) * Math.cos(2 * Math.PI * uniform());
}
