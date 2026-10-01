// MediaPipe Pose landmark indices
// https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
//
// Joint angles use the vector dot product:
//   θ = arccos( (A−B)·(C−B) / (|A−B|·|C−B|) ),  B = vertex, cosine clipped to [−1, 1]
// computed on MediaPipe *world* landmarks (metres, same scale on x/y/z) when
// available, otherwise on image landmarks with x rescaled by the aspect ratio.
// Formulas per measurement are documented in joint-formulas.ts.

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Key landmark indices
export const LANDMARKS = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

// Landmarks below this visibility are treated as missing
export const MIN_VISIBILITY = 0.5;

// Vectors shorter than this (coincident points) give no angle
const MIN_VECTOR_LENGTH = 1e-6;

// Skeleton connections for drawing
export const SKELETON_CONNECTIONS: [number, number][] = [
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
  [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
  [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
  [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
  [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
  [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
  [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
  [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
];

export function isVisible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && (lm.visibility ?? 0) >= MIN_VISIBILITY;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3) => Math.sqrt(dot(a, a));
const mid = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/**
 * Angle at vertex b between the vectors b→a and b→c, in degrees (0–180).
 * Returns null when either vector has (near) zero length.
 */
export function angleAt(a: Vec3, b: Vec3, c: Vec3): number | null {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const m1 = length(v1);
  const m2 = length(v2);
  if (m1 < MIN_VECTOR_LENGTH || m2 < MIN_VECTOR_LENGTH) return null;
  const cos = Math.min(1, Math.max(-1, dot(v1, v2) / (m1 * m2)));
  return round1(Math.acos(cos) * (180 / Math.PI));
}

/**
 * Whether p lies below the line through a→b in image space (y grows downward).
 * Used to give a sign to angles measured against a roughly horizontal trunk.
 * Returns null when the line is too close to vertical to decide.
 */
function isBelowLine(p: Vec3, a: Vec3, b: Vec3): boolean | null {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 1e-3) return null;
  const cross = dx * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  return cross * Math.sign(dx) > 0;
}

export interface AngleOptions {
  /** Image width / height, used when world landmarks are unavailable */
  aspect?: number;
  /** MediaPipe poseWorldLandmarks (metres). Preferred for 3D angles. */
  world?: Landmark[] | null;
}

/**
 * Calculate every supported measurement from pose landmarks.
 * Measurements whose landmarks are below MIN_VISIBILITY are omitted.
 * Visibility always comes from the image landmarks.
 */
export function calculateAllAngles(image: Landmark[], opts: AngleOptions = {}): Record<string, number> {
  const aspect = opts.aspect ?? 1;
  const world = opts.world && opts.world.length >= 33 ? opts.world : null;
  const angles: Record<string, number> = {};

  const visible = (...idx: number[]) => idx.every((i) => isVisible(image[i]));
  // 3D point for angle magnitudes
  const p = (i: number): Vec3 =>
    world ? { x: world[i].x, y: world[i].y, z: world[i].z } : { x: image[i].x * aspect, y: image[i].y, z: 0 };
  // Image-space point (y down) for above/below decisions
  const ip = (i: number): Vec3 => ({ x: image[i].x * aspect, y: image[i].y, z: 0 });
  const set = (name: string, value: number | null) => {
    if (value !== null && Number.isFinite(value)) angles[name] = round1(value);
  };
  // Side whose three landmarks are most visible (for side-view exercises)
  const bestSide = <T extends { idx: number[] }>(left: T, right: T): T | null => {
    const score = (s: T) => Math.min(...s.idx.map((i) => image[i]?.visibility ?? 0));
    const best = score(left) >= score(right) ? left : right;
    return score(best) >= MIN_VISIBILITY ? best : null;
  };

  const joint = (name: string, a: number, b: number, c: number) => {
    if (visible(a, b, c)) set(name, angleAt(p(a), p(b), p(c)));
  };

  const L = LANDMARKS;

  // Knee: angle(hip, knee, ankle) — 180 = straight leg
  joint('left_knee', L.LEFT_HIP, L.LEFT_KNEE, L.LEFT_ANKLE);
  joint('right_knee', L.RIGHT_HIP, L.RIGHT_KNEE, L.RIGHT_ANKLE);

  // Shoulder: angle(hip, shoulder, elbow) — 0 = arm down, 180 = overhead
  joint('left_shoulder', L.LEFT_HIP, L.LEFT_SHOULDER, L.LEFT_ELBOW);
  joint('right_shoulder', L.RIGHT_HIP, L.RIGHT_SHOULDER, L.RIGHT_ELBOW);

  // Elbow: angle(shoulder, elbow, wrist) — 180 = straight arm
  joint('left_elbow', L.LEFT_SHOULDER, L.LEFT_ELBOW, L.LEFT_WRIST);
  joint('right_elbow', L.RIGHT_SHOULDER, L.RIGHT_ELBOW, L.RIGHT_WRIST);

  // Hip: angle(shoulder, hip, knee) — 180 = trunk and thigh in line
  joint('left_hip', L.LEFT_SHOULDER, L.LEFT_HIP, L.LEFT_KNEE);
  joint('right_hip', L.RIGHT_SHOULDER, L.RIGHT_HIP, L.RIGHT_KNEE);

  // Hip flexion: 180 − hip angle — 0 = leg in line with trunk (straight leg raise)
  if (angles.left_hip !== undefined) set('left_hip_flexion', 180 - angles.left_hip);
  if (angles.right_hip !== undefined) set('right_hip_flexion', 180 - angles.right_hip);

  // Hip opening: angle(left_knee, mid_hip, right_knee) — clamshell knee separation
  if (visible(L.LEFT_KNEE, L.RIGHT_KNEE, L.LEFT_HIP, L.RIGHT_HIP)) {
    set('hip_opening', angleAt(p(L.LEFT_KNEE), mid(p(L.LEFT_HIP), p(L.RIGHT_HIP)), p(L.RIGHT_KNEE)));
  }

  // Ankle dorsiflexion: 90 − angle(knee, ankle, toes) — 0 = neutral, + = toes toward shin
  const ankle = (name: string, knee: number, ank: number, toe: number) => {
    if (!visible(knee, ank, toe)) return;
    const a = angleAt(p(knee), p(ank), p(toe));
    set(name, a === null ? null : 90 - a);
  };
  ankle('left_ankle', L.LEFT_KNEE, L.LEFT_ANKLE, L.LEFT_FOOT_INDEX);
  ankle('right_ankle', L.RIGHT_KNEE, L.RIGHT_ANKLE, L.RIGHT_FOOT_INDEX);

  // Neck rotation (yaw): angle of the ear-to-ear line in the x/z plane.
  // 0 = facing the camera, ~90 = full profile. World landmarks give true depth;
  // the image fallback uses MediaPipe's relative z (approximate).
  if (visible(L.LEFT_EAR, L.RIGHT_EAR)) {
    const le = world ? world[L.LEFT_EAR] : image[L.LEFT_EAR];
    const re = world ? world[L.RIGHT_EAR] : image[L.RIGHT_EAR];
    const yaw = Math.abs(Math.atan2(le.z - re.z, le.x - re.x) * (180 / Math.PI));
    set('neck', Math.min(yaw, 180 - yaw));
  }

  // Spinal flexion proxy (cat-cow): ±(180 − angle(ear, shoulder, hip)) on the
  // more visible side; + when the ear is below the hip→shoulder line (cat,
  // back rounded), − when above (cow). MediaPipe has no spine landmarks.
  const trunk = bestSide(
    { idx: [L.LEFT_EAR, L.LEFT_SHOULDER, L.LEFT_HIP] },
    { idx: [L.RIGHT_EAR, L.RIGHT_SHOULDER, L.RIGHT_HIP] }
  );
  if (trunk) {
    const [ear, sh, hip] = trunk.idx;
    const a = angleAt(p(ear), p(sh), p(hip));
    const below = isBelowLine(ip(ear), ip(hip), ip(sh));
    if (a !== null && below !== null) set('spine_flexion', (below ? 1 : -1) * (180 - a));
  }

  // Shoulder extension proxy (prone scapular squeeze): ±angle(hip, shoulder,
  // elbow); + when the elbow is lifted above the shoulder→hip line.
  const extension = (name: string, hip: number, sh: number, elbow: number) => {
    if (!visible(hip, sh, elbow)) return;
    const a = angleAt(p(hip), p(sh), p(elbow));
    const below = isBelowLine(ip(elbow), ip(sh), ip(hip));
    if (a !== null && below !== null) set(name, (below ? -1 : 1) * a);
  };
  extension('left_shoulder_extension', L.LEFT_HIP, L.LEFT_SHOULDER, L.LEFT_ELBOW);
  extension('right_shoulder_extension', L.RIGHT_HIP, L.RIGHT_SHOULDER, L.RIGHT_ELBOW);

  return angles;
}

/**
 * Check if a joint angle is within acceptable range
 */
export function isAngleCorrect(
  currentAngle: number,
  idealAngle: number,
  minAngle: number,
  maxAngle: number
): { correct: boolean; deviation: number; percentAccuracy: number } {
  const deviation = Math.abs(currentAngle - idealAngle);
  const tolerance = Math.max((maxAngle - minAngle) / 2, 1);
  const correct = currentAngle >= minAngle && currentAngle <= maxAngle;
  const percentAccuracy = Math.max(0, 100 - (deviation / tolerance) * 50);
  return { correct, deviation, percentAccuracy: Math.round(percentAccuracy) };
}

/**
 * Format angle for display
 */
export function formatAngle(angle: number): string {
  return `${Math.round(angle)}°`;
}

export type AngleStatus = 'good' | 'warn' | 'bad';

// Canvas colors for each status (emerald-500 / amber-500 / red-500)
export const ANGLE_STATUS_HEX: Record<AngleStatus, string> = {
  good: '#10b981',
  warn: '#f59e0b',
  bad: '#ef4444',
};

/**
 * Classify an angle: in range = good, within 15° of range = warn, else bad
 */
export function getAngleStatus(currentAngle: number, minAngle: number, maxAngle: number): AngleStatus {
  if (currentAngle >= minAngle && currentAngle <= maxAngle) return 'good';
  const deviation = Math.min(
    Math.abs(currentAngle - minAngle),
    Math.abs(currentAngle - maxAngle)
  );
  return deviation <= 15 ? 'warn' : 'bad';
}

/**
 * Get angle status color class
 */
export function getAngleStatusColor(
  currentAngle: number,
  minAngle: number,
  maxAngle: number
): string {
  const status = getAngleStatus(currentAngle, minAngle, maxAngle);
  if (status === 'good') return 'text-emerald-500';
  if (status === 'warn') return 'text-amber-500';
  return 'text-red-500';
}

/**
 * Text color class for an accuracy percentage (0-100)
 */
export function getAccuracyTextColor(acc: number): string {
  if (acc >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (acc >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Bar/background color class for an accuracy percentage (0-100)
 */
export function getAccuracyBarColor(acc: number): string {
  if (acc >= 80) return 'bg-emerald-500';
  if (acc >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}
