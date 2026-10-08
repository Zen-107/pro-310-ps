// Simulation study of the recovery forecasts: `bun run eval:forecast`
//
// No real patient outcomes exist yet, so the methods are evaluated on
// synthetic clinics where the true recovery curve of every patient is known.
// Results are reported in docs/PREDICTIVE-ANALYTICS.md; this script
// reproduces them exactly (fixed seeds).
//
// Data-generating model (assumptions, not facts about real patients):
//   deficit(t) + 1 = (D0 + 1) · exp(r · t)       D0 ~ U(20°, 60°)
//   r ~ Normal(μ, τ²) per patient, capped at −0.003/day (everyone improves a little)
//   Scenario E breaks the model's assumption on purpose: recovery is a straight
//   line, deficit(t) = D0 − b·t with b ~ Normal(0.8, 0.3)°/day (≥ 0.15).
//   practice on a given day with probability 0.7; best angle of the day has
//   Normal(0, 5°) error (markerless pose estimation), deficit floored at 0
//
// Compared, for a new patient after n practice days:
//   pooled   — population model (lib/population-model.ts), prior from a
//              reference cohort of k simulated patients with 70 days each
//   own-only — the patient's own rate extrapolated (same shape, no prior)
//   individual forecast — lib/recovery-forecast.ts (needs ≥ 6 days over ≥ 14)
//
// Metrics:
//   error    = |ln((ETA_est + 1) / (ETA_true + 1))|, reported as the median
//              relative error e^m − 1 (0.30 → typically off by ×1.30 or ÷1.30)
//   coverage = share of patients whose true ETA lies inside the 80% interval,
//              with a 95% Wilson confidence interval (nominal target 80%)

import { buildPopulationPrior, estimateRate, populationEstimate } from '../src/lib/population-model';
import { dailyDeficits, forecastRecovery, type SessionPoint } from '../src/lib/recovery-forecast';

interface Scenario {
  id: string;
  label: string;
  mu: number;
  tau: number;
  k: number;
  /** True curve: 'saturating' (the model's assumption) or 'linear' (misspecified) */
  shape?: 'saturating' | 'linear';
}

const SCENARIOS: Scenario[] = [
  { id: 'A', label: 'typical clinic', mu: -0.035, tau: 0.012, k: 12 },
  { id: 'B', label: 'small, heterogeneous', mu: -0.05, tau: 0.02, k: 6 },
  { id: 'C', label: 'large, homogeneous', mu: -0.02, tau: 0.005, k: 20 },
  { id: 'D', label: 'minimum reference size', mu: -0.03, tau: 0.01, k: 5 },
  { id: 'E', label: 'linear recovery — model assumption violated', mu: 0, tau: 0, k: 12, shape: 'linear' },
];
const DAYS = [2, 3, 4, 6, 10, 20];
const CLINICS = 5; // independent reference cohorts per scenario
const PATIENTS = 100; // new patients per clinic
const NOISE = 5;
const knee = { name: 'left_knee', minAngle: 90, maxAngle: 110, isPrimary: true };

function makeRng(seed: number) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(uniform() + 1e-12)) * Math.cos(2 * Math.PI * uniform());
  return { uniform, gauss };
}

const day = (d: number) => new Date(Date.UTC(2026, 0, 1) + d * 86_400_000).toISOString().slice(0, 10);

function simulatePatient(s: Scenario, rng: ReturnType<typeof makeRng>, days = 70) {
  if (s.shape === 'linear') return simulateLinear(rng, days);
  const r = Math.min(-0.003, s.mu + s.tau * rng.gauss());
  const d0 = 20 + rng.uniform() * 40;
  const sessions: SessionPoint[] = [];
  for (let t = 0; t < days; t++) {
    if (t > 0 && rng.uniform() > 0.7) continue;
    const deficit = Math.max(0, (d0 + 1) * Math.exp(r * t) - 1 + NOISE * rng.gauss());
    sessions.push({ day: day(t), romMinAngle: 110 + deficit, romMaxAngle: 170, target: knee });
  }
  const trueEta = (t: number) => Math.max(0, Math.log(4 / (d0 + 1)) / r - t); // to within 3° of the range
  return { sessions, trueEta };
}

function simulateLinear(rng: ReturnType<typeof makeRng>, days: number) {
  const b = Math.max(0.15, 0.8 + 0.3 * rng.gauss());
  const d0 = 20 + rng.uniform() * 40;
  const sessions: SessionPoint[] = [];
  for (let t = 0; t < days; t++) {
    if (t > 0 && rng.uniform() > 0.7) continue;
    const deficit = Math.max(0, d0 - b * t + NOISE * rng.gauss());
    sessions.push({ day: day(t), romMinAngle: 110 + deficit, romMaxAngle: 170, target: knee });
  }
  return { sessions, trueEta: (t: number) => Math.max(0, (d0 - 3) / b - t) };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : NaN;
};
const pct = (v: number) => `${Math.round(v * 100)}%`;
const relErr = (m: number) => (Number.isFinite(m) ? pct(Math.exp(m) - 1) : '—');

function wilson(hits: number, n: number): [number, number] {
  if (!n) return [NaN, NaN];
  const z = 1.96;
  const p = hits / n;
  const centre = (p + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
  return [centre - half, centre + half];
}

const logErr = (est: number, truth: number) => Math.abs(Math.log((Math.min(est, 180) + 1) / (truth + 1)));

console.log('# Recovery forecast — simulation study\n');
console.log(`${CLINICS} clinics × ${PATIENTS} new patients per scenario; error = median relative ETA error; coverage = true ETA inside the 80% interval (95% CI).\n`);

for (const s of SCENARIOS) {
  const params = s.shape === 'linear' ? `k = ${s.k} reference patients` : `μ = ${s.mu}/day, τ = ${s.tau}, k = ${s.k} reference patients`;
  console.log(`## Scenario ${s.id}: ${s.label} (${params})\n`);
  console.log('| practice days | pooled error | own-only error | pooled coverage (95% CI) | individual forecast available | individual error | individual coverage |');
  console.log('|---|---|---|---|---|---|---|');
  const rows = DAYS.map(() => ({ pooled: [] as number[], own: [] as number[], covered: 0, n: 0, ind: [] as number[], indCovered: 0 }));

  for (let c = 0; c < CLINICS; c++) {
    const rng = makeRng(1000 * (s.id.charCodeAt(0) - 64) + c);
    const prior = buildPopulationPrior('ex', Array.from({ length: s.k }, () => simulatePatient(s, rng).sessions));
    if (!prior) throw new Error('reference cohort too small');
    for (let i = 0; i < PATIENTS; i++) {
      const p = simulatePatient(s, rng);
      DAYS.forEach((n, di) => {
        const sess = p.sessions.slice(0, n);
        const pts = dailyDeficits(sess);
        if (pts.length < n) return;
        const last = pts[pts.length - 1];
        const truth = p.trueEta(last.x);
        if (last.deficit <= 3 || truth < 1) return; // already at target: nothing to forecast
        const level = median(pts.slice(-3).map((x) => x.deficit));
        const est = populationEstimate(pts, level, prior);
        if (!est?.etaDays) return;
        const row = rows[di];
        row.n++;
        row.pooled.push(logErr(est.etaDays[1], truth));
        if (truth >= est.etaDays[0] && truth <= est.etaDays[2]) row.covered++;
        const own = estimateRate(pts);
        row.own.push(own && own.rate < 0 ? logErr((Math.log(level + 1) - Math.log(4)) / -own.rate, truth) : logErr(180, truth));
        const ind = forecastRecovery(sess);
        if (ind.etaDays) {
          row.ind.push(logErr(ind.etaDays[1], truth));
          if (truth >= ind.etaDays[0] && truth <= ind.etaDays[2]) row.indCovered++;
        }
      });
    }
  }

  DAYS.forEach((n, di) => {
    const r = rows[di];
    const [lo, hi] = wilson(r.covered, r.n);
    const [ilo, ihi] = wilson(r.indCovered, r.ind.length);
    console.log(
      `| ${n} | ${relErr(median(r.pooled))} | ${relErr(median(r.own))} | ${pct(r.covered / r.n)} (${pct(lo)}–${pct(hi)}) | ${r.ind.length}/${r.n} | ${relErr(median(r.ind))} | ${r.ind.length ? `${pct(r.indCovered / r.ind.length)} (${pct(ilo)}–${pct(ihi)})` : '—'} |`
    );
  });
  console.log('');
}
