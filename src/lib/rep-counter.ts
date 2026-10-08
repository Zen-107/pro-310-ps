import { isAngleCorrect } from '@/lib/angle-utils';
import type { PostureGate } from '@/lib/exercises-data';

// Rep counting for one session, independent of React/MediaPipe so it can be tested.
//
// A rep = the measurement enters [min, max], stays ≥ minHoldMs, then leaves the
// range by ≥ hysteresisDeg. It is scored on the best (closest-to-ideal) angle
// reached while in range. The primary target and its left/right counterpart are
// tracked independently, so exercising either side counts; when both sides
// finish within pairWindowMs (e.g. a squat) it is one rep.
//
// Hold exercises (holdMs > 0, e.g. a 10 s stretch): the rep counts as soon as
// the range has been held for holdMs; leaving earlier is a 'short_hold'.
// Isometric holds (static quads) barely move the joint, so after a counted
// hold and relaxMs the next hold starts in place, without leaving the range.
//
// An incomplete attempt (ROM shortfall) = the measurement moves ≥ attemptMinDeg
// from its rest position toward the range, never enters it, and returns to rest.
// Reported with the closest angle reached and the degrees still missing.
//
// Movement phase (motion()): 'hold' while in range, 'moving' while heading
// toward the range from rest, 'returning' while moving away from it (after a
// rep or a short attempt), 'rest' otherwise. Live feedback uses it so that
// posture cues are only given during the movement, never on the way back.

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

/** Hold exercises: the range was reached but left before the required hold time */
export interface ShortHold {
  type: 'short_hold';
  target: RepTarget;
  heldMs: number;
}

export type RepEvent = RepCompletion | IncompleteAttempt | ShortHold;

/** Progress of the current hold (hold exercises only) */
export interface HoldStatus {
  target: RepTarget;
  heldMs: number;
  holdMs: number;
  /** The hold was counted; isometric exercises now relax before the next hold */
  done: boolean;
}

export type MovementPhase = 'rest' | 'moving' | 'hold' | 'returning';

export interface MotionState {
  phase: MovementPhase;
  /** Target whose state set the phase (gives the side for form checks) */
  target: RepTarget | null;
  /** When the current phase started (ms) */
  since: number;
}

interface TargetState {
  // rep
  inRange: boolean;
  enteredAt: number;
  holdCredited: boolean; // hold exercises: this hold already produced its rep
  creditedAt: number;
  bestAccuracy: number;
  bestAngles: Record<string, number>;
  // incomplete-attempt tracking
  firstSeenAt: number | null;
  restDistance: number | null;
  attempting: boolean;
  attemptStart: number;
  attemptBestDistance: number;
  attemptPeakAngle: number;
  // movement direction
  exitedAt: number; // left the range (rep end)
  awayRef: number | null; // ratchet: closest distance since the last move away
  lastAwayAt: number; // last time the distance to the range grew by ≥ awayStepDeg
}

export const REP_DEFAULTS = {
  hysteresisDeg: 5,
  minHoldMs: 300,
  pairWindowMs: 800,
  attemptMinDeg: 10, // movement toward the range that counts as an attempt
  attemptReturnDeg: 5, // back within this of rest = attempt over
  attemptMinMs: 300, // shorter excursions are noise
  warmupMs: 2000, // ignore attempts while the patient gets into position
  awayStepDeg: 2, // growth of the distance to the range that counts as moving away
  returnSettleMs: 500, // no movement away for this long = back at rest
  returnMinMs: 1000, // after leaving the range, 'returning' lasts at least this long
  holdMs: 0, // > 0: hold exercise — the rep counts once held this long (not on leaving the range)
  isometric: false, // hold in place: after a counted hold and relaxMs, the next hold starts without leaving the range
  relaxMs: 3000,
  posture: null as PostureGate | null, // body position required for anything to count (e.g. lying down)
};

export type RepOptions = typeof REP_DEFAULTS;

/** Rep options for an exercise's hold and posture settings (lib/exercises-data exerciseMeta) */
export function repOptionsFor(meta: { holdSeconds: number | null; isometric: boolean; posture?: PostureGate | null }): RepOptions {
  return {
    ...REP_DEFAULTS,
    ...(meta.holdSeconds ? { holdMs: meta.holdSeconds * 1000, isometric: meta.isometric } : {}),
    posture: meta.posture ?? null,
  };
}

function postureMet(gate: PostureGate | null, angles: Record<string, number>): boolean {
  if (!gate) return true;
  const v = angles[gate.measurement];
  return v !== undefined && (gate.min === undefined || v >= gate.min) && (gate.max === undefined || v <= gate.max);
}

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
      holdCredited: false,
      creditedAt: 0,
      bestAccuracy: -1,
      bestAngles: {},
      firstSeenAt: null,
      restDistance: null,
      attempting: false,
      attemptStart: 0,
      attemptBestDistance: Infinity,
      attemptPeakAngle: 0,
      exitedAt: -Infinity,
      awayRef: null,
      lastAwayAt: -Infinity,
    });
  }

  /** false while the exercise's required body position is not met (nothing counts) */
  postureOk = true;

  /** Feed one frame of measurements; returns completed reps / incomplete attempts. */
  update(angles: Record<string, number>, now: number): RepEvent[] {
    const events: RepEvent[] = [];
    const o = this.opts;

    // Wrong body position (e.g. still standing for a lying exercise): drop any
    // hold or attempt in progress silently and wait
    this.postureOk = postureMet(o.posture, angles);
    if (!this.postureOk) {
      for (const st of Object.values(this.states)) {
        st.inRange = false;
        st.holdCredited = false;
        st.attempting = false;
        st.restDistance = null;
      }
      return events;
    }

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

      // Direction: moving away from the range = returning toward rest
      if (st.awayRef === null || distance < st.awayRef) st.awayRef = distance;
      else if (distance - st.awayRef >= o.awayStepDeg) {
        st.lastAwayAt = now;
        st.awayRef = distance;
      }

      // ── Rep state machine ──────────────────────────────────────
      if (!st.inRange && inRange) {
        st.inRange = true;
        st.enteredAt = now;
        st.holdCredited = false;
        st.bestAccuracy = -1;
        st.bestAngles = {};
        st.attempting = false; // reached the range: this is a rep, not a shortfall
      }

      if (st.inRange && inRange) {
        if (o.isometric && st.holdCredited && now - st.creditedAt >= o.relaxMs) {
          // Relaxed long enough: the next hold starts where the patient is
          st.holdCredited = false;
          st.enteredAt = now;
          st.bestAccuracy = -1;
          st.bestAngles = {};
        }
        const { percentAccuracy } = isAngleCorrect(angle, target.idealAngle, target.minAngle, target.maxAngle);
        if (!st.holdCredited && percentAccuracy > st.bestAccuracy) {
          st.bestAccuracy = percentAccuracy;
          st.bestAngles = { ...angles };
        }
        if (o.holdMs > 0 && !st.holdCredited && now - st.enteredAt >= o.holdMs) {
          st.holdCredited = true;
          st.creditedAt = now;
          // Both sides held together (pair window) = one rep
          if (now - this.lastRepAt >= o.pairWindowMs) {
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
        }
        continue;
      }

      if (st.inRange) {
        // Out of range but still within the hysteresis band → wait
        if (distance < o.hysteresisDeg) continue;
        st.inRange = false;
        st.exitedAt = now;
        st.lastAwayAt = now;
        st.awayRef = distance;
        st.restDistance = distance; // re-baseline rest as the limb returns
        if (o.holdMs > 0) {
          // Hold exercise: the rep was counted during the hold, if it lasted
          const held = now - st.enteredAt;
          if (!st.holdCredited && held >= o.minHoldMs && now - this.lastIncompleteAt >= o.pairWindowMs) {
            this.lastIncompleteAt = now;
            events.push({ type: 'short_hold', target, heldMs: held });
          }
        } else if (now - st.enteredAt >= o.minHoldMs && now - this.lastRepAt >= o.pairWindowMs) {
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

  /**
   * Current movement phase across the tracked sides (hold > moving >
   * returning > rest, so the side being exercised wins).
   */
  motion(now: number): MotionState {
    const o = this.opts;
    let best: { phase: MovementPhase; target: RepTarget | null } = { phase: 'rest', target: null };
    const rank: Record<MovementPhase, number> = { rest: 0, returning: 1, moving: 2, hold: 3 };
    for (const target of this.repTargets) {
      const st = this.states[target.name];
      if (!st) continue;
      let phase: MovementPhase = 'rest';
      if (st.inRange) phase = 'hold';
      else if (now - st.exitedAt < o.returnMinMs || now - st.lastAwayAt < o.returnSettleMs) phase = 'returning';
      else if (st.attempting) phase = 'moving';
      if (rank[phase] > rank[best.phase]) best = { phase, target };
    }
    if (best.phase !== this.lastPhase) {
      this.lastPhase = best.phase;
      this.phaseSince = now;
    }
    return { ...best, since: this.phaseSince };
  }

  /** Hold exercises: the tracked side currently in range (furthest into its hold), else null */
  holdStatus(now: number): HoldStatus | null {
    const o = this.opts;
    if (o.holdMs <= 0) return null;
    let best: HoldStatus | null = null;
    for (const target of this.repTargets) {
      const st = this.states[target.name];
      if (!st?.inRange) continue;
      const s: HoldStatus = { target, heldMs: st.holdCredited ? o.holdMs : now - st.enteredAt, holdMs: o.holdMs, done: st.holdCredited };
      if (!best || s.heldMs > best.heldMs) best = s;
    }
    return best;
  }

  private lastPhase: MovementPhase = 'rest';
  private phaseSince = 0;

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
