// Human-readable formulas for every measurement produced by calculateAllAngles()
// in angle-utils.ts. Stored on ExerciseJointTarget.formula and shown in
// clinician reports. Keep in sync with angle-utils.ts.

export const ANGLE_ALGORITHM_VERSION = 'angle-utils@3';

// How angle(A, B, C) is computed (B = vertex)
export const ANGLE_DEFINITION =
  'angle(A, B, C) = arccos( (A−B)·(C−B) / (|A−B|·|C−B|) ), cosine clipped to [−1, 1]; ' +
  'computed on MediaPipe world landmarks (metres, x/y/z) or, if unavailable, on image ' +
  'landmarks with x scaled by width/height. Returns no value for zero-length vectors or ' +
  'landmarks with visibility < 0.5.';

export const JOINT_FORMULAS: Record<string, string | null> = {
  left_knee: 'angle(left_hip, left_knee, left_ankle)',
  right_knee: 'angle(right_hip, right_knee, right_ankle)',
  left_hip: 'angle(left_shoulder, left_hip, left_knee)',
  right_hip: 'angle(right_shoulder, right_hip, right_knee)',
  left_hip_flexion: '180 − angle(left_shoulder, left_hip, left_knee)',
  right_hip_flexion: '180 − angle(right_shoulder, right_hip, right_knee)',
  hip_opening: 'angle(left_knee, midpoint(left_hip, right_hip), right_knee)',
  left_shoulder: 'angle(left_hip, left_shoulder, left_elbow)',
  right_shoulder: 'angle(right_hip, right_shoulder, right_elbow)',
  left_shoulder_extension:
    '± angle(left_hip, left_shoulder, left_elbow); + when the elbow is above the shoulder→hip line (proxy for scapular retraction)',
  right_shoulder_extension:
    '± angle(right_hip, right_shoulder, right_elbow); + when the elbow is above the shoulder→hip line (proxy for scapular retraction)',
  left_elbow: 'angle(left_shoulder, left_elbow, left_wrist)',
  right_elbow: 'angle(right_shoulder, right_elbow, right_wrist)',
  left_ankle: '90 − angle(left_knee, left_ankle, left_foot_index)',
  right_ankle: '90 − angle(right_knee, right_ankle, right_foot_index)',
  neck: '|atan2(left_ear.z − right_ear.z, left_ear.x − right_ear.x)| folded to 0–90 (head yaw)',
  spine_flexion:
    '± (180 − angle(ear, shoulder, hip)) on the more visible side; + when the ear is below the hip→shoulder line (proxy for spinal flexion)',
};
