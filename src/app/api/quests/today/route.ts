import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { serverError } from '@/lib/api-utils';
import { dateOnly, localDateString } from '@/lib/dates';
import { ensureQuestsForDay, questDTO, questInclude } from '@/lib/quests';

// The signed-in patient's quests for today (generated on first request)
export async function GET() {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const patientId = auth.user.patientId!;
  const today = localDateString();

  try {
    await ensureQuestsForDay(patientId, today);
    const quests = await db.quest.findMany({
      where: { patientId, dueDate: dateOnly(today), prescriptionItem: { prescription: { status: 'ACTIVE' } } },
      include: questInclude,
      orderBy: [{ prescriptionItem: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    });
    const list = quests.map(questDTO);
    return NextResponse.json({
      date: today,
      total: list.length,
      completed: list.filter((q) => q.status === 'COMPLETED').length,
      quests: list,
    });
  } catch (error) {
    return serverError('Quests today GET error', error);
  }
}
