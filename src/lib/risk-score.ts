// Early-warning score: which patients may need the care team's attention
// soon, and why. Points-based and fully explainable: every point comes from
// a named factor the clinician can check in the patient's data.
//
// This is NOT a validated prediction of re-injury or treatment failure. The
// factors and weights are clinical heuristics chosen by the development team
// (pending physiotherapist review). Predicting outcomes needs recorded
// outcomes: clinicians record one when a plan ends (Prescription.outcome), and
// GET /api/analytics/dataset exports features + outcomes so a model can be
// trained and validated once enough real cases exist.

import type { ForecastStatus } from '@/lib/recovery-forecast';

export type RiskLevel = 'low' | 'moderate' | 'high';

export type RiskFactorCode =
  | 'red_flag_symptoms'
  | 'recovery_declining'
  | 'recovery_plateau'
  | 'slow_responder'
  | 'low_adherence'
  | 'inactive'
  | 'form_worsening'
  | 'low_accuracy';

export interface RiskFactor {
  code: RiskFactorCode;
  points: number;
  /** Thai explanation for clinicians */
  label: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
}

export const RISK = {
  MODERATE_FROM: 3,
  HIGH_FROM: 5,
  RED_FLAG_WINDOW_DAYS: 14,
  INACTIVE_DAYS: 7,
  ADHERENCE_LOW: 50, // %
  ADHERENCE_FAIR: 75, // %
  LOW_ACCURACY: 50, // %
  LOW_ACCURACY_MIN_SESSIONS: 3,
  FORM_POINTS_CAP: 2,
};

export interface RiskInput {
  /** Escalated (red-flag) patient messages in the last RED_FLAG_WINDOW_DAYS */
  redFlagMessages: number;
  forecasts: {
    exerciseTh: string;
    status: ForecastStatus;
    adherence: number | null;
    slowResponder: boolean;
    fasterThanPercent: number | null;
  }[];
  /** Overall share (%) of due quests completed in the last 28 days; null = none due */
  adherence: number | null;
  /** Days since the last completed session; null = never trained */
  daysSinceLastSession: number | null;
  hasActivePlan: boolean;
  trends: { exerciseTh: string; flags: string[]; sessions: number; lastAccuracy: number }[];
}

const FORM_FLAGS: Record<string, string> = {
  compensation_increasing: 'ท่าชดเชยเพิ่มขึ้น',
  accuracy_declining: 'ความแม่นยำลดลง',
  rom_declining: 'ROM ลดลง',
  incomplete_rom_increasing: 'ทำไม่สุดระยะบ่อยขึ้น',
};

export function assessRisk(input: RiskInput): RiskAssessment {
  const factors: RiskFactor[] = [];

  if (input.redFlagMessages > 0) {
    factors.push({
      code: 'red_flag_symptoms',
      points: 3,
      label: `แจ้งอาการที่ต้องประเมินผ่านแชท ${input.redFlagMessages} ครั้งใน ${RISK.RED_FLAG_WINDOW_DAYS} วัน`,
    });
  }

  const declining = input.forecasts.filter((f) => f.status === 'declining');
  const plateau = input.forecasts.filter((f) => f.status === 'plateau');
  if (declining.length) {
    factors.push({ code: 'recovery_declining', points: 4, label: `มุมที่ทำได้แย่ลงอย่างมีนัย: ${names(declining)}` });
  } else if (plateau.length) {
    factors.push({ code: 'recovery_plateau', points: 3, label: `พัฒนาการหยุดนิ่ง ≥ 14 วัน: ${names(plateau)}` });
  }

  const slow = input.forecasts.filter((f) => f.slowResponder && f.status !== 'declining' && f.status !== 'plateau');
  if (slow.length) {
    const pct = Math.min(...slow.map((f) => f.fasterThanPercent ?? 0));
    factors.push({ code: 'slow_responder', points: 1, label: `ฟื้นตัวช้ากว่าผู้ป่วยส่วนใหญ่ที่ฝึกท่าเดียวกัน (เร็วกว่าเพียง ${pct}%): ${names(slow)}` });
  }

  if (input.hasActivePlan && input.adherence !== null && input.adherence < RISK.ADHERENCE_FAIR) {
    const low = input.adherence < RISK.ADHERENCE_LOW;
    factors.push({ code: 'low_adherence', points: low ? 2 : 1, label: `ฝึกตามแผน 28 วันเพียง ${input.adherence}%` });
  }

  if (input.hasActivePlan && input.daysSinceLastSession !== null && input.daysSinceLastSession >= RISK.INACTIVE_DAYS) {
    factors.push({ code: 'inactive', points: 2, label: `ไม่ได้ฝึกมา ${input.daysSinceLastSession} วัน` });
  }

  const form = input.trends.flatMap((t) => t.flags.filter((f) => f in FORM_FLAGS).map((f) => `${t.exerciseTh}: ${FORM_FLAGS[f]}`));
  if (form.length) {
    factors.push({ code: 'form_worsening', points: Math.min(RISK.FORM_POINTS_CAP, form.length), label: form.slice(0, 3).join(' · ') });
  }

  const lowAcc = input.trends.filter((t) => t.sessions >= RISK.LOW_ACCURACY_MIN_SESSIONS && t.lastAccuracy > 0 && t.lastAccuracy < RISK.LOW_ACCURACY);
  if (lowAcc.length) {
    factors.push({ code: 'low_accuracy', points: 1, label: `ความแม่นยำล่าสุดต่ำกว่า ${RISK.LOW_ACCURACY}%: ${lowAcc.map((t) => `${t.exerciseTh} ${t.lastAccuracy}%`).join(', ')}` });
  }

  factors.sort((a, b) => b.points - a.points);
  const score = factors.reduce((a, f) => a + f.points, 0);
  const level: RiskLevel = score >= RISK.HIGH_FROM ? 'high' : score >= RISK.MODERATE_FROM ? 'moderate' : 'low';
  return { level, score, factors };
}

const names = (list: { exerciseTh: string }[]) => list.map((f) => f.exerciseTh).join(', ');
