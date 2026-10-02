import type { MovementPhase } from '@/lib/rep-counter';

// Decides whether a spoken coaching cue may be played now, so feedback
// matches the movement and never piles up:
//  - posture corrections only while the rep is being performed ('moving' /
//    'hold'), never while returning to the start position, and not in the
//    first moments after a rep ends;
//  - AI coach cues never while returning / right after a rep (a correction
//    computed mid-rep is stale by then);
//  - a minimum gap between any two cues, and a longer cooldown before the
//    same cue may repeat.

export type CueKind =
  | 'posture' // form-check fault during the movement
  | 'rom' // range not reached (reported once the patient is back at rest)
  | 'coach' // AI coach / local cue
  | 'info'; // greetings, sound on — always allowed, still counted for spacing

export interface CueGateOptions {
  /** Minimum gap between any two spoken cues */
  globalGapMs: number;
  /** Before the same cue (same key) may be spoken again */
  sameCueMs: number;
  /** Posture / coach cues are blocked this long after a rep ends */
  afterRepMs: number;
}

export const CUE_GATE_DEFAULTS: CueGateOptions = { globalGapMs: 2500, sameCueMs: 6000, afterRepMs: 2500 };

export class CueGate {
  private lastAt = -Infinity;
  private lastByKey = new Map<string, number>();
  private blockedUntil = -Infinity;

  constructor(private readonly opts: CueGateOptions = CUE_GATE_DEFAULTS) {}

  reset() {
    this.lastAt = -Infinity;
    this.lastByKey.clear();
    this.blockedUntil = -Infinity;
  }

  /** A rep (or attempt) just ended: the patient is returning to the start position */
  noteRepEnd(now: number) {
    this.blockedUntil = Math.max(this.blockedUntil, now + this.opts.afterRepMs);
  }

  /** Time since any cue was last spoken */
  msSinceLastCue(now: number): number {
    return now - this.lastAt;
  }

  /** Phase/state check only (does not record anything) */
  phaseAllows(kind: CueKind, phase: MovementPhase, now: number): boolean {
    switch (kind) {
      case 'posture':
        return (phase === 'moving' || phase === 'hold') && now >= this.blockedUntil;
      case 'coach':
        return phase !== 'returning' && now >= this.blockedUntil;
      case 'rom':
        return phase !== 'returning' && phase !== 'hold';
      case 'info':
        return true;
    }
  }

  /** true (and records the cue) when it may be spoken now */
  allow(key: string, kind: CueKind, phase: MovementPhase, now: number): boolean {
    if (!this.phaseAllows(kind, phase, now)) return false;
    if (kind !== 'info') {
      if (now - this.lastAt < this.opts.globalGapMs) return false;
      if (now - (this.lastByKey.get(key) ?? -Infinity) < this.opts.sameCueMs) return false;
    }
    this.lastAt = now;
    this.lastByKey.set(key, now);
    return true;
  }
}

/**
 * A form fault must persist this long before it is announced, so a single
 * noisy frame or a brief wobble doesn't trigger a correction.
 */
export const POSTURE_PERSIST_MS = 400;

/** Tracks how long each fault has been continuously present */
export class FaultPersistence {
  private since = new Map<string, number>();

  /** Feed the faults present in this frame; returns those present ≥ persistMs */
  update(present: string[], now: number, persistMs = POSTURE_PERSIST_MS): string[] {
    const keep = new Set(present);
    for (const id of [...this.since.keys()]) if (!keep.has(id)) this.since.delete(id);
    const stable: string[] = [];
    for (const id of present) {
      const t = this.since.get(id) ?? now;
      this.since.set(id, t);
      if (now - t >= persistMs) stable.push(id);
    }
    return stable;
  }

  reset() {
    this.since.clear();
  }
}
