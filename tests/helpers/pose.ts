import { LANDMARKS, type Landmark } from '@/lib/angle-utils';

/** 33 MediaPipe landmarks, all visible at the image centre, with overrides */
export function pose(points: Partial<Record<keyof typeof LANDMARKS, Partial<Landmark>>> = {}, visibility = 1): Landmark[] {
  const out: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility }));
  for (const [name, p] of Object.entries(points)) {
    const i = LANDMARKS[name as keyof typeof LANDMARKS];
    out[i] = { ...out[i], ...p };
  }
  return out;
}

/** Upright person facing the camera (normalized image coordinates) */
export function standing(): Landmark[] {
  return pose({
    LEFT_SHOULDER: { x: 0.6, y: 0.3 },
    RIGHT_SHOULDER: { x: 0.4, y: 0.3 },
    LEFT_ELBOW: { x: 0.62, y: 0.45 },
    RIGHT_ELBOW: { x: 0.38, y: 0.45 },
    LEFT_WRIST: { x: 0.63, y: 0.58 },
    RIGHT_WRIST: { x: 0.37, y: 0.58 },
    LEFT_HIP: { x: 0.56, y: 0.6 },
    RIGHT_HIP: { x: 0.44, y: 0.6 },
    LEFT_KNEE: { x: 0.56, y: 0.78 },
    RIGHT_KNEE: { x: 0.44, y: 0.78 },
    LEFT_ANKLE: { x: 0.56, y: 0.95 },
    RIGHT_ANKLE: { x: 0.44, y: 0.95 },
  });
}

/** Deterministic PRNG + Gaussian noise for reproducible "noisy" tests */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, gauss: () => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next()) };
}
