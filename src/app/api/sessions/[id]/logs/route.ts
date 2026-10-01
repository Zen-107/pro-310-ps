import { NextResponse } from 'next/server';
import type { JointName } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, isFiniteNumber, isIntInRange, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { JOINT_FORMULAS } from '@/lib/joint-formulas';

const MAX_ROWS_PER_REQUEST = 200;

type Params = { params: Promise<{ id: string }> };

interface RepInput {
  setNumber?: unknown;
  repNumber?: unknown;
  enteredAt?: unknown;
  durationMs?: unknown;
  bestAngle?: unknown;
  accuracy?: unknown;
}

interface LogInput {
  repNumber?: unknown;
  joint?: unknown;
  jointName?: unknown; // legacy alias
  angle?: unknown;
  idealAngle?: unknown;
  minAngle?: unknown;
  maxAngle?: unknown;
  deviation?: unknown;
  isCorrect?: unknown;
}

const isAngle = (v: unknown): v is number => isFiniteNumber(v) && v >= -360 && v <= 360;

// Batched upload from the live session (owning patient).
// Body: { reps?: RepInput[], logs?: LogInput[] } — logs are linked to reps by repNumber.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const { id: sessionId } = await params;
  const body = await readJson<{ reps?: unknown; logs?: unknown }>(req);
  if (!body) return badRequest('Invalid JSON body');

  const reps = (Array.isArray(body.reps) ? body.reps : []) as RepInput[];
  const logs = (Array.isArray(body.logs) ? body.logs : []) as LogInput[];
  if (reps.length + logs.length === 0) return NextResponse.json({ reps: 0, logs: 0 });
  if (reps.length + logs.length > MAX_ROWS_PER_REQUEST) {
    return jsonError(`At most ${MAX_ROWS_PER_REQUEST} rows per request`, 413);
  }

  for (const r of reps) {
    if (
      !isIntInRange(r.setNumber, 1, 100) ||
      !isIntInRange(r.repNumber, 1, 10000) ||
      !isFiniteNumber(r.enteredAt) ||
      !isIntInRange(r.durationMs, 0, 3_600_000) ||
      !isAngle(r.bestAngle) ||
      !isFiniteNumber(r.accuracy) || r.accuracy < 0 || r.accuracy > 100
    ) {
      return badRequest('Each rep needs setNumber, repNumber, enteredAt (epoch ms), durationMs, bestAngle, accuracy 0–100');
    }
  }
  for (const l of logs) {
    const joint = l.joint ?? l.jointName;
    if (typeof joint !== 'string' || !(joint in JOINT_FORMULAS)) return badRequest('Each log needs a known joint');
    if (![l.angle, l.idealAngle, l.minAngle, l.maxAngle].every(isAngle)) {
      return badRequest('Each log needs numeric angle, idealAngle, minAngle, maxAngle');
    }
    if (l.repNumber !== undefined && !isIntInRange(l.repNumber, 0, 10000)) return badRequest('repNumber must be an integer');
  }

  try {
    const session = await db.exerciseSession.findFirst({
      where: { id: sessionId, patientId: auth.user.patientId! },
      select: { id: true, review: { select: { id: true } } },
    });
    if (!session) return notFound('Session not found');
    // Logs may arrive just after the session is finished (final flush), but
    // never after a clinician has reviewed it.
    if (session.review) return jsonError('Session has been reviewed and is locked', 409);

    if (reps.length) {
      await db.sessionRep.createMany({
        data: reps.map((r) => ({
          sessionId,
          setNumber: r.setNumber as number,
          repNumber: r.repNumber as number,
          enteredAt: new Date(r.enteredAt as number),
          durationMs: r.durationMs as number,
          bestAngle: r.bestAngle as number,
          accuracy: r.accuracy as number,
        })),
        skipDuplicates: true,
      });
    }

    let created = 0;
    if (logs.length) {
      const repNumbers = [...new Set(logs.map((l) => l.repNumber).filter((n): n is number => typeof n === 'number'))];
      const repRows = repNumbers.length
        ? await db.sessionRep.findMany({ where: { sessionId, repNumber: { in: repNumbers } }, select: { id: true, repNumber: true } })
        : [];
      const repIdByNumber = new Map(repRows.map((r) => [r.repNumber, r.id]));
      const result = await db.jointAngleLog.createMany({
        data: logs.map((l) => {
          const angle = l.angle as number;
          const idealAngle = l.idealAngle as number;
          const minAngle = l.minAngle as number;
          const maxAngle = l.maxAngle as number;
          return {
            sessionId,
            repId: typeof l.repNumber === 'number' ? repIdByNumber.get(l.repNumber) ?? null : null,
            joint: (l.joint ?? l.jointName) as JointName,
            angle,
            idealAngle,
            minAngle,
            maxAngle,
            deviation: isFiniteNumber(l.deviation) ? l.deviation : Math.abs(angle - idealAngle),
            isCorrect: typeof l.isCorrect === 'boolean' ? l.isCorrect : angle >= minAngle && angle <= maxAngle,
          };
        }),
      });
      created = result.count;
    }

    return NextResponse.json({ reps: reps.length, logs: created });
  } catch (error) {
    return serverError('Session logs POST error', error);
  }
}
