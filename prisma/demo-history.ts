/**
 * Synthetic training history for the demo seed (SIMULATED DATA, not patients).
 *
 * Generates past quests and sessions so the recovery forecast and trend
 * views have something to show in a fresh demo database. Pure and
 * deterministic (seeded PRNG): the same scenario always yields the same days,
 * so prisma/seed.ts and the verification script see identical data.
 *
 * Each day's best angle follows the scenario's "degrees short of the target
 * range" curve plus measurement noise of the size seen with markerless pose
 * estimation. Attempts that reach the range become reps; the others become
 * INCOMPLETE_ROM faults, matching what the live rep counter records.
 */
import { addDays, dayOfWeek } from '../src/lib/dates';

export const DEMO_NOTE = 'ข้อมูลจำลองสำหรับสาธิต (seed) — ไม่ใช่ข้อมูลผู้ป่วยจริง';

export interface DemoTarget {
  name: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
}

export interface DemoScenario {
  /** How many days before today the history starts */
  daysBack: number;
  /** Prescription days (0 = Sunday … 6 = Saturday); empty = every day */
  daysOfWeek: number[];
  /** Chance a due day is skipped (quest MISSED) */
  skipProb: number;
  /** Explicit practice days (days ago) instead of the schedule, e.g. a new patient */
  onlyDaysAgo?: number[];
  /** Resting angle of the measured joint */
  restAngle: number;
  /** True degrees short of the target range on day t (t = 0 at the first day) */
  deficit: (t: number) => number;
  /** SD of the day's best angle (degrees) */
  noise: number;
  attemptsPerSession: number;
  seed: number;
}

export interface DemoRep {
  bestAngle: number;
  accuracy: number;
}

export interface DemoFault {
  measuredAngle: number;
  deficit: number;
}

export interface DemoDay {
  day: string; // YYYY-MM-DD (clinic time zone)
  done: boolean;
  startedAt?: Date;
  romMinAngle?: number;
  romMaxAngle?: number;
  reps?: DemoRep[];
  incomplete?: DemoFault[];
}

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Same scoring as lib/angle-utils isAngleCorrect: 100 at ideal, 50 at the range edge */
function accuracy(angle: number, t: DemoTarget): number {
  const tol = (t.maxAngle - t.minAngle) / 2 || 1;
  return Math.max(0, Math.min(100, 100 - (Math.abs(angle - t.idealAngle) / tol) * 50));
}

export function generateDemoDays(s: DemoScenario, target: DemoTarget, today: string): DemoDay[] {
  const r = rng(s.seed);
  // Is the target range below the resting angle (e.g. knee flexion) or above it (shoulder flexion)?
  const below = s.restAngle > target.maxAngle;
  const days: DemoDay[] = [];

  for (let ago = s.daysBack; ago >= 1; ago--) {
    const day = addDays(today, -ago);
    const t = s.daysBack - ago;
    const scheduled = s.onlyDaysAgo ? s.onlyDaysAgo.includes(ago) : s.daysOfWeek.length === 0 || s.daysOfWeek.includes(dayOfWeek(day));
    if (!scheduled) continue;
    if (!s.onlyDaysAgo && r.next() < s.skipProb) {
      days.push({ day, done: false });
      continue;
    }

    // Best angle of the day = range edge + deficit, with measurement noise
    const short = Math.max(0, s.deficit(t));
    const best = below ? target.maxAngle + short + s.noise * r.gauss() : target.minAngle - short + s.noise * r.gauss();
    const reps: DemoRep[] = [];
    const incomplete: DemoFault[] = [];
    for (let k = 0; k < s.attemptsPerSession; k++) {
      // The first attempt is the day's best; the others fall a little short of it
      const peak = k === 0 ? best : below ? best + Math.abs(r.gauss()) * 4 : best - Math.abs(r.gauss()) * 4;
      const inOrPast = below ? peak <= target.maxAngle : peak >= target.minAngle;
      if (inOrPast) {
        const angle = round1(Math.min(target.maxAngle, Math.max(target.minAngle, peak)));
        reps.push({ bestAngle: angle, accuracy: round1(accuracy(angle, target)) });
      } else {
        incomplete.push({ measuredAngle: round1(peak), deficit: round1(below ? peak - target.maxAngle : target.minAngle - peak) });
      }
    }
    const rest = s.restAngle + r.gauss() * 2;
    const minute = 10 + Math.floor(r.next() * 40);
    days.push({
      day,
      done: true,
      startedAt: new Date(`${day}T09:${String(minute).padStart(2, '0')}:00+07:00`),
      romMinAngle: round1(Math.min(best, rest)),
      romMaxAngle: round1(Math.max(best, rest)),
      reps,
      incomplete,
    });
  }
  return days;
}

/**
 * The three demo patients, chosen to show each forecast outcome:
 *  - knee after surgery, steady saturating recovery → on track
 *  - shoulder improving, then no progress for the last ~2.5 weeks → plateau
 *  - new patient with two sessions → not enough data
 */
export const DEMO_SCENARIOS = {
  improving: {
    daysBack: 42,
    daysOfWeek: [],
    skipProb: 0.25,
    restAngle: 170,
    deficit: (t: number) => 55 * Math.exp(-t / 30),
    noise: 5,
    attemptsPerSession: 10,
    seed: 3,
  },
  plateau: {
    daysBack: 42,
    daysOfWeek: [1, 3, 5],
    skipProb: 0.1,
    restAngle: 15,
    deficit: (t: number) => (t < 24 ? 55 - 1.4 * t : 21.4),
    noise: 5,
    attemptsPerSession: 10,
    seed: 7,
  },
  newPatient: {
    daysBack: 3,
    daysOfWeek: [],
    skipProb: 0,
    onlyDaysAgo: [3, 1],
    restAngle: 170,
    deficit: () => 30,
    noise: 5,
    attemptsPerSession: 10,
    seed: 11,
  },
} satisfies Record<string, DemoScenario>;
