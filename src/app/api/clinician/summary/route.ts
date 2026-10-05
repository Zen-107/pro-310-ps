import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope, sessionScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';
import { safeTruncate } from '@/lib/text-safe';
import { computeRecoveryForecasts } from '@/lib/ai-agent';

// Clinician dashboard headline numbers, scoped to the caller's care team:
// sessions completed today, sessions awaiting review, red flags (symptoms
// the patient assistant escalated in the last 7 days) and recovery alerts
// (exercises whose progress has plateaued or is declining).
const RED_FLAG_WINDOW_DAYS = 7;

export async function GET() {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = new Date(Date.now() - RED_FLAG_WINDOW_DAYS * 86_400_000);
  const scope = sessionScope(auth.user);

  try {
    const [completedToday, pendingReviews, escalations] = await Promise.all([
      db.exerciseSession.count({ where: { AND: [scope, { status: 'COMPLETED', startedAt: { gte: todayStart } }] } }),
      db.exerciseSession.count({ where: { AND: [scope, { status: 'COMPLETED', review: { is: null } }] } }),
      db.careMessage.findMany({
        where: { escalated: true, createdAt: { gte: since }, patient: patientScope(auth.user) },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { patientId: true, body: true, createdAt: true, patient: { select: { name: true } } },
      }),
    ]);

    // Latest escalation per patient
    const redFlags = new Map<string, { patientId: string; patientName: string; message: string; at: string; count: number }>();
    for (const m of escalations) {
      const existing = redFlags.get(m.patientId);
      if (existing) existing.count++;
      else
        redFlags.set(m.patientId, {
          patientId: m.patientId,
          patientName: m.patient.name,
          message: safeTruncate(m.body, 90),
          at: m.createdAt.toISOString(),
          count: 1,
        });
    }

    // Recovery alerts: patients in scope who trained in the forecast window
    const active = await db.patient.findMany({
      where: { AND: [patientScope(auth.user), { sessions: { some: { status: 'COMPLETED', startedAt: { gte: new Date(Date.now() - 90 * 86_400_000) } } } }] },
      select: { id: true, name: true },
    });
    const recoveryAlerts = (
      await Promise.all(
        active.map(async (p) =>
          (await computeRecoveryForecasts(p.id))
            .filter((f) => f.forecast.status === 'plateau' || f.forecast.status === 'declining')
            .map((f) => ({ patientId: p.id, patientName: p.name, exerciseTh: f.exerciseTh, status: f.forecast.status, currentDeficit: f.forecast.currentDeficit }))
        )
      )
    ).flat();

    return NextResponse.json({
      completedToday,
      pendingReviews,
      redFlags: [...redFlags.values()],
      redFlagWindowDays: RED_FLAG_WINDOW_DAYS,
      recoveryAlerts,
    });
  } catch (error) {
    return serverError('Clinician summary error', error);
  }
}
