import type { Patient } from '@prisma/client';
import { db } from '@/lib/db';
import { computeStreak, patientBasics, totalMinutes } from '@/lib/presenters';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * List-level summary per patient (batched queries). `clinicalNotes` is
 * returned as `therapistNotes` for the existing clinician screens.
 */
export async function buildPatientSummaries(patients: Patient[]) {
  const ids = patients.map((p) => p.id);
  if (ids.length === 0) return [];

  const [sessions, items] = await Promise.all([
    db.exerciseSession.findMany({
      where: { patientId: { in: ids }, status: 'COMPLETED' },
      select: { patientId: true, startedAt: true, endedAt: true, avgAccuracy: true, totalReps: true },
      orderBy: { startedAt: 'desc' },
    }),
    db.prescriptionItem.findMany({
      where: { prescription: { patientId: { in: ids }, status: 'ACTIVE' } },
      select: { exerciseId: true, prescription: { select: { patientId: true } } },
    }),
  ]);

  const since7d = Date.now() - 7 * DAY_MS;
  return patients.map((p) => {
    const mine = sessions.filter((s) => s.patientId === p.id);
    return {
      ...patientBasics(p),
      therapistNotes: p.clinicalNotes ?? '',
      assignedExerciseIds: [...new Set(items.filter((i) => i.prescription.patientId === p.id).map((i) => i.exerciseId))],
      streak: computeStreak(mine),
      totalMinutes: totalMinutes(mine),
      totalSessions: mine.length,
      recentSessions7d: mine.filter((s) => s.startedAt.getTime() >= since7d).length,
      latestAccuracy: mine[0] ? Math.round(mine[0].avgAccuracy) : 0,
      lastActiveAt: mine[0]?.startedAt.toISOString() ?? null,
    };
  });
}
