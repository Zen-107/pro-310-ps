import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Calculate streak
    const sessions = await db.session.findMany({
      where: { patientId, status: 'completed' },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
      take: 100,
    });

    let streak = 0;
    if (sessions.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const uniqueDays = new Set<string>();
      for (const s of sessions) {
        const d = new Date(s.startedAt);
        d.setHours(0, 0, 0, 0);
        uniqueDays.add(d.toISOString().split('T')[0]);
      }
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (uniqueDays.has(todayStr) || uniqueDays.has(yesterdayStr)) {
        let checkDate = uniqueDays.has(todayStr) ? today : yesterday;
        while (true) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (uniqueDays.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else break;
        }
      }
    }

    await db.patient.update({ where: { id: patientId }, data: { streak } });

    return NextResponse.json({
      id: patient.id,
      name: patient.name,
      streak,
      totalMinutes: patient.totalMinutes,
      condition: patient.condition,
      assignedExerciseIds: JSON.parse(patient.assignedExerciseIds),
      lastActiveAt: patient.lastActiveAt?.toISOString(),
    });
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}