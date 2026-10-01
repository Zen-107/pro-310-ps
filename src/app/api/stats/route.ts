import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, notFound, serverError } from '@/lib/api-utils';
import { localDateString } from '@/lib/dates';
import { computeStreak, totalMinutes } from '@/lib/presenters';

const DAY_MS = 24 * 60 * 60 * 1000;

// Progress statistics for one patient over ?days (default 30, max 365).
// Patients get their own; clinicians pass ?patientId.
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const patientId = auth.user.role === 'PATIENT' ? auth.user.patientId : req.nextUrl.searchParams.get('patientId');
  if (!patientId) return badRequest('patientId is required');
  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));

  try {
    const patient = await db.patient.findFirst({ where: { AND: [{ id: patientId }, patientScope(auth.user)] } });
    if (!patient) return notFound('Patient not found');

    const allCompleted = await db.exerciseSession.findMany({
      where: { patientId, status: 'COMPLETED' },
      orderBy: { startedAt: 'asc' },
      include: { exercise: { select: { nameTh: true, category: true } } },
    });
    const since = Date.now() - days * DAY_MS;
    const inRange = allCompleted.filter((s) => s.startedAt.getTime() >= since);

    const daily = new Map<string, { date: string; sessions: number; accuracySum: number; reps: number; minutes: number; exercises: string[] }>();
    for (const s of inRange) {
      const date = localDateString(s.startedAt);
      const d = daily.get(date) ?? { date, sessions: 0, accuracySum: 0, reps: 0, minutes: 0, exercises: [] };
      d.sessions += 1;
      d.accuracySum += s.avgAccuracy;
      d.reps += s.totalReps;
      d.minutes += s.endedAt ? (s.endedAt.getTime() - s.startedAt.getTime()) / 60000 : 0;
      d.exercises.push(s.exercise.nameTh);
      daily.set(date, d);
    }
    const dailyData = [...daily.values()].map(({ accuracySum, ...d }) => {
      const accuracy = Math.round((accuracySum / d.sessions) * 10) / 10;
      return { ...d, minutes: Math.round(d.minutes), accuracy, avgAccuracy: accuracy };
    });

    const categoryCounts = new Map<string, number>();
    for (const s of inRange) categoryCounts.set(s.exercise.category, (categoryCounts.get(s.exercise.category) ?? 0) + 1);

    const avgAccuracy = inRange.length ? inRange.reduce((sum, s) => sum + s.avgAccuracy, 0) / inRange.length : 0;
    const last = allCompleted[allCompleted.length - 1];

    return NextResponse.json({
      profile: {
        id: patient.id,
        name: patient.name,
        streak: computeStreak(allCompleted),
        totalSessions: allCompleted.length,
        totalMinutes: totalMinutes(allCompleted),
        lastActiveAt: last?.startedAt.toISOString() ?? null,
      },
      dailyData,
      totalSessions: inRange.length,
      avgAccuracy: Math.round(avgAccuracy),
      totalReps: inRange.reduce((sum, s) => sum + s.totalReps, 0),
      categoryData: [...categoryCounts.entries()].map(([category, count]) => ({ category, count })),
      romData: allCompleted.slice(-30).map((s) => ({
        date: localDateString(s.startedAt),
        exercise: s.exercise.nameTh,
        joint: s.primaryJoint,
        rom: Math.round(s.romDegrees ?? 0),
        accuracy: Math.round(s.avgAccuracy),
      })),
    });
  } catch (error) {
    return serverError('Stats error', error);
  }
}
