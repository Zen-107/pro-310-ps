// Natural Thai coaching cues, phrased the way a physiotherapist talks to a
// patient ("ยกแขนขึ้นอีกนิดครับ") instead of reporting numbers ("ยกเพิ่ม 12°").
//
// The coach works on qualitative states (in range / a little short / far
// short / overshoot) so the AI never sees, and is never tempted to read out,
// degree values. localCue() gives a deterministic cue when the AI is
// unavailable or its answer is rejected by isSpeakable().

export interface CueTarget {
  name: string;
  nameTh: string;
  minAngle: number;
  maxAngle: number;
  idealAngle: number;
  isPrimary?: boolean;
}

export type CueState = 'in_range' | 'below_near' | 'below_far' | 'above_near' | 'above_far';

const NEAR_DEG = 10;

export function cueState(t: CueTarget, angle: number): CueState {
  if (angle < t.minAngle) return t.minAngle - angle <= NEAR_DEG ? 'below_near' : 'below_far';
  if (angle > t.maxAngle) return angle - t.maxAngle <= NEAR_DEG ? 'above_near' : 'above_far';
  return 'in_range';
}

const STATE_TH: Record<CueState, string> = {
  in_range: 'อยู่ในช่วงเป้าหมายแล้ว',
  below_near: 'ยังไม่ถึงเป้าหมาย ขาดอีกนิดเดียว',
  below_far: 'ยังห่างจากเป้าหมายพอสมควร',
  above_near: 'เกินเป้าหมายไปนิดหน่อย',
  above_far: 'เกินเป้าหมายไปมาก',
};

interface Phrases {
  /** angle below the range */
  below: string;
  /** angle above the range */
  above: string;
  /** in range: hold and return with control */
  hold: string;
}

// Keyed by measurement without the left_/right_ prefix. "below" / "above"
// refer to the measured angle, so knee (interior angle, 180 = straight) reads
// "below" as too bent.
const MEASUREMENT_PHRASES: Record<string, Phrases> = {
  shoulder: {
    below: 'ยกแขนขึ้นอีกนิดครับ',
    above: 'ลดแขนลงมาอีกหน่อยครับ',
    hold: 'ดีมากครับ เกร็งไหล่ไว้ แล้วค่อยๆ ลดแขนลงช้าๆ',
  },
  elbow: {
    below: 'เหยียดศอกให้ตรงขึ้นอีกนิดครับ',
    above: 'งอศอกเข้ามาอีกนิดครับ',
    hold: 'ดีครับ ค้างไว้สักครู่',
  },
  knee: {
    below: 'เหยียดเข่าขึ้นมาอีกนิดครับ',
    above: 'งอเข่าเพิ่มอีกนิดครับ',
    hold: 'ดีมากครับ ค้างไว้ แล้วค่อยๆ กลับท่าเดิม',
  },
  hip: {
    below: 'ดันสะโพกขึ้นอีกนิดครับ',
    above: 'ลดสะโพกลงนิดนึงครับ ไม่ต้องแอ่นหลัง',
    hold: 'ดีมากครับ เกร็งก้นค้างไว้ แล้วค่อยๆ ลดลง',
  },
  hip_flexion: {
    below: 'ยกขาขึ้นอีกนิดครับ เข่าเหยียดตรงไว้',
    above: 'ลดขาลงมานิดนึงครับ',
    hold: 'ดีครับ ค้างขาไว้ แล้วค่อยๆ วางลงช้าๆ',
  },
  hip_opening: {
    below: 'เปิดเข่าออกอีกนิดครับ เท้าชิดกันไว้',
    above: 'หุบเข่าเข้ามานิดนึงครับ',
    hold: 'ดีครับ ค้างไว้ แล้วค่อยๆ หุบเข่าลง',
  },
  hip_abduction: {
    below: 'กางขาออกอีกนิดครับ',
    above: 'ไม่ต้องกางสูงขนาดนั้นครับ ลดขาลงนิดนึง',
    hold: 'ดีครับ ลำตัวตรงไว้ แล้วค่อยๆ ลดขาลง',
  },
  trunk_lateral_flexion: {
    below: 'เอียงตัวลงไปอีกนิดครับ',
    above: 'เอียงน้อยลงหน่อยครับ ไม่ต้องฝืน',
    hold: 'ดีครับ ค้างไว้ แล้วค่อยๆ กลับมาตรง',
  },
  trunk_rotation: {
    below: 'บิดตัวไปอีกนิดครับ สะโพกอยู่กับที่',
    above: 'บิดน้อยลงหน่อยครับ ไม่ต้องฝืน',
    hold: 'ดีครับ ค้างไว้ แล้วค่อยๆ หมุนกลับ',
  },
  trunk_inclination: {
    below: 'ก้มตัวลงอีกนิดครับ',
    above: 'ยืดตัวขึ้นหน่อยครับ หลังตรง',
    hold: 'ดีครับ',
  },
};

// Exercise-specific wording (slug → measurement → phrases)
const EXERCISE_PHRASES: Record<string, Record<string, Partial<Phrases>>> = {
  ex_shoulder_abduction: { shoulder: { below: 'กางแขนกว้างขึ้นอีกนิดครับ', above: 'ลดแขนลงมาให้ขนานพื้นครับ' } },
  ex_arm_circles: { shoulder: { below: 'วาดวงแขนให้กว้างขึ้นอีกนิดครับ', hold: 'ดีมากครับ หมุนช้าๆ ต่อไปเลย' } },
  ex_squat: { knee: { above: 'ย่อตัวลงอีกนิดครับ', below: 'ไม่ต้องย่อต่ำขนาดนั้นครับ ยกตัวขึ้นนิดนึง', hold: 'ดีมากครับ หลังตรงไว้ แล้วดันส้นเท้ายืนขึ้น' } },
  ex_wall_squat: { knee: { above: 'เลื่อนตัวลงอีกนิดครับ', below: 'เลื่อนตัวขึ้นมานิดนึงครับ', hold: 'ดีมากครับ ค้างไว้ หายใจตามปกติ' } },
  ex_forward_lunge: { knee: { above: 'ย่อตัวลงอีกนิดครับ', below: 'ไม่ต้องย่อลึกขนาดนั้นครับ', hold: 'ดีมากครับ ลำตัวตรงไว้ แล้วดันกลับ' } },
  ex_side_lunge: { knee: { above: 'ย่อเข่าข้างที่ก้าวลงอีกนิดครับ', below: 'ไม่ต้องย่อลึกขนาดนั้นครับ', hold: 'ดีครับ ขาอีกข้างเหยียดตรงไว้' } },
  ex_knee_flexion: { knee: { above: 'ลากส้นเท้าเข้ามาอีกนิดครับ', below: 'ไม่ต้องงอมากขนาดนั้นครับ', hold: 'ดีครับ ค้างไว้ แล้วค่อยๆ เหยียดขากลับ' } },
};

const baseMeasurement = (name: string) => name.replace(/^(left|right)_/, '');

export function phrasesFor(slug: string | undefined, measurement: string): Phrases {
  const base = baseMeasurement(measurement);
  const generic = MEASUREMENT_PHRASES[base] ?? { below: 'ขยับเพิ่มอีกนิดครับ', above: 'ลดลงมานิดนึงครับ', hold: 'ดีครับ ค้างไว้' };
  return { ...generic, ...(slug ? EXERCISE_PHRASES[slug]?.[base] : undefined) };
}

export function phraseForState(slug: string | undefined, t: CueTarget, state: CueState): string {
  const p = phrasesFor(slug, t.name);
  if (state === 'in_range') return p.hold;
  const base = state.startsWith('below') ? p.below : p.above;
  return state.endsWith('near') ? `อีกนิดเดียวครับ ${base}` : base;
}

export interface JointCue {
  target: CueTarget;
  state: CueState;
  phrase: string;
}

/** Qualitative state + suggested phrase for every visible target joint, primary first */
export function jointCues(slug: string | undefined, targets: CueTarget[], angles: Record<string, number>): JointCue[] {
  return [...targets]
    .sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))
    .filter((t) => typeof angles[t.name] === 'number')
    .map((t) => {
      const state = cueState(t, angles[t.name]);
      return { target: t, state, phrase: phraseForState(slug, t, state) };
    });
}

/** One-line description for the AI prompt, with no numbers */
export function describeCue(c: JointCue): string {
  return `${c.target.nameTh}: ${STATE_TH[c.state]} (คำแนะนำที่เหมาะสม: "${c.phrase}")`;
}

const ENCOURAGEMENT = ['เยี่ยมเลยครับ ทำต่อไปแบบนี้', 'ดีมากครับ ทำช้าๆ แบบนี้แหละ', 'ท่าสวยครับ หายใจสม่ำเสมอนะครับ'];

/**
 * Deterministic cue: the joint furthest from its range gets the advice;
 * when everything is in range, the primary joint's hold cue or encouragement.
 */
export function localCue(slug: string | undefined, targets: CueTarget[], angles: Record<string, number>, seed = Date.now()): string {
  const cues = jointCues(slug, targets, angles);
  if (!cues.length) return 'ขยับให้กล้องเห็นทั้งตัวนะครับ แล้วเริ่มได้เลย';
  const rank: Record<CueState, number> = { below_far: 3, above_far: 3, below_near: 2, above_near: 2, in_range: 0 };
  const worst = cues.reduce((a, b) => (rank[b.state] > rank[a.state] ? b : a));
  if (worst.state !== 'in_range') return worst.phrase;
  return seed % 3 === 0 ? ENCOURAGEMENT[Math.floor(seed / 3) % ENCOURAGEMENT.length] : cues[0].phrase;
}

// Degree / percentage / number-of-degrees patterns that must never be spoken
const NUMERIC_ANGLE = /\d+(\.\d+)?\s*(°|องศา|deg|%|เปอร์เซ็นต์)|องศา/i;

/** true when coach text is safe to show and speak (no angle numbers, short) */
export function isSpeakable(text: string): boolean {
  return !!text.trim() && !NUMERIC_ANGLE.test(text) && text.length <= 220;
}
