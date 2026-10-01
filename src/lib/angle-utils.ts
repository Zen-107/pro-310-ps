// MediaPipe Pose landmark indices
// https://developers.google.com/mediapipe/solutions/vision/pose_landmarker

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
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

/**
 * Calculate angle between three points (in degrees)
 * @param a - First point (e.g., shoulder)
 * @param b - Vertex point (e.g., elbow)
 * @param c - Third point (e.g., wrist)
 * @param aspect - Image width / height. MediaPipe normalizes x by width and
 *   y by height, so x must be rescaled for angles to be geometrically correct.
 * @returns Angle in degrees (0-180)
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark, aspect = 1): number {
  const radians =
    Math.atan2(c.y - b.y, (c.x - b.x) * aspect) - Math.atan2(a.y - b.y, (a.x - b.x) * aspect);
  let angle = Math.abs(radians * (180.0 / Math.PI));

  if (angle > 180) {
    angle = 360 - angle;
  }

  return Math.round(angle * 10) / 10;
}

/**
 * Calculate all relevant joint angles from pose landmarks.
 * Joints whose landmarks are below MIN_VISIBILITY are omitted (undefined).
 */
export function calculateAllAngles(landmarks: Landmark[], aspect = 1): Record<string, number> {
  const angles: Record<string, number> = {};

  const joint = (name: string, a: number, b: number, c: number) => {
    const [pa, pb, pc] = [landmarks[a], landmarks[b], landmarks[c]];
    if (isVisible(pa) && isVisible(pb) && isVisible(pc)) {
      angles[name] = calculateAngle(pa, pb, pc, aspect);
    }
  };

  // Knee (hip-knee-ankle): 180 = straight leg
  joint('left_knee', LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE);
  joint('right_knee', LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE);

  // Shoulder (hip-shoulder-elbow): 0 = arm down, 180 = arm overhead
  joint('left_shoulder', LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW);
  joint('right_shoulder', LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW);

  // Elbow (shoulder-elbow-wrist): 180 = straight arm
  joint('left_elbow', LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST);
  joint('right_elbow', LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST);

  // Hip (shoulder-hip-knee): 180 = upright
  joint('left_hip', LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE);
  joint('right_hip', LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE);

  // Ankle dorsiflexion: 90 − angle(knee, ankle, toes).
  // 0 = foot perpendicular to shin, positive = toes pulled toward shin.
  const ankle = (name: string, knee: number, ank: number, toe: number) => {
    const [pk, pa, pt] = [landmarks[knee], landmarks[ank], landmarks[toe]];
    if (isVisible(pk) && isVisible(pa) && isVisible(pt)) {
      angles[name] = Math.round((90 - calculateAngle(pk, pa, pt, aspect)) * 10) / 10;
    }
  };
  ankle('left_ankle', LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX);
  ankle('right_ankle', LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX);

  // Neck rotation (yaw): angle of the ear-to-ear line in the x/z plane.
  // 0 = facing the camera, ~90 = full profile. MediaPipe z is a relative depth
  // estimate on roughly the same scale as x, so this is an approximation.
  const leftEar = landmarks[LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[LANDMARKS.RIGHT_EAR];
  if (isVisible(leftEar) && isVisible(rightEar)) {
    const yaw = Math.atan2(leftEar.z - rightEar.z, leftEar.x - rightEar.x) * (180 / Math.PI);
    angles.neck = Math.round(Math.min(Math.abs(yaw), 180 - Math.abs(yaw)) * 10) / 10;
  }

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
