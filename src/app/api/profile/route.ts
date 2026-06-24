import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const profile = await db.userProfile.upsert({
      where: { id: 'default_user' },
      update: {},
      create: { id: 'default_user', name: 'ผู้ใช้งาน' },
    });

    // Calculate streak
    const sessions = await db.session.findMany({
      where: { status: 'completed' },
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

      // Check if today or yesterday has a session
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (!uniqueDays.has(todayStr) && !uniqueDays.has(yesterdayStr)) {
        streak = 0;
      } else {
        let checkDate = uniqueDays.has(todayStr) ? today : yesterday;
        while (true) {
          const dateStr = checkDate.toISOString().split('T')[0];
          if (uniqueDays.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    // Update streak
    await db.userProfile.update({
      where: { id: 'default_user' },
      data: { streak },
    });

    profile.streak = streak;

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}