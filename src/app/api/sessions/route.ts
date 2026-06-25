import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');

    const sessions = await db.session.findMany({
      where: {
        ...(patientId ? { patientId } : {}),
      },
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
    const { exerciseId, patientId } = body;

    if (!exerciseId || !patientId) {
      return NextResponse.json({ error: 'exerciseId and patientId are required' }, { status: 400 });
    }

    const session = await db.session.create({
      data: {
        exerciseId,
        patientId,
        status: 'in_progress',
      },
    });

    // Update patient last active
    await db.patient.update({
      where: { id: patientId },
      data: { lastActiveAt: new Date() },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Sessions POST error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}