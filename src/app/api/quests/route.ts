import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, notFound, serverError } from '@/lib/api-utils';
import { addDays, dateOnly, dateOnlyString, localDateString } from '@/lib/dates';
import { ensureQuestsForDay } from '@/lib/quests';

// Quest history / adherence for the last ?days (default 14, max 90).
// Patients get their own; clinicians pass ?patientId.
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const patientId = auth.user.role === 'PATIENT' ? auth.user.patientId : req.nextUrl.searchParams.get('patientId');
  if (!patientId) return badRequest('patientId is required');
  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '14', 10) || 14));
  const today = localDateString();

  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    // Keep statuses current (marks past unfinished quests as MISSED)
    await ensureQuestsForDay(patientId, today);

    const quests = await db.quest.findMany({
      where: { patientId, dueDate: { gte: dateOnly(addDays(today, -(days - 1))), lte: dateOnly(today) } },
      include: {
        prescriptionItem: { select: { exercise: { select: { id: true, name: true, nameTh: true, category: true } } } },
        sessions: { select: { id: true, status: true, avgAccuracy: true, totalReps: true }, orderBy: { startedAt: 'desc' } },
      },
      orderBy: { dueDate: 'desc' },
    });

    const list = quests.map((q) => ({
      id: q.id,
      dueDate: dateOnlyString(q.dueDate),
      status: q.status,
      completedAt: q.completedAt?.toISOString() ?? null,
      exercise: q.prescriptionItem.exercise,
      sessions: q.sessions.map((s) => ({ ...s, avgAccuracy: Math.round(s.avgAccuracy) })),
    }));
    // Adherence over days that are already over or completed today
    const finished = list.filter((q) => q.status === 'COMPLETED' || q.status === 'MISSED');
    return NextResponse.json({
      from: addDays(today, -(days - 1)),
      to: today,
      adherence: finished.length ? Math.round((finished.filter((q) => q.status === 'COMPLETED').length / finished.length) * 100) : null,
      quests: list,
    });
  } catch (error) {
    return serverError('Quests GET error', error);
  }
}
