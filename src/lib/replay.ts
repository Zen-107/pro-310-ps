// Clinical session replay: recorded pose frames and the geometry used to draw
// them. Frames are recorded by the live session at REPLAY_FPS and stored in
// SessionFrameChunk.frames; the report's replay viewer plays them back.

import { LANDMARKS, isVisible, type Landmark } from '@/lib/angle-utils';

export const REPLAY_FPS = 10;
export const REPLAY_FRAME_MS = 1000 / REPLAY_FPS;
export const REPLAY_CHUNK_FRAMES = 50; // ≈ 5 s per upload
export const REPLAY_MAX_FRAMES_PER_CHUNK = 100;
export const REPLAY_MAX_CHUNKS = 2400; // ≈ 3.3 h at 5 s/chunk

/** Landmarks stored per frame, in this order */
export const REPLAY_LANDMARKS = [
  LANDMARKS.NOSE,
  LANDMARKS.LEFT_SHOULDER,
  LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_ELBOW,
  LANDMARKS.RIGHT_ELBOW,
  LANDMARKS.LEFT_WRIST,
  LANDMARKS.RIGHT_WRIST,
  LANDMARKS.LEFT_HIP,
  LANDMARKS.RIGHT_HIP,
  LANDMARKS.LEFT_KNEE,
  LANDMARKS.RIGHT_KNEE,
  LANDMARKS.LEFT_ANKLE,
  LANDMARKS.RIGHT_ANKLE,
] as const;

const VALUES_PER_POINT = 4; // x, y, z, visibility
export const REPLAY_POINT_VALUES = REPLAY_LANDMARKS.length * VALUES_PER_POINT;

/**
 * One recorded frame.
 *  t  epoch ms (same clock as SessionFault.occurredAt)
 *  s  'w' = MediaPipe world landmarks (metres, hip-centred), 'i' = image
 *     landmarks with x and z scaled by the aspect ratio
 *  p  REPLAY_LANDMARKS × [x, y, z, visibility]; y points down
 *  a  every measurement from calculateAllAngles() on this frame
 */
export interface ReplayFrame {
  t: number;
  s: 'w' | 'i';
  p: number[];
  a: Record<string, number>;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r1 = (v: number) => Math.round(v * 10) / 10;

export function encodeFrame(
  t: number,
  image: Landmark[],
  world: Landmark[] | null | undefined,
  aspect: number,
  angles: Record<string, number>
): ReplayFrame {
  const useWorld = !!world && world.length >= 33;
  const p: number[] = [];
  for (const i of REPLAY_LANDMARKS) {
    const src = useWorld ? world![i] : image[i];
    const scale = useWorld ? 1 : aspect;
    // Visibility always comes from the image landmarks (as in calculateAllAngles)
    const v = isVisible(image[i]) ? r3(image[i].visibility ?? 0) : 0;
    p.push(r3(src.x * scale), r3(src.y), r3(src.z * scale), v);
  }
  const a: Record<string, number> = {};
  for (const [k, v] of Object.entries(angles)) a[k] = r1(v);
  return { t: Math.round(t), s: useWorld ? 'w' : 'i', p, a };
}

/** Runtime guard for frames posted by the client */
export function isReplayFrame(f: unknown, knownMeasurement: (k: string) => boolean): f is ReplayFrame {
  if (!f || typeof f !== 'object') return false;
  const x = f as Partial<ReplayFrame>;
  if (typeof x.t !== 'number' || !Number.isFinite(x.t)) return false;
  if (x.s !== 'w' && x.s !== 'i') return false;
  if (!Array.isArray(x.p) || x.p.length !== REPLAY_POINT_VALUES) return false;
  if (!x.p.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100)) return false;
  if (!x.a || typeof x.a !== 'object' || Array.isArray(x.a)) return false;
  const entries = Object.entries(x.a);
  return (
    entries.length <= 40 &&
    entries.every(([k, v]) => knownMeasurement(k) && typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 360)
  );
}

// ─── Geometry for drawing ────────────────────────────────────────────

export interface P3 {
  x: number;
  y: number;
  z: number;
}
export interface P2 {
  x: number;
  y: number;
}

/** Visible points of a frame, keyed by MediaPipe landmark index */
export function framePoints(f: ReplayFrame, minVisibility = 0.5): Map<number, P3> {
  const out = new Map<number, P3>();
  REPLAY_LANDMARKS.forEach((idx, k) => {
    const o = k * VALUES_PER_POINT;
    if (f.p[o + 3] >= minVisibility) out.set(idx, { x: f.p[o], y: f.p[o + 1], z: f.p[o + 2] });
  });
  return out;
}

/** Orthographic view rotated `yawDeg` about the vertical axis (0 = camera view) */
export function project(p: P3, yawDeg: number): P2 {
  const a = (yawDeg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) + p.z * Math.sin(a), y: p.y };
}

// Pseudo-landmarks for measurements whose vertex is a midpoint
export const MID_HIP = -1;
export const MID_SHOULDER = -2;

export function pointOf(points: Map<number, P3>, idx: number): P3 | undefined {
  const midOf = (a: number, b: number) => {
    const p = points.get(a);
    const q = points.get(b);
    return p && q ? { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 } : undefined;
  };
  if (idx === MID_HIP) return midOf(LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP);
  if (idx === MID_SHOULDER) return midOf(LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER);
  return points.get(idx);
}

/**
 * How to draw a measurement's angle arc. The arc starts at the reference
 * direction and sweeps toward `moving`:
 *  ray      reference = vertex → `ref`
 *  extend   reference = continuation of `ref` → vertex (hip flexion: 0 = in line with trunk)
 *  perp     reference = perpendicular to vertex → `ref`, pointing down (hip abduction)
 *  vertical reference = straight up (trunk measures)
 */
export interface ArcSpec {
  vertex: number;
  moving: number;
  ref?: number;
  mode: 'ray' | 'extend' | 'perp' | 'vertical';
}

const L = LANDMARKS;
export const MEASUREMENT_ARCS: Record<string, ArcSpec> = {
  left_knee: { vertex: L.LEFT_KNEE, ref: L.LEFT_HIP, moving: L.LEFT_ANKLE, mode: 'ray' },
  right_knee: { vertex: L.RIGHT_KNEE, ref: L.RIGHT_HIP, moving: L.RIGHT_ANKLE, mode: 'ray' },
  left_hip: { vertex: L.LEFT_HIP, ref: L.LEFT_SHOULDER, moving: L.LEFT_KNEE, mode: 'ray' },
  right_hip: { vertex: L.RIGHT_HIP, ref: L.RIGHT_SHOULDER, moving: L.RIGHT_KNEE, mode: 'ray' },
  left_hip_flexion: { vertex: L.LEFT_HIP, ref: L.LEFT_SHOULDER, moving: L.LEFT_KNEE, mode: 'extend' },
  right_hip_flexion: { vertex: L.RIGHT_HIP, ref: L.RIGHT_SHOULDER, moving: L.RIGHT_KNEE, mode: 'extend' },
  hip_opening: { vertex: MID_HIP, ref: L.RIGHT_KNEE, moving: L.LEFT_KNEE, mode: 'ray' },
  left_hip_abduction: { vertex: L.LEFT_HIP, ref: L.RIGHT_HIP, moving: L.LEFT_KNEE, mode: 'perp' },
  right_hip_abduction: { vertex: L.RIGHT_HIP, ref: L.LEFT_HIP, moving: L.RIGHT_KNEE, mode: 'perp' },
  left_shoulder: { vertex: L.LEFT_SHOULDER, ref: L.LEFT_HIP, moving: L.LEFT_ELBOW, mode: 'ray' },
  right_shoulder: { vertex: L.RIGHT_SHOULDER, ref: L.RIGHT_HIP, moving: L.RIGHT_ELBOW, mode: 'ray' },
  left_elbow: { vertex: L.LEFT_ELBOW, ref: L.LEFT_SHOULDER, moving: L.LEFT_WRIST, mode: 'ray' },
  right_elbow: { vertex: L.RIGHT_ELBOW, ref: L.RIGHT_SHOULDER, moving: L.RIGHT_WRIST, mode: 'ray' },
  trunk_lateral_flexion: { vertex: MID_HIP, moving: MID_SHOULDER, mode: 'vertical' },
  trunk_inclination: { vertex: MID_HIP, moving: MID_SHOULDER, mode: 'vertical' },
  // trunk_rotation is transverse-plane: no arc in a front/side projection
};

/** Landmarks to highlight when a measurement has a fault */
export function measurementLandmarks(measurement: string): number[] {
  const spec = MEASUREMENT_ARCS[measurement];
  if (measurement === 'trunk_rotation' || spec?.mode === 'vertical') {
    return [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP];
  }
  if (!spec) return [];
  return spec.vertex === MID_HIP ? [L.LEFT_HIP, L.RIGHT_HIP, spec.moving] : [spec.vertex];
}

const unit2 = (v: P2): P2 => {
  const n = Math.hypot(v.x, v.y) || 1e-9;
  return { x: v.x / n, y: v.y / n };
};

/**
 * Projected arc for a measurement: start angle of the reference direction and
 * the signed sweep (degrees, SVG orientation) toward the moving segment.
 * The sweep is the 2D projected angle; labels show the recorded 3D value.
 */
export function arcGeometry(
  measurement: string,
  points: Map<number, P3>,
  yawDeg: number
): { vertex: P2; refDir: P2; startDeg: number; sign: 1 | -1; projectedDeg: number } | null {
  const spec = MEASUREMENT_ARCS[measurement];
  if (!spec) return null;
  const v3 = pointOf(points, spec.vertex);
  const m3 = pointOf(points, spec.moving);
  if (!v3 || !m3) return null;
  const vertex = project(v3, yawDeg);
  const toMoving = unit2({ x: project(m3, yawDeg).x - vertex.x, y: project(m3, yawDeg).y - vertex.y });

  let refDir: P2;
  if (spec.mode === 'vertical') {
    refDir = { x: 0, y: -1 };
  } else {
    const r3p = spec.ref !== undefined ? pointOf(points, spec.ref) : undefined;
    if (!r3p) return null;
    const ref = project(r3p, yawDeg);
    const toRef = unit2({ x: ref.x - vertex.x, y: ref.y - vertex.y });
    if (spec.mode === 'ray') refDir = toRef;
    else if (spec.mode === 'extend') refDir = { x: -toRef.x, y: -toRef.y };
    else {
      // Perpendicular to the pelvis line, pointing down (neutral standing thigh)
      const a = { x: -toRef.y, y: toRef.x };
      refDir = a.y >= 0 ? a : { x: -a.x, y: -a.y };
    }
  }
  const cross = refDir.x * toMoving.y - refDir.y * toMoving.x;
  const dot = refDir.x * toMoving.x + refDir.y * toMoving.y;
  const projectedDeg = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
  return {
    vertex,
    refDir,
    startDeg: (Math.atan2(refDir.y, refDir.x) * 180) / Math.PI,
    sign: cross >= 0 ? 1 : -1,
    projectedDeg,
  };
}

/** Index of the last frame at or before time t (frames sorted by t) */
export function frameIndexAt(frames: ReplayFrame[], t: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  if (hi < 0) return -1;
  if (t <= frames[0].t) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
