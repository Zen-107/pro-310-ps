import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const sessions = await db.session.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { exercise: true },
    });

    const parsed = sessions.map((s) => ({
      ...s,
      targetJoints: s.exercise ? JSON.parse(s.exercise.targetJoints) : [],
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Sessions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { exerciseId } = body;

    if (!exerciseId) {
      return NextResponse.json({ error: 'exerciseId is required' }, { status: 400 });
    }

    const session = await db.session.create({
      data: {
        exerciseId,
        status: 'in_progress',
      },
    });

    // Update user profile
    await db.userProfile.upsert({
      where: { id: 'default_user' },
      update: {
        totalSessions: { increment: 1 },
        lastActiveAt: new Date(),
      },
      create: { id: 'default_user', name: 'ผู้ใช้งาน', totalSessions: 1, lastActiveAt: new Date() },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Sessions POST error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}