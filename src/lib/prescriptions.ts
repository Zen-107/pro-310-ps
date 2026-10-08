import type { JointName, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dateOnlyString } from '@/lib/dates';
import { isFiniteNumber, isIntInRange, optionalString } from '@/lib/api-utils';
import { mergeTargets } from '@/lib/presenters';

export const prescriptionInclude = {
  clinician: { select: { id: true, title: true, user: { select: { name: true } } } },
  items: {
    orderBy: { sortOrder: 'asc' },
    include: {
      targetOverrides: true,
      exercise: { include: { targets: true } },
    },
  },
} satisfies Prisma.PrescriptionInclude;

type PrescriptionWithRelations = Prisma.PrescriptionGetPayload<{ include: typeof prescriptionInclude }>;

export function prescriptionDTO(p: PrescriptionWithRelations) {
  return {
    id: p.id,
    patientId: p.patientId,
    title: p.title,
    notes: p.notes,
    status: p.status,
    outcome: p.outcome,
    outcomeNote: p.outcomeNote,
    outcomeAt: p.outcomeAt?.toISOString() ?? null,
    startDate: dateOnlyString(p.startDate),
    endDate: p.endDate ? dateOnlyString(p.endDate) : null,
    createdAt: p.createdAt.toISOString(),
    clinician: { id: p.clinician.id, name: p.clinician.user.name, title: p.clinician.title },
    items: p.items.map((i) => ({
      id: i.id,
      exerciseId: i.exerciseId,
      sets: i.sets,
      repsPerSet: i.repsPerSet,
      restSeconds: i.restSeconds,
      daysOfWeek: i.daysOfWeek,
      sortOrder: i.sortOrder,
      notes: i.notes,
      exercise: {
        id: i.exercise.id,
        slug: i.exercise.slug,
        name: i.exercise.name,
        nameTh: i.exercise.nameTh,
        category: i.exercise.category,
        difficulty: i.exercise.difficulty,
        icon: i.exercise.icon,
      },
      targets: mergeTargets(i.exercise.targets, i.targetOverrides),
    })),
  };
}

export interface OverrideInput {
  joint: JointName;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
}

export interface ItemInput {
  exerciseId?: string;
  sets?: number;
  repsPerSet?: number;
  restSeconds?: number;
  daysOfWeek?: number[];
  sortOrder?: number;
  notes?: string | null;
  targetOverrides?: OverrideInput[];
}

type Validated = { ok: true; value: ItemInput } | { ok: false; error: string };

/**
 * Validate a prescription item body. On create (`existingExerciseId` absent)
 * exerciseId is required and must be PUBLISHED; omitted dose fields default
 * to the exercise's defaults. Overrides must target the exercise's joints and
 * satisfy min ≤ ideal ≤ max.
 */
export async function validateItemInput(body: Record<string, unknown>, existingExerciseId?: string): Promise<Validated> {
  const exerciseId = existingExerciseId ?? (typeof body.exerciseId === 'string' ? body.exerciseId : undefined);
  if (!exerciseId) return { ok: false, error: 'exerciseId is required' };

  const exercise = await db.exercise.findUnique({ where: { id: exerciseId }, include: { targets: true } });
  if (!exercise) return { ok: false, error: 'Exercise not found' };
  if (!existingExerciseId && exercise.status !== 'PUBLISHED') {
    return { ok: false, error: 'Only PUBLISHED exercises can be prescribed' };
  }

  const value: ItemInput = {};
  if (!existingExerciseId) {
    value.exerciseId = exerciseId;
    value.sets = exercise.defaultSets;
    value.repsPerSet = exercise.defaultReps;
    value.restSeconds = exercise.defaultRestSeconds;
    value.daysOfWeek = [];
  }

  if (body.sets !== undefined) {
    if (!isIntInRange(body.sets, 1, 20)) return { ok: false, error: 'sets must be an integer 1–20' };
    value.sets = body.sets;
  }
  if (body.repsPerSet !== undefined) {
    if (!isIntInRange(body.repsPerSet, 1, 100)) return { ok: false, error: 'repsPerSet must be an integer 1–100' };
    value.repsPerSet = body.repsPerSet;
  }
  if (body.restSeconds !== undefined) {
    if (!isIntInRange(body.restSeconds, 0, 600)) return { ok: false, error: 'restSeconds must be an integer 0–600' };
    value.restSeconds = body.restSeconds;
  }
  if (body.sortOrder !== undefined) {
    if (!isIntInRange(body.sortOrder, 0, 1000)) return { ok: false, error: 'sortOrder must be an integer 0–1000' };
    value.sortOrder = body.sortOrder;
  }
  if (body.daysOfWeek !== undefined) {
    const days = body.daysOfWeek;
    if (!Array.isArray(days) || !days.every((d) => isIntInRange(d, 0, 6))) {
      return { ok: false, error: 'daysOfWeek must be an array of integers 0 (Sun) – 6 (Sat)' };
    }
    value.daysOfWeek = [...new Set(days as number[])].sort();
  }
  if (body.notes !== undefined) value.notes = optionalString(body.notes) ?? null;

  if (body.targetOverrides !== undefined) {
    if (!Array.isArray(body.targetOverrides)) return { ok: false, error: 'targetOverrides must be an array' };
    const joints = new Set(exercise.targets.map((t) => t.joint));
    const seen = new Set<string>();
    const overrides: OverrideInput[] = [];
    for (const raw of body.targetOverrides as Record<string, unknown>[]) {
      const { joint, idealAngle, minAngle, maxAngle } = raw ?? {};
      if (typeof joint !== 'string' || !joints.has(joint as JointName)) {
        return { ok: false, error: `Override joint must be one of: ${[...joints].join(', ')}` };
      }
      if (seen.has(joint)) return { ok: false, error: `Duplicate override for ${joint}` };
      seen.add(joint);
      if (![idealAngle, minAngle, maxAngle].every((v) => isFiniteNumber(v) && v >= -180 && v <= 360)) {
        return { ok: false, error: `Override angles for ${joint} must be numbers between −180 and 360` };
      }
      if (!((minAngle as number) <= (idealAngle as number) && (idealAngle as number) <= (maxAngle as number))) {
        return { ok: false, error: `Override for ${joint} must satisfy minAngle ≤ idealAngle ≤ maxAngle` };
      }
      overrides.push({ joint: joint as JointName, idealAngle: idealAngle as number, minAngle: minAngle as number, maxAngle: maxAngle as number });
    }
    value.targetOverrides = overrides;
  }

  return { ok: true, value };
}
