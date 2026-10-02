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

// ─── Presence & left/right continuity ───────────────────────────────

/** Landmarks predicted outside the image (± margin) count as not present */
const FRAME_MARGIN = 0.02;

/**
 * MediaPipe index pairs (left, right) that can be mislabelled together.
 * Upper = face, shoulders, arms, hands; lower = hips, legs, feet. When a
 * patient turns sideways or a limb is occluded the model sometimes swaps a
 * whole side for a few frames; the groups are corrected independently.
 */
const SWAP_GROUPS: [number, number][][] = [
  [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22]],
  [[23, 24], [25, 26], [27, 28], [29, 30], [31, 32]],
];

/** A swap is accepted only if it is clearly more continuous than keeping the labels */
const SWAP_RATIO = 0.6;
const SWAP_MIN_GAIN = 0.02; // normalized image units per compared pair
/** Shoulder/hip spread (normalized x) above which the person faces the camera: trust the model */
const FRONTAL_SPREAD = 0.12;
/** Previous frame older than this is too stale for a continuity check */
const CONTINUITY_MAX_GAP_MS = 400;
const CONTINUITY_MIN_VIS = 0.3;

function swapPairs<T>(arr: T[], pairs: [number, number][]) {
  for (const [l, r] of pairs) {
    if (l < arr.length && r < arr.length) [arr[l], arr[r]] = [arr[r], arr[l]];
  }
}

const dist2d = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

interface Track {
  tracked: boolean;
  visibility: number | null;
  image: [OneEuroFilter, OneEuroFilter, OneEuroFilter];
  world: [OneEuroFilter, OneEuroFilter, OneEuroFilter];
}

export class LandmarkSmoother {
  private tracks: Track[] = [];
  /** Per SWAP_GROUPS entry: true while the model's left/right labels are being swapped back */
  private swapped: boolean[] = SWAP_GROUPS.map(() => false);
  private lastOut: Landmark[] | null = null;
  private lastT = 0;

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  /** true when the last process() call corrected a left/right label swap */
  get correctingSwap(): boolean {
    return this.swapped.some(Boolean);
  }

  /**
   * Left/right continuity: compare the frame (with the current correction
   * applied) against the previous smoothed output. If swapping a group's
   * labels is clearly more continuous, toggle that group's correction; when
   * ambiguous (limbs crossing) the current mapping is kept. Facing the
   * camera, the model's labels are reliable, so corrections are cleared.
   */
  private fixLabels(image: Landmark[], world: Landmark[] | null, t: number) {
    const prev = this.lastOut;
    const fresh = prev && t - this.lastT <= CONTINUITY_MAX_GAP_MS;

    SWAP_GROUPS.forEach((pairs, g) => {
      if (this.swapped[g]) {
        swapPairs(image, pairs);
        if (world) swapPairs(world, pairs);
      }
      if (!fresh) return;

      // Frontal view: wide shoulder (upper) / hip (lower) spread → trust labels
      const [l, r] = g === 0 ? [11, 12] : [23, 24];
      const spread = Math.abs(image[l].x - image[r].x);
      const confident = (image[l].visibility ?? 0) > 0.6 && (image[r].visibility ?? 0) > 0.6;
      if (confident && spread > FRONTAL_SPREAD && this.swapped[g]) {
        swapPairs(image, pairs); // undo correction
        if (world) swapPairs(world, pairs);
        this.swapped[g] = false;
        return;
      }

      let keep = 0;
      let cross = 0;
      let n = 0;
      for (const [li, ri] of pairs) {
        const a = image[li];
        const b = image[ri];
        const pa = prev[li];
        const pb = prev[ri];
        if (!a || !b || !pa || !pb) continue;
        const usable = [a, b, pa, pb].every((p) => (p.visibility ?? 0) >= CONTINUITY_MIN_VIS);
        if (!usable) continue;
        keep += dist2d(a, pa) + dist2d(b, pb);
        cross += dist2d(a, pb) + dist2d(b, pa);
        n++;
      }
      if (n < 2) return;
      if (cross < keep * SWAP_RATIO && keep - cross > SWAP_MIN_GAIN * n) {
        swapPairs(image, pairs);
        if (world) swapPairs(world, pairs);
        this.swapped[g] = !this.swapped[g];
      }
    });
  }

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
    this.swapped = SWAP_GROUPS.map(() => false);
    this.lastOut = null;
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

    // Work on copies: label correction reorders entries
    image = image.slice();
    world = hasWorld ? world!.slice() : null;
    this.fixLabels(image, world, timestampMs);

    for (let i = 0; i < image.length; i++) {
      const tr = this.track(i);
      const raw = image[i];
      // Presence: predictions outside the frame are guesses, not detections
      const inFrame =
        raw.x >= -FRAME_MARGIN && raw.x <= 1 + FRAME_MARGIN && raw.y >= -FRAME_MARGIN && raw.y <= 1 + FRAME_MARGIN;
      const rawVis = inFrame ? raw.visibility ?? 0 : 0;
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
    this.lastOut = outImage;
    this.lastT = timestampMs;
    return { image: outImage, world: hasWorld ? outWorld : null };
  }
}
