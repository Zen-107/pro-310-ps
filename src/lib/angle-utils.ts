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
} as const;

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

/**
 * Calculate angle between three points (in degrees)
 * @param a - First point (e.g., shoulder)
 * @param b - Vertex point (e.g., elbow)
 * @param c - Third point (e.g., wrist)
 * @returns Angle in degrees
 */
export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * (180.0 / Math.PI));

  if (angle > 180) {
    angle = 360 - angle;
  }

  return Math.round(angle * 10) / 10;
}

/**
 * Calculate all relevant joint angles from pose landmarks
 */
export function calculateAllAngles(landmarks: Landmark[]): Record<string, number> {
  const angles: Record<string, number> = {};

  const lm = (idx: number): Landmark => ({
    x: landmarks[idx].x,
    y: landmarks[idx].y,
    z: landmarks[idx].z,
    visibility: landmarks[idx].visibility,
  });

  // Left knee angle (hip-knee-ankle)
  angles.left_knee = calculateAngle(
    lm(LANDMARKS.LEFT_HIP),
    lm(LANDMARKS.LEFT_KNEE),
    lm(LANDMARKS.LEFT_ANKLE)
  );

  // Right knee angle
  angles.right_knee = calculateAngle(
    lm(LANDMARKS.RIGHT_HIP),
    lm(LANDMARKS.RIGHT_KNEE),
    lm(LANDMARKS.RIGHT_ANKLE)
  );

  // Left shoulder angle (hip-shoulder-elbow)
  angles.left_shoulder = calculateAngle(
    lm(LANDMARKS.LEFT_HIP),
    lm(LANDMARKS.LEFT_SHOULDER),
    lm(LANDMARKS.LEFT_ELBOW)
  );

  // Right shoulder angle
  angles.right_shoulder = calculateAngle(
    lm(LANDMARKS.RIGHT_HIP),
    lm(LANDMARKS.RIGHT_SHOULDER),
    lm(LANDMARKS.RIGHT_ELBOW)
  );

  // Left elbow angle (shoulder-elbow-wrist)
  angles.left_elbow = calculateAngle(
    lm(LANDMARKS.LEFT_SHOULDER),
    lm(LANDMARKS.LEFT_ELBOW),
    lm(LANDMARKS.LEFT_WRIST)
  );

  // Right elbow angle
  angles.right_elbow = calculateAngle(
    lm(LANDMARKS.RIGHT_SHOULDER),
    lm(LANDMARKS.RIGHT_ELBOW),
    lm(LANDMARKS.RIGHT_WRIST)
  );

  // Left hip angle (shoulder-hip-knee)
  angles.left_hip = calculateAngle(
    lm(LANDMARKS.LEFT_SHOULDER),
    lm(LANDMARKS.LEFT_HIP),
    lm(LANDMARKS.LEFT_KNEE)
  );

  // Right hip angle
  angles.right_hip = calculateAngle(
    lm(LANDMARKS.RIGHT_SHOULDER),
    lm(LANDMARKS.RIGHT_HIP),
    lm(LANDMARKS.RIGHT_KNEE)
  );

  // Left ankle angle (knee-ankle-foot)
  angles.left_ankle = calculateAngle(
    lm(LANDMARKS.LEFT_KNEE),
    lm(LANDMARKS.LEFT_ANKLE),
    { x: landmarks[LANDMARKS.LEFT_ANKLE].x, y: 1, z: 0 }
  );

  // Right ankle angle
  angles.right_ankle = calculateAngle(
    lm(LANDMARKS.RIGHT_KNEE),
    lm(LANDMARKS.RIGHT_ANKLE),
    { x: landmarks[LANDMARKS.RIGHT_ANKLE].x, y: 1, z: 0 }
  );

  // Neck angle (based on nose relative to shoulders)
  const midShoulderX = (landmarks[LANDMARKS.LEFT_SHOULDER].x + landmarks[LANDMARKS.RIGHT_SHOULDER].x) / 2;
  const midShoulderY = (landmarks[LANDMARKS.LEFT_SHOULDER].y + landmarks[LANDMARKS.RIGHT_SHOULDER].y) / 2;
  angles.neck = calculateAngle(
    { x: midShoulderX - 0.1, y: midShoulderY, z: 0 },
    { x: midShoulderX, y: midShoulderY, z: 0 },
    { x: landmarks[LANDMARKS.NOSE].x, y: landmarks[LANDMARKS.NOSE].y, z: 0 }
  );

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
  const tolerance = (maxAngle - minAngle) / 2;
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

/**
 * Get angle status color class
 */
export function getAngleStatusColor(
  currentAngle: number,
  minAngle: number,
  maxAngle: number
): string {
  if (currentAngle >= minAngle && currentAngle <= maxAngle) {
    return 'text-emerald-500';
  }
  const deviation = Math.min(
    Math.abs(currentAngle - minAngle),
    Math.abs(currentAngle - maxAngle)
  );
  if (deviation <= 15) {
    return 'text-amber-500';
  }
  return 'text-red-500';
}