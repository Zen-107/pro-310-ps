import { isAngleCorrect } from '@/lib/angle-utils';

// Rep counting for one session, independent of React/MediaPipe so it can be tested.
//
// A rep = the measurement enters [min, max], stays ≥ minHoldMs, then leaves the
// range by ≥ hysteresisDeg. It is scored on the best (closest-to-ideal) angle
// reached while in range. The primary target and its left/right counterpart are
// tracked independently, so exercising either side counts; when both sides
// finish within pairWindowMs (e.g. a squat) it is one rep.

export interface RepTarget {
  name: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
}

export interface RepCompletion {
  target: RepTarget;
  enteredAt: number;
  durationMs: number;
  bestAccuracy: number;
  /** All measurements at the moment of best accuracy */
  bestAngles: Record<string, number>;
}

interface RepState {
  inRange: boolean;
  enteredAt: number;
  bestAccuracy: number;
  bestAngles: Record<string, number>;
}

export const REP_DEFAULTS = { hysteresisDeg: 5, minHoldMs: 300, pairWindowMs: 800 };

const IDLE: RepState = { inRange: false, enteredAt: 0, bestAccuracy: -1, bestAngles: {} };

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

export class RepCounter {
  private readonly repTargets: RepTarget[];
  private states: Record<string, RepState> = {};
  private lastRepAt = -Infinity;
  /** Min/max angle per tracked target over all frames it was visible */
  readonly rom: Record<string, { min: number; max: number }> = {};

  constructor(targets: RepTarget[], private readonly opts = REP_DEFAULTS) {
    this.repTargets = getRepTargets(targets);
  }

  /** Feed one frame of measurements; returns a completed rep, if any. */
  update(angles: Record<string, number>, now: number): RepCompletion | null {
    let completion: RepCompletion | null = null;

    for (const target of this.repTargets) {
      const angle = angles[target.name];
      if (angle === undefined) continue;

      const rom = (this.rom[target.name] ??= { min: Infinity, max: -Infinity });
      rom.min = Math.min(rom.min, angle);
      rom.max = Math.max(rom.max, angle);

      const inRange = angle >= target.minAngle && angle <= target.maxAngle;
      let state = this.states[target.name] ?? IDLE;
      if (!state.inRange && inRange) {
        state = { inRange: true, enteredAt: now, bestAccuracy: -1, bestAngles: {} };
        this.states[target.name] = state;
      }

      if (state.inRange && inRange) {
        const { percentAccuracy } = isAngleCorrect(angle, target.idealAngle, target.minAngle, target.maxAngle);
        if (percentAccuracy > state.bestAccuracy) {
          state.bestAccuracy = percentAccuracy;
          state.bestAngles = { ...angles };
        }
      } else if (
        state.inRange &&
        (angle < target.minAngle - this.opts.hysteresisDeg || angle > target.maxAngle + this.opts.hysteresisDeg)
      ) {
        this.states[target.name] = IDLE;
        const held = now - state.enteredAt >= this.opts.minHoldMs;
        if (held && now - this.lastRepAt >= this.opts.pairWindowMs && !completion) {
          this.lastRepAt = now;
          completion = {
            target,
            enteredAt: state.enteredAt,
            durationMs: now - state.enteredAt,
            bestAccuracy: state.bestAccuracy,
            bestAngles: state.bestAngles,
          };
        }
      }
    }
    return completion;
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
