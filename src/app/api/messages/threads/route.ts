import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';
import { safeTruncate } from '@/lib/text-safe';
import { CHAT } from '@/lib/roles';
import { childHasConsent } from '@/lib/terms';
import { hasValidVideoConsent } from '@/lib/consent';

// Chat threads (one per child) for the expert or a parent, with who the child
// is and who is in the conversation: the parents who registered for the child
// and the expert(s). Last message and unread count per thread.
export async function GET() {
  const auth = await requireApiUser(CHAT);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  try {
    const patients = await db.patient.findMany({
      where: patientScope(auth.user),
      select: {
        id: true,
        name: true,
        nickname: true,
        avatar: true,
        dateOfBirth: true,
        consentVersion: true,
        consentAt: true,
        schoolConsentAt: true,
        videoConsentAt: true,
        videoConsentVersion: true,
        classrooms: { select: { classroom: { select: { name: true, archivedAt: true, teacher: { select: { user: { select: { name: true } } } } } } } },
        careAssignments: {
          where: { role: { in: ['GUARDIAN', 'PRIMARY', 'SUPPORTING'] } },
          select: { role: true, assignedAt: true, clinician: { select: { user: { select: { id: true, name: true, email: true } } } } },
          orderBy: { assignedAt: 'asc' },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, senderId: true } },
        threadReads: { where: { userId: me }, select: { lastReadAt: true } },
      },
      orderBy: { name: 'asc' },
    });

    const threads = await Promise.all(
      patients.map(async (p) => {
        const lastReadAt = p.threadReads[0]?.lastReadAt ?? new Date(0);
        const unread = await db.careMessage.count({
          where: { patientId: p.id, senderId: { not: me }, createdAt: { gt: lastReadAt } },
        });
        const last = p.messages[0];
        const person = (a: (typeof p.careAssignments)[number]) => ({
          id: a.clinician.user.id,
          name: a.clinician.user.name,
          email: a.clinician.user.email,
          since: a.assignedAt.toISOString(),
          me: a.clinician.user.id === me,
        });
        const room = p.classrooms.find((c) => !c.classroom.archivedAt)?.classroom ?? null;
        return {
          patientId: p.id,
          patientName: p.name,
          nickname: p.nickname,
          avatar: p.avatar,
          dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
          classroom: room ? { name: room.name, teacher: room.teacher.user.name } : null,
          parents: p.careAssignments.filter((a) => a.role === 'GUARDIAN').map(person),
          experts: p.careAssignments.filter((a) => a.role !== 'GUARDIAN').map(person),
          consent: { canPlay: childHasConsent(p), video: hasValidVideoConsent(p) },
          unread,
          lastMessage: last
            ? { body: safeTruncate(last.body, 120), createdAt: last.createdAt.toISOString(), mine: last.senderId === me }
            : null,
        };
      })
    );

    // Most recent activity first
    threads.sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
    return NextResponse.json({ threads, totalUnread: threads.reduce((sum, t) => sum + t.unread, 0) });
  } catch (error) {
    return serverError('Message threads GET error', error);
  }
}
