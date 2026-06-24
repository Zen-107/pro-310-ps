import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const session = await db.session.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.endedAt && { endedAt: new Date(body.endedAt) }),
        ...(body.totalReps !== undefined && { totalReps: body.totalReps }),
        ...(body.avgAccuracy !== undefined && { avgAccuracy: body.avgAccuracy }),
        ...(body.maxRom !== undefined && { maxRom: body.maxRom }),
        ...(body.notes && { notes: body.notes }),
      },
    });

    // Update total minutes
    if (body.endedAt && session.startedAt) {
      const durationMs = new Date(body.endedAt).getTime() - session.startedAt.getTime();
      const durationMin = Math.round(durationMs / 60000);
      if (durationMin > 0) {
        await db.userProfile.update({
          where: { id: 'default_user' },
          data: { totalMinutes: { increment: durationMin } },
        });
      }
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.session.findUnique({
      where: { id },
      include: {
        exercise: true,
        logs: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...session,
      instructions: session.exercise ? JSON.parse(session.exercise.instructions) : [],
      targetJoints: session.exercise ? JSON.parse(session.exercise.targetJoints) : [],
    });
  } catch (error) {
    console.error('Session GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}