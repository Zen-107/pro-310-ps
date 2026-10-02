import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';

// Threads visible to the caller with last message and unread count
// (clinician: every care-team patient; patient: their own thread).
export async function GET() {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  try {
    const patients = await db.patient.findMany({
      where: patientScope(auth.user),
      select: {
        id: true,
        name: true,
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
        return {
          patientId: p.id,
          patientName: p.name,
          unread,
          lastMessage: last
            ? { body: last.body.slice(0, 120), createdAt: last.createdAt.toISOString(), mine: last.senderId === me }
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
