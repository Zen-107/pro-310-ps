// Recovery forecast: per-patient, per-exercise estimate of when the primary
// joint will reach its target range, from that patient's own trend.
//
// Not a population model: there are no recovery outcome labels to train one,
// so the estimate extrapolates the patient's measured progress with an
// uncertainty range and only when the data clear minimum requirements.
//
//   deficit  = degrees still short of the target range on a given day
//              (best of the day; 0 = reached), from session ROM extremes
//   slope    = Theil–Sen (median of pairwise slopes): robust to odd sessions
//   interval = residual bootstrap of the fit → ETA percentiles (10/50/90)
//
// Statuses: goal_reached · on_track · plateau · declining · insufficient.
// Thresholds reflect markerless pose-estimation error (≈5–10° vs goniometer):
// changes below MDC_DEG are treated as indistinguishable from noise.

export const FORECAST = {
  MIN_DAYS: 6, // days with data
  MIN_SPAN_DAYS: 14, // first → last day
  MDC_DEG: 10, // minimal detectable change
  GOAL_TOL_DEG: 3, // within this of the range counts as reached
  PLATEAU_WINDOW_DAYS: 14,
  PLATEAU_MIN_POINTS: 4,
  MAX_ETA_DAYS: 180,
  BOOTSTRAP: 400,
  LOWER_Q: 0.1,
  UPPER_Q: 0.9,
};

export type ForecastStatus = 'goal_reached' | 'on_track' | 'plateau' | 'declining' | 'insufficient';

export interface RangeTarget {
  name: string;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
}

export interface SessionPoint {
  /** Calendar day (YYYY-MM-DD, clinic time zone) */
  day: string;
  romMinAngle: number | null;
  romMaxAngle: number | null;
  /** Target range of the measured joint for this session (from its snapshot) */
  target: RangeTarget | null;
}

export interface DailyDeficit {
  day: string;
  /** Days since the first point */
  x: number;
  deficit: number;
}

export interface RecoveryForecast {
  status: ForecastStatus;
  /** Data used */
  points: DailyDeficit[];
  daysWithData: number;
  spanDays: number;
  /** Current deficit: median of the last 3 days with data (degrees short of the target range) */
  currentDeficit: number | null;
  /** Degrees per week (negative = improving), with the 80% interval */
  slopePerWeek: number | null;
  slopeInterval: [number, number] | null;
  /** Days from the last session until the target range is reached: 10th / 50th / 90th percentile (null when not on track) */
  etaDays: [number, number, number] | null;
  /** ETA beyond MAX_ETA_DAYS for the upper bound */
  etaCapped: boolean;
  /** Fitted line for charts: deficit = intercept + slope·x */
  fit: { intercept: number; slopePerDay: number } | null;
  /** For 'insufficient': more practice days needed before an estimate */
  daysNeeded: number | null;
  /** Short machine-readable reasons (for UI text and the AI prompt) */
  reasons: string[];
}

// ─── Deficit ──────────────────────────────────────────────────────────

/** Degrees between a value and the range (0 inside) */
const distance = (v: number, t: RangeTarget) => (v < t.minAngle ? t.minAngle - v : v > t.maxAngle ? v - t.maxAngle : 0);

/**
 * Degrees still short of the target range in one session. The ROM extreme
 * farther from the range is the rest position; the other is the peak. A peak
 * that passes through the range (overshoot) counts as reached.
 */
export function sessionDeficit(romMin: number, romMax: number, t: RangeTarget): number {
  const [rest, peak] = distance(romMin, t) >= distance(romMax, t) ? [romMin, romMax] : [romMax, romMin];
  if (rest > t.maxAngle) return Math.max(0, peak - t.maxAngle); // range lies below rest (e.g. knee flexion)
  if (rest < t.minAngle) return Math.max(0, t.minAngle - peak); // range lies above rest (e.g. shoulder flexion)
  return 0;
}

const dayIndex = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/** Best (smallest) deficit per day, oldest first */
export function dailyDeficits(sessions: SessionPoint[]): DailyDeficit[] {
  const best = new Map<string, number>();
  for (const s of sessions) {
    if (s.romMinAngle === null || s.romMaxAngle === null || !s.target) continue;
    const d = sessionDeficit(s.romMinAngle, s.romMaxAngle, s.target);
    best.set(s.day, Math.min(best.get(s.day) ?? Infinity, d));
  }
  const days = [...best.keys()].sort();
  if (!days.length) return [];
  const x0 = dayIndex(days[0]);
  return days.map((day) => ({ day, x: dayIndex(day) - x0, deficit: round1(best.get(day)!) }));
}

// ─── Robust regression ────────────────────────────────────────────────

const round1 = (v: number) => Math.round(v * 10) / 10;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Theil–Sen line: median pairwise slope, median intercept */
export function theilSen(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  const slope = slopes.length ? median(slopes) : 0;
  const intercept = median(ys.map((y, i) => y - slope * xs[i]));
  return { slope, intercept };
}

/** Deterministic PRNG (mulberry32) so the same data always gives the same interval */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface BootstrapResult {
  slopes: number[]; // sorted
  etas: number[]; // sorted, Infinity when not improving
}

/**
 * Recovery shape used to extrapolate:
 *  - 'linear': the deficit keeps shrinking at the current rate (optimistic
 *    when recovery slows down, as it usually does);
 *  - 'saturating': the deficit shrinks by a constant fraction per day
 *    (exponential approach, fit on ln(deficit + LOG_OFFSET)) — conservative.
 */
export type RecoveryShape = 'linear' | 'saturating';
const LOG_OFFSET = 1; // degrees; keeps ln() finite at 0 (larger offsets bend the curve and make the estimate optimistic)

const toModel = (shape: RecoveryShape, y: number) => (shape === 'linear' ? y : Math.log(Math.max(0, y) + LOG_OFFSET));
const fromModel = (shape: RecoveryShape, z: number) => (shape === 'linear' ? z : Math.exp(z) - LOG_OFFSET);

/**
 * Residual bootstrap of the Theil–Sen fit in the chosen shape: slope (model
 * units per day) and days-from-last-point until the deficit is within
 * goalTol of the range.
 */
export function bootstrapFit(
  xs: number[],
  ys: number[],
  B = FORECAST.BOOTSTRAP,
  shape: RecoveryShape = 'linear',
  goalTol = FORECAST.GOAL_TOL_DEG
): BootstrapResult {
  const zs = ys.map((y) => toModel(shape, y));
  const { slope, intercept } = theilSen(xs, zs);
  const fitted = xs.map((x) => intercept + slope * x);
  const resid = zs.map((z, i) => z - fitted[i]);
  const xLast = xs[xs.length - 1];
  const zGoal = toModel(shape, goalTol);
  const rand = rng(xs.length * 7919 + Math.round(ys.reduce((a, b) => a + b, 0) * 10) + (shape === 'linear' ? 0 : 1));
  const slopes: number[] = [];
  const etas: number[] = [];
  for (let b = 0; b < B; b++) {
    const zb = fitted.map((f) => toModel(shape, fromModel(shape, f + resid[Math.floor(rand() * resid.length)])));
    const fb = theilSen(xs, zb);
    slopes.push(fb.slope);
    const now = fb.intercept + fb.slope * xLast;
    etas.push(now <= zGoal ? 0 : fb.slope < 0 ? (now - zGoal) / -fb.slope : Infinity);
  }
  return { slopes: slopes.sort((a, b) => a - b), etas: etas.sort((a, b) => a - b) };
}

// ─── Forecast ─────────────────────────────────────────────────────────

const empty = (points: DailyDeficit[], status: ForecastStatus, reasons: string[], extra: Partial<RecoveryForecast> = {}): RecoveryForecast => ({
  status,
  points,
  daysWithData: points.length,
  spanDays: points.length ? points[points.length - 1].x : 0,
  currentDeficit: points.length ? points[points.length - 1].deficit : null,
  slopePerWeek: null,
  slopeInterval: null,
  etaDays: null,
  etaCapped: false,
  fit: null,
  daysNeeded: null,
  reasons,
  ...extra,
});

export function forecastRecovery(sessions: SessionPoint[], opts = FORECAST): RecoveryForecast {
  const points = dailyDeficits(sessions);
  const n = points.length;
  const span = n ? points[n - 1].x : 0;

  // Reached: the last two days with data are at (or within tolerance of) the target range
  if (n >= 2 && points.slice(-2).every((p) => p.deficit <= opts.GOAL_TOL_DEG)) {
    return empty(points, 'goal_reached', ['reached_target_last_2_days'], { currentDeficit: points[n - 1].deficit });
  }

  if (n < opts.MIN_DAYS || span < opts.MIN_SPAN_DAYS) {
    const reasons: string[] = [];
    if (n < opts.MIN_DAYS) reasons.push(`need_${opts.MIN_DAYS}_days_have_${n}`);
    if (span < opts.MIN_SPAN_DAYS) reasons.push(`need_${opts.MIN_SPAN_DAYS}_day_span_have_${span}`);
    return empty(points, 'insufficient', reasons, {
      daysNeeded: Math.max(opts.MIN_DAYS - n, opts.MIN_SPAN_DAYS - span, 0),
    });
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.deficit);
  const { slope, intercept } = theilSen(xs, ys);
  const boot = bootstrapFit(xs, ys, opts.BOOTSTRAP);
  const lo = quantile(boot.slopes, opts.LOWER_Q);
  const hi = quantile(boot.slopes, opts.UPPER_Q);
  // Current level: median of the last 3 days (observed, robust). The end of a
  // straight-line fit undershoots when recovery is curving, so it is not used here.
  const current = median(ys.slice(-3));
  const base: Partial<RecoveryForecast> = {
    currentDeficit: round1(current),
    slopePerWeek: round1(slope * 7),
    slopeInterval: [round1(lo * 7), round1(hi * 7)],
    fit: { intercept: round1(intercept), slopePerDay: Math.round(slope * 1000) / 1000 },
  };

  // Getting worse: the whole interval says the deficit grows, by more than noise
  if (lo > 0 && slope * span >= opts.MDC_DEG) {
    return empty(points, 'declining', ['deficit_increasing'], base);
  }

  // Plateau: still short of the target, and even the most optimistic plausible
  // recent rate would improve less than the MDC over the window (equivalence-style test)
  const recent = points.filter((p) => p.x >= span - opts.PLATEAU_WINDOW_DAYS);
  const recentSlope = recent.length >= 2 ? theilSen(recent.map((p) => p.x), recent.map((p) => p.deficit)).slope : slope;
  if (recent.length >= opts.PLATEAU_MIN_POINTS && current > opts.GOAL_TOL_DEG) {
    const rb = bootstrapFit(recent.map((p) => p.x), recent.map((p) => p.deficit), opts.BOOTSTRAP);
    const bestPlausibleImprovement = -quantile(rb.slopes, opts.LOWER_Q) * opts.PLATEAU_WINDOW_DAYS;
    if (bestPlausibleImprovement < opts.MDC_DEG) {
      return empty(points, 'plateau', [`no_detectable_change_last_${opts.PLATEAU_WINDOW_DAYS}_days`], base);
    }
  }

  // On track: improving beyond noise over the whole period, and the recent
  // window still points the same way (a fresh stall is not "on track").
  // ETA range spans both recovery shapes: linear (optimistic) → saturating (conservative).
  const improvement = -slope * span;
  if (hi < 0 && improvement >= opts.MDC_DEG && -recentSlope * opts.PLATEAU_WINDOW_DAYS >= opts.MDC_DEG / 2) {
    const sat = bootstrapFit(xs, ys, opts.BOOTSTRAP, 'saturating', opts.GOAL_TOL_DEG);
    const lin = bootstrapFit(xs, ys, opts.BOOTSTRAP, 'linear', opts.GOAL_TOL_DEG);
    const cap = (v: number) => (Number.isFinite(v) ? Math.min(opts.MAX_ETA_DAYS, Math.round(v)) : opts.MAX_ETA_DAYS);
    const low = quantile(lin.etas, opts.LOWER_Q);
    const mid = Math.sqrt(Math.max(quantile(lin.etas, 0.5), 0.5) * Math.max(quantile(sat.etas, 0.5), 0.5)); // geometric mean of the two medians
    const high = quantile(sat.etas, opts.UPPER_Q);
    return empty(points, 'on_track', ['improving'], {
      ...base,
      etaDays: [cap(low), cap(Math.max(low, Math.min(mid, high))), cap(high)],
      etaCapped: !Number.isFinite(high) || high > opts.MAX_ETA_DAYS,
    });
  }

  return empty(points, 'insufficient', [improvement < opts.MDC_DEG ? 'change_below_mdc' : 'trend_uncertain'], base);
}
