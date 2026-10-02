import { isAngleCorrect } from '@/lib/angle-utils';

// Rep counting for one session, independent of React/MediaPipe so it can be tested.
//
// A rep = the measurement enters [min, max], stays ≥ minHoldMs, then leaves the
// range by ≥ hysteresisDeg. It is scored on the best (closest-to-ideal) angle
// reached while in range. The primary target and its left/right counterpart are
// tracked independently, so exercising either side counts; when both sides
// finish within pairWindowMs (e.g. a squat) it is one rep.
//
// An incomplete attempt (ROM shortfall) = the measurement moves ≥ attemptMinDeg
// from its rest position toward the range, never enters it, and returns to rest.
// Reported with the closest angle reached and the degrees still missing.

export interface RepTarget {
  name: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
}

export interface RepCompletion {
  type: 'rep';
  target: RepTarget;
  enteredAt: number;
  durationMs: number;
  bestAccuracy: number;
  /** All measurements at the moment of best accuracy */
  bestAngles: Record<string, number>;
}

export interface IncompleteAttempt {
  type: 'incomplete';
  target: RepTarget;
  startedAt: number;
  endedAt: number;
  /** Closest angle to the target range reached during the attempt */
  peakAngle: number;
  /** Degrees between peakAngle and the nearest edge of the range */
  deficit: number;
}

export type RepEvent = RepCompletion | IncompleteAttempt;

interface TargetState {
  // rep
  inRange: boolean;
  enteredAt: number;
  bestAccuracy: number;
  bestAngles: Record<string, number>;
  // incomplete-attempt tracking
  firstSeenAt: number | null;
  restDistance: number | null;
  attempting: boolean;
  attemptStart: number;
  attemptBestDistance: number;
  attemptPeakAngle: number;
}

export const REP_DEFAULTS = {
  hysteresisDeg: 5,
  minHoldMs: 300,
  pairWindowMs: 800,
  attemptMinDeg: 10, // movement toward the range that counts as an attempt
  attemptReturnDeg: 5, // back within this of rest = attempt over
  attemptMinMs: 300, // shorter excursions are noise
  warmupMs: 2000, // ignore attempts while the patient gets into position
};

export type RepOptions = typeof REP_DEFAULTS;

/** Primary target plus its left/right counterpart, if the exercise has one */
export function getRepTargets<T extends RepTarget>(targets: T[]): T[] {
  const primary = targets.find((t) => t.isPrimary) ?? targets[0];
  if (!primary) return [];
  const mirror = primary.name.startsWith('left_')
    ? primary.name.replace(/^left_/, 'right_')
    : primary.name.startsWith('right_')
      ? primary.name.replace(/^right_/, 'left_')
      : null;
  const counterpart = mirror ? targets.find((t) => t.name === mirror) : undefined;
  return counterpart ? [primary, counterpart] : [primary];
}

const distanceToRange = (angle: number, t: RepTarget) =>
  angle >= t.minAngle && angle <= t.maxAngle ? 0 : Math.min(Math.abs(angle - t.minAngle), Math.abs(angle - t.maxAngle));

export class RepCounter {
  private readonly repTargets: RepTarget[];
  private states: Record<string, TargetState> = {};
  private lastRepAt = -Infinity;
  private lastIncompleteAt = -Infinity;
  /** Min/max angle per tracked target over all frames it was visible */
  readonly rom: Record<string, { min: number; max: number }> = {};

  constructor(targets: RepTarget[], private readonly opts: RepOptions = REP_DEFAULTS) {
    this.repTargets = getRepTargets(targets);
  }

  private state(name: string): TargetState {
    return (this.states[name] ??= {
      inRange: false,
      enteredAt: 0,
      bestAccuracy: -1,
      bestAngles: {},
      firstSeenAt: null,
      restDistance: null,
      attempting: false,
      attemptStart: 0,
      attemptBestDistance: Infinity,
      attemptPeakAngle: 0,
    });
  }

  /** Feed one frame of measurements; returns completed reps / incomplete attempts. */
  update(angles: Record<string, number>, now: number): RepEvent[] {
    const events: RepEvent[] = [];
    const o = this.opts;

    for (const target of this.repTargets) {
      const angle = angles[target.name];
      if (angle === undefined) continue;
      const st = this.state(target.name);
      st.firstSeenAt ??= now;

      const rom = (this.rom[target.name] ??= { min: Infinity, max: -Infinity });
      rom.min = Math.min(rom.min, angle);
      rom.max = Math.max(rom.max, angle);

      const inRange = angle >= target.minAngle && angle <= target.maxAngle;
      const distance = distanceToRange(angle, target);

      // ── Rep state machine ──────────────────────────────────────
      if (!st.inRange && inRange) {
        st.inRange = true;
        st.enteredAt = now;
        st.bestAccuracy = -1;
        st.bestAngles = {};
        st.attempting = false; // reached the range: this is a rep, not a shortfall
      }

      if (st.inRange && inRange) {
        const { percentAccuracy } = isAngleCorrect(angle, target.idealAngle, target.minAngle, target.maxAngle);
        if (percentAccuracy > st.bestAccuracy) {
          st.bestAccuracy = percentAccuracy;
          st.bestAngles = { ...angles };
        }
        continue;
      }

      if (st.inRange) {
        // Out of range but still within the hysteresis band → wait
        if (distance < o.hysteresisDeg) continue;
        st.inRange = false;
        st.restDistance = distance; // re-baseline rest as the limb returns
        if (now - st.enteredAt >= o.minHoldMs && now - this.lastRepAt >= o.pairWindowMs) {
          this.lastRepAt = now;
          events.push({
            type: 'rep',
            target,
            enteredAt: st.enteredAt,
            durationMs: now - st.enteredAt,
            bestAccuracy: st.bestAccuracy,
            bestAngles: st.bestAngles,
          });
        }
        continue;
      }

      // ── Incomplete-attempt tracking (outside the range) ─────────
      if (!st.attempting) {
        if (st.restDistance === null || distance > st.restDistance) {
          st.restDistance = distance; // moved further away: new rest position
        } else if (st.restDistance - distance >= o.attemptMinDeg) {
          st.attempting = true;
          st.attemptStart = now;
          st.attemptBestDistance = distance;
          st.attemptPeakAngle = angle;
        } else {
          st.restDistance += 0.05 * (distance - st.restDistance); // slow drift
        }
        continue;
      }

      if (distance < st.attemptBestDistance) {
        st.attemptBestDistance = distance;
        st.attemptPeakAngle = angle;
      }
      if (st.restDistance! - distance <= o.attemptReturnDeg) {
        // Back at rest without reaching the range
        st.attempting = false;
        const longEnough = now - st.attemptStart >= o.attemptMinMs;
        const warmedUp = now - st.firstSeenAt >= o.warmupMs;
        if (longEnough && warmedUp && now - this.lastIncompleteAt >= o.pairWindowMs) {
          this.lastIncompleteAt = now;
          events.push({
            type: 'incomplete',
            target,
            startedAt: st.attemptStart,
            endedAt: now,
            peakAngle: Math.round(st.attemptPeakAngle * 10) / 10,
            deficit: Math.round(st.attemptBestDistance * 10) / 10,
          });
        }
        st.restDistance = distance;
      }
    }
    return events;
  }

  /** ROM of the side that moved the most */
  romSummary(): { primaryJoint: string | null; romMinAngle: number | null; romMaxAngle: number | null } {
    let primaryJoint: string | null = null;
    let best = { min: 0, max: 0 };
    for (const [joint, r] of Object.entries(this.rom)) {
      if (r.max >= r.min && (primaryJoint === null || r.max - r.min > best.max - best.min)) {
        primaryJoint = joint;
        best = r;
      }
    }
    const round1 = (v: number) => Math.round(v * 10) / 10;
    return {
      primaryJoint,
      romMinAngle: primaryJoint ? round1(best.min) : null,
      romMaxAngle: primaryJoint ? round1(best.max) : null,
    };
  }
}
