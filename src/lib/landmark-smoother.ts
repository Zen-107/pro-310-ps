import type { Landmark } from '@/lib/angle-utils';

// Landmark smoothing for the live pose pipeline.
//
// Each coordinate (image x/y/z and world x/y/z) goes through a One Euro filter
// (Casiez, Roussel & Vogel, CHI 2012): an exponential low-pass whose cutoff
// rises with speed — heavy smoothing when a limb is still (kills jitter),
// light smoothing when it moves (keeps lag low).
//
// Visibility uses hysteresis so landmarks don't flicker on/off at the
// threshold: a landmark becomes tracked when its smoothed visibility reaches
// VISIBILITY_ON and is dropped only below VISIBILITY_OFF. Untracked landmarks
// are output with visibility 0, so the angle engine skips them. When a
// landmark is re-acquired its filters restart, so it doesn't drift in from a
// stale position.

export const VISIBILITY_ON = 0.65;
export const VISIBILITY_OFF = 0.5;

export interface OneEuroParams {
  /** Cutoff (Hz) at zero speed — lower = smoother at rest */
  minCutoff: number;
  /** How fast the cutoff rises with speed — higher = less lag when moving */
  beta: number;
  /** Cutoff (Hz) for the speed estimate */
  dCutoff: number;
}

// Tuned for MediaPipe coordinates (~0–1 normalized image units, metres for world)
// Picked by sweep: ≥2.5× less jitter at rest; settles within ~0.3 s of a hold,
// so rep scoring (best angle during the hold) and ROM extremes are unaffected.
export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.0, beta: 5, dCutoff: 2.0 };

const VISIBILITY_EMA = 0.35; // weight of the newest visibility sample

function smoothingFactor(cutoffHz: number, dtSec: number) {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
}

export class OneEuroFilter {
  private x: number | null = null;
  private dx = 0;
  private lastT: number | null = null;

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  reset() {
    this.x = null;
    this.dx = 0;
    this.lastT = null;
  }

  /** @param t timestamp in seconds */
  filter(value: number, t: number): number {
    if (this.x === null || this.lastT === null || t <= this.lastT) {
      this.x = value;
      this.lastT = t;
      return value;
    }
    const dt = t - this.lastT;
    this.lastT = t;
    const rawDx = (value - this.x) / dt;
    this.dx += smoothingFactor(this.params.dCutoff, dt) * (rawDx - this.dx);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx);
    this.x += smoothingFactor(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

interface Track {
  tracked: boolean;
  visibility: number | null;
  image: [OneEuroFilter, OneEuroFilter, OneEuroFilter];
  world: [OneEuroFilter, OneEuroFilter, OneEuroFilter];
}

export class LandmarkSmoother {
  private tracks: Track[] = [];

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  private track(i: number): Track {
    const make = () => new OneEuroFilter(this.params);
    return (this.tracks[i] ??= {
      tracked: false,
      visibility: null,
      image: [make(), make(), make()],
      world: [make(), make(), make()],
    });
  }

  /** Forget all state (e.g. when the person leaves the frame). */
  reset() {
    this.tracks = [];
  }

  /**
   * Smooth one frame. `image` = poseLandmarks (with visibility),
   * `world` = poseWorldLandmarks (optional). Returns new arrays.
   */
  process(
    image: Landmark[],
    world: Landmark[] | null | undefined,
    timestampMs: number
  ): { image: Landmark[]; world: Landmark[] | null } {
    const t = timestampMs / 1000;
    const hasWorld = !!world && world.length === image.length;
    const outImage: Landmark[] = [];
    const outWorld: Landmark[] = [];

    for (let i = 0; i < image.length; i++) {
      const tr = this.track(i);
      const raw = image[i];
      const rawVis = raw.visibility ?? 0;
      tr.visibility = tr.visibility === null ? rawVis : tr.visibility + VISIBILITY_EMA * (rawVis - tr.visibility);

      if (!tr.tracked && tr.visibility >= VISIBILITY_ON) {
        tr.tracked = true;
        [...tr.image, ...tr.world].forEach((f) => f.reset());
      } else if (tr.tracked && tr.visibility < VISIBILITY_OFF) {
        tr.tracked = false;
      }

      const visibility = tr.tracked ? tr.visibility : 0;
      if (tr.tracked) {
        outImage.push({
          x: tr.image[0].filter(raw.x, t),
          y: tr.image[1].filter(raw.y, t),
          z: tr.image[2].filter(raw.z, t),
          visibility,
        });
        if (hasWorld) {
          const w = world![i];
          outWorld.push({
            x: tr.world[0].filter(w.x, t),
            y: tr.world[1].filter(w.y, t),
            z: tr.world[2].filter(w.z, t),
            visibility,
          });
        }
      } else {
        outImage.push({ ...raw, visibility });
        if (hasWorld) outWorld.push({ ...world![i], visibility });
      }
    }
    return { image: outImage, world: hasWorld ? outWorld : null };
  }
}
