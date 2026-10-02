// Keyframed 2D body rig for the exercise demos (no video/GIF assets).
//
// Segment lengths follow standard anthropometric proportions of body height H
// (Drillis & Contini / Winter): thigh ≈ 0.245H, shank ≈ 0.246H, upper arm ≈
// 0.186H, forearm ≈ 0.146H, hip–shoulder ≈ 0.29H. Joints are driven by
// angle keyframes; planted feet use two-bone inverse kinematics.
//
// Start/end positions follow the app's cited AAOS/NHS instructions and its
// measured targets. They have NOT been verified against Kisner & Colby,
// "Therapeutic Exercise: Foundations and Techniques" — pending clinician review.

export interface Pt {
  x: number;
  y: number;
}

// Angles: degrees, measured clockwise from +x in SVG space (y grows downward):
// 0 = right, 90 = down, 180 = left, −90 = up.
export interface LimbPose {
  upper: number;
  lower: number;
  end: number; // hand / foot
  /** Optional fixed end point (e.g. planted foot) overriding `lower` length */
  lowerTo?: Pt;
}

export interface Pose {
  view: 'side' | 'front';
  hip: Pt; // pelvis centre
  torso: number; // hip → neck base
  head: number; // neck → head
  armNear: LimbPose;
  armFar: LimbPose;
  legNear: LimbPose;
  legFar: LimbPose;
}

const H = 175;
export const SEG = {
  torso: 0.29 * H, // ≈ 51
  neck: 0.05 * H,
  headR: 0.06 * H,
  upperArm: 0.186 * H,
  forearm: 0.146 * H,
  hand: 0.06 * H,
  thigh: 0.245 * H,
  shin: 0.246 * H,
  foot: 0.085 * H,
  shoulderHalf: 0.105 * H, // front view
  hipHalf: 0.055 * H, // front view
};

export const GROUND = 186;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const dir = (a: number): Pt => ({ x: Math.cos(rad(a)), y: Math.sin(rad(a)) });
export const add = (p: Pt, v: Pt, s = 1): Pt => ({ x: p.x + v.x * s, y: p.y + v.y * s });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const len = (v: Pt) => Math.hypot(v.x, v.y);
const angleOf = (v: Pt) => deg(Math.atan2(v.y, v.x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Two-bone IK: angles of bone 1 and bone 2 so the chain reaches `target`.
 * bend = −1 rotates the middle joint counter-clockwise (up for a rightward chain).
 */
export function twoBone(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): { a1: number; a2: number; joint: Pt } {
  const v = sub(target, root);
  const d = Math.min(Math.max(len(v), Math.abs(l1 - l2) + 1e-6), l1 + l2 - 1e-6);
  const base = angleOf(v);
  const cosAlpha = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = deg(Math.acos(Math.min(1, Math.max(-1, cosAlpha))));
  const a1 = base + bend * alpha;
  const joint = add(root, dir(a1), l1);
  return { a1, a2: angleOf(sub(target, joint)), joint };
}

/** Distance between hip and ankle for a given interior knee angle */
const legSpan = (kneeInterior: number) =>
  Math.sqrt(SEG.thigh ** 2 + SEG.shin ** 2 - 2 * SEG.thigh * SEG.shin * Math.cos(rad(kneeInterior)));

// ─── Skeleton (joint positions) ─────────────────────────────────────

export interface Limb {
  root: Pt;
  mid: Pt;
  end: Pt;
  tip: Pt;
}

export interface Skeleton {
  view: 'side' | 'front';
  hip: Pt;
  neck: Pt;
  headCenter: Pt;
  armNear: Limb;
  armFar: Limb;
  legNear: Limb;
  legFar: Limb;
}

function limb(root: Pt, l: LimbPose, l1: number, l2: number, l3: number): Limb {
  const mid = add(root, dir(l.upper), l1);
  const end = l.lowerTo ?? add(mid, dir(l.lower), l2);
  return { root, mid, end, tip: add(end, dir(l.end), l3) };
}

export function buildSkeleton(p: Pose): Skeleton {
  const neck = add(p.hip, dir(p.torso), SEG.torso);
  const headCenter = add(neck, dir(p.head), SEG.neck + SEG.headR);
  // Front view: shoulders/hips spread perpendicular to the trunk
  const perp = dir(p.torso + 90);
  const sh = p.view === 'front' ? SEG.shoulderHalf : 0;
  const hp = p.view === 'front' ? SEG.hipHalf : 0;
  return {
    view: p.view,
    hip: p.hip,
    neck,
    headCenter,
    armNear: limb(add(neck, perp, -sh), p.armNear, SEG.upperArm, SEG.forearm, SEG.hand),
    armFar: limb(add(neck, perp, sh), p.armFar, SEG.upperArm, SEG.forearm, SEG.hand),
    legNear: limb(add(p.hip, perp, -hp), p.legNear, SEG.thigh, SEG.shin, SEG.foot),
    legFar: limb(add(p.hip, perp, hp), p.legFar, SEG.thigh, SEG.shin, SEG.foot),
  };
}

// ─── Measurements (same formulas as the angle engine) ───────────────

export function angleAt2D(a: Pt, b: Pt, c: Pt): number {
  const v1 = sub(a, b);
  const v2 = sub(c, b);
  const cos = (v1.x * v2.x + v1.y * v2.y) / (len(v1) * len(v2));
  return deg(Math.acos(Math.min(1, Math.max(-1, cos))));
}

export type DemoMeasurement = 'knee' | 'hip' | 'hip_flexion' | 'shoulder' | 'hip_opening';

export function measure(s: Skeleton, m: DemoMeasurement): { value: number; vertex: Pt; from: Pt; to: Pt } {
  const shoulderNear = s.armNear.root;
  switch (m) {
    case 'knee':
      return { value: angleAt2D(s.legNear.root, s.legNear.mid, s.legNear.end), vertex: s.legNear.mid, from: s.legNear.root, to: s.legNear.end };
    case 'hip':
      return { value: angleAt2D(shoulderNear, s.legNear.root, s.legNear.mid), vertex: s.legNear.root, from: shoulderNear, to: s.legNear.mid };
    case 'hip_flexion':
      return { value: 180 - angleAt2D(shoulderNear, s.legNear.root, s.legNear.mid), vertex: s.legNear.root, from: shoulderNear, to: s.legNear.mid };
    case 'shoulder':
      return { value: angleAt2D(s.legNear.root, shoulderNear, s.armNear.mid), vertex: shoulderNear, from: s.legNear.root, to: s.armNear.mid };
    case 'hip_opening':
      return { value: angleAt2D(s.legFar.mid, s.hip, s.legNear.mid), vertex: s.hip, from: s.legFar.mid, to: s.legNear.mid };
  }
}

// ─── Exercises ──────────────────────────────────────────────────────

export interface ExerciseDemo {
  slug: string;
  view: 'side' | 'front';
  measurement: DemoMeasurement;
  /** Floor props drawn under the body */
  props: { mat?: boolean; wallX?: number };
  /** true = continuous loop (no holds), e.g. arm circles */
  continuous?: boolean;
  /** Pose at progress t ∈ [0, 1] (0 = start position, 1 = end position) */
  pose: (t: number) => Pose;
  caption: string;
}

const standingHipY = GROUND - SEG.foot * 0.35 - SEG.thigh - SEG.shin;
const hang: LimbPose = { upper: 92, lower: 90, end: 90 };
const straightDown = (lean = 0): LimbPose => ({ upper: 90 + lean, lower: 90 + lean, end: 0 });

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
  // Heel slide in long sitting: heel stays on the surface while the knee bends
  ex_knee_flexion: {
    slug: 'ex_knee_flexion',
    view: 'side',
    measurement: 'knee',
    props: { mat: true },
    caption: 'Long sitting, slide the heel toward you, keep it on the surface',
    pose: (t) => {
      const hip = { x: 92, y: GROUND - 9 };
      const flexion = lerp(8, 95, t); // knee flexion 0 = straight
      const span = legSpan(180 - flexion);
      const ankle = { x: hip.x + Math.sqrt(Math.max(span ** 2 - 25, 0)), y: GROUND - 4 };
      const ik = twoBone(hip, ankle, SEG.thigh, SEG.shin, -1);
      return {
        view: 'side',
        hip,
        torso: -97,
        head: -88,
        armNear: { upper: 112, lower: 98, end: 90 },
        armFar: { upper: 118, lower: 102, end: 90 },
        legNear: { upper: ik.a1, lower: ik.a2, end: lerp(-62, -10, t), lowerTo: ankle },
        legFar: { upper: 2, lower: 0, end: -62 },
      };
    },
  },

  // Standing, raise the straight arm forward and overhead
  ex_shoulder_flexion: {
    slug: 'ex_shoulder_flexion',
    view: 'side',
    measurement: 'shoulder',
    props: {},
    caption: 'Standing tall, raise the straight arm forward and overhead',
    pose: (t) => {
      const elevation = lerp(6, 172, t);
      const arm = 90 - elevation;
      return {
        view: 'side',
        hip: { x: 128, y: standingHipY },
        torso: -90,
        head: -90,
        armNear: { upper: arm, lower: arm, end: arm },
        armFar: hang,
        legNear: straightDown(),
        legFar: straightDown(1),
      };
    },
  },

  // Standing (front view), raise both arms out to the side to shoulder height
  ex_shoulder_abduction: {
    slug: 'ex_shoulder_abduction',
    view: 'front',
    measurement: 'shoulder',
    props: {},
    caption: 'Standing tall, raise the straight arms out to the side',
    pose: (t) => {
      const a = lerp(6, 80, t); // hips narrower than shoulders → measured ≈ a + 10°
      return {
        view: 'front',
        hip: { x: 130, y: standingHipY },
        torso: -90,
        head: -90,
        armNear: { upper: 90 + a, lower: 90 + a, end: 90 + a },
        armFar: { upper: 90 - a, lower: 90 - a, end: 90 - a },
        legNear: { upper: 93, lower: 92, end: 180 },
        legFar: { upper: 87, lower: 88, end: 0 },
      };
    },
  },

  // Back against the wall, feet forward, slide down to ~90° knee bend
  ex_wall_squat: {
    slug: 'ex_wall_squat',
    view: 'side',
    measurement: 'knee',
    props: { wallX: 58 },
    caption: 'Back against the wall, feet forward, slide down and hold',
    pose: (t) => {
      const knee = lerp(168, 88, t);
      const ankle = { x: 118, y: GROUND - 4 };
      const hipX = 70;
      const span = legSpan(knee);
      const hip = { x: hipX, y: ankle.y - Math.sqrt(Math.max(span ** 2 - (ankle.x - hipX) ** 2, 0)) };
      const ik = twoBone(hip, ankle, SEG.thigh, SEG.shin, -1);
      return {
        view: 'side',
        hip,
        torso: -90,
        head: -90,
        armNear: { upper: 84, lower: 70, end: 70 },
        armFar: { upper: 86, lower: 72, end: 72 },
        legNear: { upper: ik.a1, lower: ik.a2, end: 0, lowerTo: ankle },
        legFar: { upper: ik.a1 + 2, lower: ik.a2, end: 0, lowerTo: { x: ankle.x + 3, y: ankle.y } },
      };
    },
  },

  // Free-standing squat (side view): feet planted, hips back, chest forward,
  // arms reaching forward for balance; down to ≈95° interior knee angle
  ex_squat: {
    slug: 'ex_squat',
    view: 'side',
    measurement: 'knee',
    props: {},
    caption: 'Feet shoulder-width, push the hips back and bend the knees as if sitting on a chair',
    pose: (t) => {
      const ankle = { x: 138, y: GROUND - 4 };
      const knee = lerp(174, 95, t); // interior knee angle
      const shinTilt = lerp(3, 28, t); // knee travels forward over the toes
      const kneePt = add(ankle, dir(-90 + shinTilt), SEG.shin);
      const thighDir = 90 + shinTilt + knee; // knee → hip
      const hip = add(kneePt, dir(thighDir), SEG.thigh);
      const thigh = thighDir - 180; // hip → knee
      const shin = 90 + shinTilt; // knee → ankle
      const lean = lerp(4, 38, t); // trunk inclination forward
      return {
        view: 'side',
        hip,
        torso: -90 + lean,
        head: -90 + lean * 0.6,
        armNear: { upper: lerp(60, -4, t), lower: lerp(60, -4, t), end: lerp(60, -4, t) },
        armFar: { upper: lerp(62, -2, t), lower: lerp(62, -2, t), end: lerp(62, -2, t) },
        legNear: { upper: thigh, lower: shin, end: 0, lowerTo: ankle },
        legFar: { upper: thigh + 2, lower: shin, end: 0, lowerTo: { x: ankle.x + 3, y: ankle.y } },
      };
    },
  },

  // Front view: large slow circles reaching overhead
  ex_arm_circles: {
    slug: 'ex_arm_circles',
    view: 'front',
    measurement: 'shoulder',
    props: {},
    continuous: true,
    caption: 'Arms straight, make large slow circles reaching overhead',
    pose: (t) => {
      const e = 35 + 140 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)); // 35° → 175° → 35°
      return {
        view: 'front',
        hip: { x: 130, y: standingHipY },
        torso: -90,
        head: -90,
        armNear: { upper: 90 + e, lower: 90 + e, end: 90 + e },
        armFar: { upper: 90 - e, lower: 90 - e, end: 90 - e },
        legNear: { upper: 93, lower: 92, end: 180 },
        legFar: { upper: 87, lower: 88, end: 0 },
      };
    },
  },

};

// ─── Timeline ───────────────────────────────────────────────────────

const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Hold start → move → hold end → return → short rest (seconds) */
export const DEMO_PHASES = { holdStart: 0.7, move: 1.5, holdEnd: 1.0, back: 1.5, rest: 0.4 };
export const DEMO_CYCLE = Object.values(DEMO_PHASES).reduce((a, b) => a + b, 0);
export const CONTINUOUS_CYCLE = 4;

/** Progress (0 = start, 1 = end) at time `sec` within a looping demo */
export function demoProgress(demo: ExerciseDemo, sec: number): number {
  if (demo.continuous) return (sec % CONTINUOUS_CYCLE) / CONTINUOUS_CYCLE;
  let t = sec % DEMO_CYCLE;
  const p = DEMO_PHASES;
  if ((t -= p.holdStart) < 0) return 0;
  if (t < p.move) return easeInOut(t / p.move);
  if ((t -= p.move) < p.holdEnd) return 1;
  if ((t -= p.holdEnd) < p.back) return 1 - easeInOut(t / p.back);
  return 0;
}
