import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope, sessionScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';
import { safeTruncate } from '@/lib/text-safe';
import { predictPatients } from '@/lib/predictive';

// Clinician dashboard headline numbers, scoped to the caller's care team:
// sessions completed today, sessions awaiting review, red flags (symptoms
// the patient assistant escalated in the last 7 days), recovery alerts
// (exercises whose progress has plateaued or is declining) and the
// early-warning risk score of every patient in the care team (lib/risk-score.ts).
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

    // Forecasts + risk for every patient in the care team (reference rates loaded once per organization)
    const inScope = await db.patient.findMany({ where: patientScope(auth.user), select: { id: true, name: true, organizationId: true } });
    const predictions = await predictPatients(inScope);
    const recoveryAlerts = inScope.flatMap((p) =>
      (predictions.get(p.id)?.forecasts ?? [])
        .filter((f) => f.forecast.status === 'plateau' || f.forecast.status === 'declining')
        .map((f) => ({ patientId: p.id, patientName: p.name, exerciseTh: f.exerciseTh, status: f.forecast.status, currentDeficit: f.forecast.currentDeficit }))
    );
    const risks = inScope
      .map((p) => ({ patientId: p.id, patientName: p.name, ...predictions.get(p.id)!.risk }))
      .filter((r) => r.level !== 'low')
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      completedToday,
      pendingReviews,
      redFlags: [...redFlags.values()],
      redFlagWindowDays: RED_FLAG_WINDOW_DAYS,
      recoveryAlerts,
      risks,
    });
  } catch (error) {
    return serverError('Clinician summary error', error);
  }
}
