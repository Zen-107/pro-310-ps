import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { dateOnly, dateOnlyString, dayOfWeek } from '@/lib/dates';
import { exerciseDTO, exerciseInclude } from '@/lib/presenters';
import { snapshotSide, type Side } from '@/lib/exercises-data';

/**
 * Create the quests due on `day` for a patient (idempotent) and mark earlier
 * unfinished quests as MISSED. Quests are generated lazily — no cron needed.
 */
export async function ensureQuestsForDay(patientId: string, day: string) {
  const date = dateOnly(day);

  await db.quest.updateMany({
    where: { patientId, dueDate: { lt: date }, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    data: { status: 'MISSED' },
  });

  const items = await db.prescriptionItem.findMany({
    where: {
      prescription: {
        patientId,
        status: 'ACTIVE',
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      exercise: { status: 'PUBLISHED' },
    },
    select: { id: true, daysOfWeek: true },
  });

  const dow = dayOfWeek(day);
  const due = items.filter((i) => i.daysOfWeek.length === 0 || i.daysOfWeek.includes(dow));
  if (due.length > 0) {
    await db.quest.createMany({
      data: due.map((i) => ({ prescriptionItemId: i.id, patientId, dueDate: date })),
      skipDuplicates: true,
    });
  }
}

export const questInclude = {
  // Completed sessions' snapshots: which sides of a one-side-at-a-time exercise are done
  sessions: { where: { status: 'COMPLETED' }, select: { targetSnapshot: true } },
  prescriptionItem: {
    include: {
      targetOverrides: true,
      exercise: { include: exerciseInclude },
      prescription: {
        select: {
          id: true,
          title: true,
          notes: true,
          status: true,
          clinicianId: true,
          clinician: { select: { title: true, user: { select: { name: true } } } },
        },
      },
    },
  },
} satisfies Prisma.QuestInclude;

type QuestWithRelations = Prisma.QuestGetPayload<{ include: typeof questInclude }>;

export function questDTO(q: QuestWithRelations) {
  const item = q.prescriptionItem;
  return {
    id: q.id,
    dueDate: dateOnlyString(q.dueDate),
    status: q.status,
    completedAt: q.completedAt?.toISOString() ?? null,
    sidesDone: [...new Set(q.sessions.map((s) => snapshotSide(s.targetSnapshot)).filter((x): x is Side => x !== null))],
    prescription: {
      id: item.prescription.id,
      title: item.prescription.title,
      notes: item.prescription.notes,
      clinicianName: item.prescription.clinician.user.name,
      clinicianTitle: item.prescription.clinician.title,
    },
    item: { id: item.id, sets: item.sets, repsPerSet: item.repsPerSet, restSeconds: item.restSeconds, notes: item.notes },
    exercise: exerciseDTO(item.exercise, item, item.targetOverrides),
  };
}
