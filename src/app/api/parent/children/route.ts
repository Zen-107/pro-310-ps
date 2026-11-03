import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';
import { hasValidVideoConsent } from '@/lib/consent';
import { dateOnly, localDateString } from '@/lib/dates';
import { computeStreak } from '@/lib/presenters';
import { childHasConsent, TERMS_VERSION } from '@/lib/terms';
import { starsFor } from '@/lib/kids';

// The signed-in parent's children: today's missions, streak, week stars, consent and class
export async function GET() {
  const auth = await requireApiUser(['PARENT']);
  if ('response' in auth) return auth.response;
  try {
    const today = dateOnly(localDateString());
    const since = new Date(Date.now() - 7 * 86_400_000);
    const kids = await db.patient.findMany({
      where: patientScope(auth.user),
      include: {
        quests: { where: { dueDate: today }, select: { status: true } },
        sessions: {
          where: { status: 'COMPLETED' },
          select: { startedAt: true, avgAccuracy: true, totalReps: true },
          orderBy: { startedAt: 'desc' },
          take: 60,
        },
        classrooms: {
          where: { classroom: { archivedAt: null } },
          select: { classroom: { select: { name: true, teacher: { select: { user: { select: { name: true } } } } } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(
      kids.map((k) => {
        const week = k.sessions.filter((s) => s.startedAt >= since);
        const weekAccuracy = week.length ? week.reduce((a, s) => a + s.avgAccuracy, 0) / week.length : null;
        const cls = k.classrooms[0]?.classroom;
        return {
          id: k.id,
          name: k.name,
          nickname: k.nickname,
          avatar: k.avatar,
          className: cls?.name ?? null,
          teacherName: cls?.teacher.user.name ?? null,
          today: { total: k.quests.length, done: k.quests.filter((q) => q.status === 'COMPLETED').length },
          streak: computeStreak(k.sessions),
          totalSessions: k.sessions.length,
          sessions7d: week.length,
          accuracy7d: weekAccuracy === null ? null : Math.round(weekAccuracy),
          stars7d: weekAccuracy === null ? null : starsFor(weekAccuracy),
          lastPlayedAt: k.sessions[0]?.startedAt.toISOString() ?? null,
          consent: {
            canPlay: childHasConsent(k),
            terms: k.consentVersion === TERMS_VERSION,
            schoolConsent: k.schoolConsentAt !== null,
            video: hasValidVideoConsent(k),
          },
        };
      })
    );
  } catch (error) {
    return serverError('Parent children GET error', error);
  }
}
