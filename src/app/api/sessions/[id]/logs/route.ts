import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MAX_LOGS_PER_REQUEST = 200;

interface LogInput {
  repNumber?: number;
  jointName?: string;
  angle?: number;
  idealAngle?: number;
  deviation?: number;
  isCorrect?: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Accepts { logs: [...] } (batched) or a single log object (legacy)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await req.json();
    const items: LogInput[] = Array.isArray(body?.logs) ? body.logs : [body];

    if (items.length === 0) {
      return NextResponse.json({ count: 0 });
    }
    if (items.length > MAX_LOGS_PER_REQUEST) {
      return NextResponse.json(
        { error: `At most ${MAX_LOGS_PER_REQUEST} logs per request` },
        { status: 413 }
      );
    }
    if (items.some((l) => !l || typeof l.jointName !== 'string' || !isNum(l.angle))) {
      return NextResponse.json(
        { error: 'Each log requires jointName and a numeric angle' },
        { status: 400 }
      );
    }

    const result = await db.jointAngleLog.createMany({
      data: items.map((l) => ({
        sessionId,
        repNumber: isNum(l.repNumber) ? Math.round(l.repNumber) : 0,
        jointName: l.jointName as string,
        angle: l.angle as number,
        idealAngle: isNum(l.idealAngle) ? l.idealAngle : 0,
        deviation: isNum(l.deviation) ? l.deviation : 0,
        isCorrect: l.isCorrect === true,
      })),
    });

    return NextResponse.json({ count: result.count });
  } catch (error) {
    console.error('Log POST error:', error);
    return NextResponse.json({ error: 'Failed to create logs' }, { status: 500 });
  }
}
