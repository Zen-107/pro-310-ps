// Keyframed 2D body rig for the exercise demos (no video/GIF assets).
//
// Segment lengths follow standard anthropometric proportions of body height H
// (Drillis & Contini / Winter): thigh ≈ 0.245H, shank ≈ 0.246H, upper arm ≈
// 0.186H, forearm ≈ 0.146H, hip–shoulder ≈ 0.29H. Joints are driven by
// angle keyframes; planted feet use two-bone inverse kinematics.
//
// Start/end positions follow the app's cited AAOS/NHS/CUH/Mahidol/Powell instructions and its
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

/** Motion path drawn over the demo, e.g. the circle a hand traces */
export interface DemoGuide {
  center: Pt;
  radius: number;
  /** Where the moving point is now (degrees, same convention as poses) */
  at: number;
  /** Direction of travel: 1 = increasing angle (clockwise on screen), −1 = decreasing */
  turn: 1 | -1;
}

export interface ExerciseDemo {
  slug: string;
  view: 'side' | 'front';
  measurement: DemoMeasurement;
  /** Floor props drawn under the body */
  props: { mat?: boolean; wallX?: number };
  /** true = continuous loop (no holds), e.g. arm circles */
  continuous?: boolean;
  /** Seconds per loop for continuous demos (default CONTINUOUS_CYCLE) */
  cycle?: number;
  /** Vertical slice of the 260×200 scene to show (lying exercises fill the frame) */
  frame?: { y: number; h: number };
  /** Only the near arm/leg is exercised (one side at a time); mirrored for the other side */
  unilateral?: boolean;
  /** Motion paths to draw at progress t */
  guides?: (t: number) => DemoGuide[];
  /** Pose at progress t ∈ [0, 1] (0 = start position, 1 = end position) */
  pose: (t: number) => Pose;
  caption: string;
}

const standingHipY = GROUND - SEG.foot * 0.35 - SEG.thigh - SEG.shin;
const standingNeckY = standingHipY - SEG.torso;
const frontLegs = { legNear: { upper: 93, lower: 92, end: 180 }, legFar: { upper: 87, lower: 88, end: 0 } };
const hang: LimbPose = { upper: 92, lower: 90, end: 90 };
const straightDown = (lean = 0): LimbPose => ({ upper: 90 + lean, lower: 90 + lean, end: 0 });

export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {
  // Static quads (CUH): lying on the back, other knee bent with the foot flat;
  // the straight knee is pressed into the floor and the ankle pulled up
  ex_static_quads: {
    slug: 'ex_static_quads',
    view: 'side',
    measurement: 'knee',
    props: { mat: true },
    frame: { y: 126, h: 82 },
    caption: 'Lying on your back, tighten the thigh and press the back of the knee down',
    pose: (t) => {
      const hip = { x: 112, y: GROUND - 10 };
      const bend = lerp(10, 0, t); // relaxed knee slightly off the floor → pressed flat
      const footFar = { x: hip.x + 62, y: GROUND - 4 };
      const far = twoBone(hip, footFar, SEG.thigh, SEG.shin, -1);
      return {
        view: 'side',
        hip,
        torso: 180,
        head: 180,
        armNear: { upper: 4, lower: 2, end: 0 },
        armFar: { upper: 6, lower: 4, end: 0 },
        legNear: { upper: -bend / 2, lower: bend / 2, end: lerp(-35, -95, t) },
        legFar: { upper: far.a1, lower: far.a2, end: 0, lowerTo: footFar },
      };
    },
  },

  // Cross-body stretch (front view): the straight arm is brought across the
  // chest at shoulder height; the other forearm folds in to hold it
  ex_cross_body_shoulder_stretch: {
    slug: 'ex_cross_body_shoulder_stretch',
    view: 'front',
    measurement: 'shoulder',
    props: {},
    unilateral: true,
    caption: 'Bring the straight arm across the chest, hold it in with the other arm',
    pose: (t) => {
      const hip = { x: 130, y: standingHipY };
      const shoulderNear = { x: hip.x - SEG.shoulderHalf, y: standingNeckY };
      const shoulderFar = { x: hip.x + SEG.shoulderHalf, y: standingNeckY };
      const arm = lerp(96, -4, t); // hanging → across the chest, pointing to the other side
      // Helping hand: from hanging to the stretched arm's forearm
      const hang = add(shoulderFar, dir(84), SEG.upperArm + SEG.forearm);
      const contact = add(shoulderNear, dir(arm), SEG.upperArm + SEG.forearm * 0.5);
      const reach = { x: lerp(hang.x, contact.x, t), y: lerp(hang.y, contact.y + 3, t) };
      const help = twoBone(shoulderFar, reach, SEG.upperArm, SEG.forearm, 1);
      return {
        view: 'front',
        hip,
        torso: -90,
        head: -90,
        armNear: { upper: arm, lower: arm, end: arm },
        armFar: { upper: help.a1, lower: help.a2, end: help.a2 },
        ...frontLegs,
      };
    },
  },

  // Standing (front view), one arm raised out to the side to shoulder height
  ex_shoulder_abduction: {
    slug: 'ex_shoulder_abduction',
    view: 'front',
    measurement: 'shoulder',
    props: {},
    unilateral: true,
    caption: 'Standing tall, raise one straight arm out to the side',
    pose: (t) => {
      const a = lerp(6, 80, t); // hips narrower than shoulders → measured ≈ a + 10°
      return {
        view: 'front',
        hip: { x: 130, y: standingHipY },
        torso: -90,
        head: -90,
        armNear: { upper: 90 + a, lower: 90 + a, end: 90 + a },
        armFar: { upper: 84, lower: 84, end: 84 },
        ...frontLegs,
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

  // Front view (Powell Orthopedics): arms out at shoulder height, the hands
  // trace circles that grow from tiny to large, then reverse direction
  ex_arm_circles: {
    slug: 'ex_arm_circles',
    view: 'front',
    measurement: 'shoulder',
    props: {},
    continuous: true,
    cycle: 8,
    caption: 'Arms out at shoulder height, circles growing from small to large, then reverse',
    guides: (t) => {
      const c = armCircle(t);
      return [
        { center: c.near, radius: c.radius, at: c.angle, turn: c.turn },
        { center: c.far, radius: c.radius, at: 180 - c.angle, turn: (-c.turn) as 1 | -1 },
      ];
    },
    pose: (t) => {
      const c = armCircle(t);
      const wristNear = add(c.near, dir(c.angle), c.radius);
      const wristFar = add(c.far, dir(180 - c.angle), c.radius);
      const toNear = angleOf(sub(wristNear, c.shoulderNear));
      const toFar = angleOf(sub(wristFar, c.shoulderFar));
      return {
        view: 'front',
        hip: { x: 130, y: standingHipY },
        torso: -90,
        head: -90,
        armNear: { upper: toNear, lower: toNear, end: toNear, lowerTo: wristNear },
        armFar: { upper: toFar, lower: toFar, end: toFar, lowerTo: wristFar },
        ...frontLegs,
      };
    },
  },
};

/**
 * Arm circles: three forward circles growing 4 → 18 px, then three backward
 * circles shrinking again (continuous at both ends of the loop). The near
 * hand's circle angle starts and peaks at the top (−90°).
 */
function armCircle(t: number) {
  const reach = SEG.upperArm + SEG.forearm;
  const shoulderNear = { x: 130 - SEG.shoulderHalf, y: standingNeckY };
  const shoulderFar = { x: 130 + SEG.shoulderHalf, y: standingNeckY };
  const forward = t < 0.5;
  const u = forward ? t * 2 : (t - 0.5) * 2;
  return {
    shoulderNear,
    shoulderFar,
    near: { x: shoulderNear.x - reach, y: shoulderNear.y },
    far: { x: shoulderFar.x + reach, y: shoulderFar.y },
    radius: forward ? lerp(4, 18, u) : lerp(18, 4, u),
    angle: forward ? -90 + 1080 * u : -90 - 1080 * u,
    turn: (forward ? 1 : -1) as 1 | -1,
  };
}

// ─── Timeline ───────────────────────────────────────────────────────

const easeInOut = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Hold start → move → hold end → return → short rest (seconds) */
export const DEMO_PHASES = { holdStart: 0.7, move: 1.5, holdEnd: 1.0, back: 1.5, rest: 0.4 };
export const DEMO_CYCLE = Object.values(DEMO_PHASES).reduce((a, b) => a + b, 0);
export const CONTINUOUS_CYCLE = 4;

/** Progress (0 = start, 1 = end) at time `sec` within a looping demo */
export function demoProgress(demo: ExerciseDemo, sec: number): number {
  if (demo.continuous) {
    const cycle = demo.cycle ?? CONTINUOUS_CYCLE;
    return (sec % cycle) / cycle;
  }
  let t = sec % DEMO_CYCLE;
  const p = DEMO_PHASES;
  if ((t -= p.holdStart) < 0) return 0;
  if (t < p.move) return easeInOut(t / p.move);
  if ((t -= p.move) < p.holdEnd) return 1;
  if ((t -= p.holdEnd) < p.back) return 1 - easeInOut(t / p.back);
  return 0;
}
