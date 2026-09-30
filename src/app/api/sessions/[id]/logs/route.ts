import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, repNumber, jointName, angle, idealAngle, deviation, isCorrect } =
      await req.json();

    if (!sessionId || !jointName) {
      return NextResponse.json(
        { error: 'sessionId and jointName are required' },
        { status: 400 }
      );
    }

    const log = await db.jointAngleLog.create({
      data: {
        sessionId,
        repNumber: repNumber || 0,
        jointName,
        angle: angle || 0,
        idealAngle: idealAngle || 0,
        deviation: deviation || 0,
        isCorrect: isCorrect || false,
      },
    });

    return NextResponse.json(log);
  } catch (error) {
    console.error('Log POST error:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
}