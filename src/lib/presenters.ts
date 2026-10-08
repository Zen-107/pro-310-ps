// Shapes returned by the API. Field names stay compatible with the existing
// screens (e.g. `targetJoints`, `sets`, `maxRom`) while reading the new schema.
import type {
  Exercise,
  ExerciseJointTarget,
  ExerciseReference,
  ExerciseSession,
  ExerciseSource,
  Gender,
  PrescriptionTargetOverride,
} from '@prisma/client';
import { ageFromDob, localDateString } from '@/lib/dates';
import { parseFormChecks } from '@/lib/form-checks';
import { exerciseMeta } from '@/lib/exercises-data';
import { safeTruncate, sanitizeText } from '@/lib/text-safe';

// Display limits (grapheme clusters) for free text that reaches report screens
export const TEXT_LIMITS = { notes: 1000, condition: 300, faultMessage: 300, rationale: 600 } as const;

/** Thai-safe display text: sanitized, cut on grapheme boundaries; null stays null */
export function displayText(value: string | null | undefined, max: number): string | null {
  return value == null ? null : safeTruncate(value, max);
}

export const GENDER_LABEL_TH: Record<Gender, string> = {
  MALE: 'ชาย',
  FEMALE: 'หญิง',
  OTHER: 'อื่นๆ',
  UNSPECIFIED: 'ไม่ระบุ',
};

export interface TargetDTO {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  unit: '°';
  isPrimary: boolean;
  formula: string | null;
  angleBasis: string;
  rationale: string | null;
  /** true when a clinician override replaced the exercise default */
  overridden: boolean;
}

/** Exercise targets with a prescription item's per-joint overrides applied */
export function mergeTargets(
  targets: ExerciseJointTarget[],
  overrides: Pick<PrescriptionTargetOverride, 'joint' | 'idealAngle' | 'minAngle' | 'maxAngle'>[] = []
): TargetDTO[] {
  const byJoint = new Map(overrides.map((o) => [o.joint, o]));
  return [...targets]
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((t) => {
      const o = byJoint.get(t.joint);
      return {
        name: t.joint,
        nameTh: sanitizeText(t.nameTh),
        idealAngle: o?.idealAngle ?? t.idealAngle,
        minAngle: o?.minAngle ?? t.minAngle,
        maxAngle: o?.maxAngle ?? t.maxAngle,
        unit: '°',
        isPrimary: t.isPrimary,
        formula: t.formula,
        angleBasis: o ? 'CLINICIAN_SET' : t.angleBasis,
        rationale: displayText(t.rationale, TEXT_LIMITS.rationale),
        overridden: !!o,
      };
    });
}

type ExerciseWithRelations = Exercise & {
  targets: ExerciseJointTarget[];
  references?: (ExerciseReference & { source: ExerciseSource })[];
};

export function exerciseDTO(
  ex: ExerciseWithRelations,
  dose?: { sets: number; repsPerSet: number; restSeconds: number },
  overrides?: Parameters<typeof mergeTargets>[1]
) {
  return {
    id: ex.id,
    slug: ex.slug,
    name: ex.name,
    nameTh: ex.nameTh,
    category: ex.category,
    bodyPart: ex.bodyPart,
    difficulty: ex.difficulty,
    description: ex.description,
    instructions: Array.isArray(ex.instructions) ? (ex.instructions as string[]) : [],
    sets: dose?.sets ?? ex.defaultSets,
    repsPerSet: dose?.repsPerSet ?? ex.defaultReps,
    restSeconds: dose?.restSeconds ?? ex.defaultRestSeconds,
    icon: ex.icon,
    status: ex.status,
    formChecks: parseFormChecks(ex.formChecks),
    // Hold time / one side at a time (code-defined per slug, lib/exercises-data.ts)
    ...exerciseMeta(ex.slug),
    targetJoints: mergeTargets(ex.targets, overrides),
    references: (ex.references ?? []).map((r) => ({
      title: r.source.title,
      url: r.source.url,
      institution: r.source.institution,
      relevance: r.relevance,
      sourceExerciseName: r.sourceExerciseName,
      note: r.note,
      verificationStatus: r.source.verificationStatus,
      verifiedByType: r.source.verifiedByType,
      verifiedByName: r.source.verifiedByName,
    })),
  };
}

export const exerciseInclude = {
  targets: true,
  references: { include: { source: true } },
} as const;

type SessionWithExercise = ExerciseSession & {
  exercise?: Pick<Exercise, 'name' | 'nameTh' | 'category' | 'icon'> | null;
  review?: { status: string } | null;
  _count?: { faults: number };
};

export function sessionDTO(s: SessionWithExercise) {
  return {
    id: s.id,
    patientId: s.patientId,
    exerciseId: s.exerciseId,
    questId: s.questId,
    prescriptionId: s.prescriptionId,
    clinicianId: s.clinicianId,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    status: s.status,
    totalReps: s.totalReps,
    avgAccuracy: Math.round(s.avgAccuracy),
    maxRom: Math.round(s.romDegrees ?? 0),
    romMinAngle: s.romMinAngle,
    romMaxAngle: s.romMaxAngle,
    primaryJoint: s.primaryJoint,
    notes: displayText(s.notes, TEXT_LIMITS.notes),
    reviewStatus: s.review?.status ?? null,
    faultCount: s._count?.faults ?? null,
    exercise: s.exercise
      ? { name: s.exercise.name, nameTh: s.exercise.nameTh, category: s.exercise.category, icon: s.exercise.icon }
      : undefined,
  };
}

// ─── Patient statistics ───────────────────────────────────────────

export interface CompletedSessionLite {
  startedAt: Date;
  endedAt: Date | null;
  avgAccuracy: number;
  totalReps: number;
}

/** Consecutive days with a completed session, ending today or yesterday */
export function computeStreak(sessions: Pick<CompletedSessionLite, 'startedAt'>[]): number {
  const days = new Set(sessions.map((s) => localDateString(s.startedAt)));
  if (days.size === 0) return 0;
  const cursor = new Date();
  if (!days.has(localDateString(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(localDateString(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function totalMinutes(sessions: CompletedSessionLite[]): number {
  const ms = sessions.reduce((sum, s) => sum + (s.endedAt ? s.endedAt.getTime() - s.startedAt.getTime() : 0), 0);
  return Math.round(ms / 60000);
}

export function patientBasics(p: {
  id: string;
  name: string;
  hn?: string | null;
  dateOfBirth: Date | null;
  gender: Gender;
  condition: string | null;
  phone: string | null;
}) {
  return {
    id: p.id,
    name: p.name,
    hn: p.hn ?? null,
    age: ageFromDob(p.dateOfBirth),
    dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10) ?? null,
    gender: GENDER_LABEL_TH[p.gender],
    genderCode: p.gender,
    condition: displayText(p.condition, TEXT_LIMITS.condition) ?? '',
    phone: p.phone ?? '',
  };
}
