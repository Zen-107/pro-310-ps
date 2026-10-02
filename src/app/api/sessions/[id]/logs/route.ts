import { NextResponse } from 'next/server';
import type { FaultType, JointName } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, isFiniteNumber, isIntInRange, jsonError, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { JOINT_FORMULAS } from '@/lib/joint-formulas';
import { cleanText } from '@/lib/text-safe';

const MAX_ROWS_PER_REQUEST = 200;
const FAULT_TYPES: FaultType[] = ['INCOMPLETE_ROM', 'COMPENSATION', 'LOW_ACCURACY'];

type Params = { params: Promise<{ id: string }> };

interface RepInput {
  setNumber?: unknown;
  repNumber?: unknown;
  enteredAt?: unknown;
  durationMs?: unknown;
  bestAngle?: unknown;
  accuracy?: unknown;
  isCorrect?: unknown;
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

interface FaultInput {
  repNumber?: unknown; // absent for INCOMPLETE_ROM
  type?: unknown;
  checkId?: unknown;
  joint?: unknown;
  measuredAngle?: unknown;
  expectedMin?: unknown;
  expectedMax?: unknown;
  deficit?: unknown;
  message?: unknown;
  occurredAt?: unknown; // epoch ms
}

const isAngle = (v: unknown): v is number => isFiniteNumber(v) && v >= -360 && v <= 360;
const isKnownJoint = (v: unknown): v is JointName => typeof v === 'string' && v in JOINT_FORMULAS;
const optAngle = (v: unknown) => v === undefined || v === null || isAngle(v);

// Batched upload from the live session (owning patient).
// Body: { reps?: RepInput[], logs?: LogInput[], faults?: FaultInput[] };
// logs and faults link to reps by repNumber.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const { id: sessionId } = await params;
  const body = await readJson<{ reps?: unknown; logs?: unknown; faults?: unknown }>(req);
  if (!body) return badRequest('Invalid JSON body');

  const reps = (Array.isArray(body.reps) ? body.reps : []) as RepInput[];
  const logs = (Array.isArray(body.logs) ? body.logs : []) as LogInput[];
  const faults = (Array.isArray(body.faults) ? body.faults : []) as FaultInput[];
  const rows = reps.length + logs.length + faults.length;
  if (rows === 0) return NextResponse.json({ reps: 0, logs: 0, faults: 0 });
  if (rows > MAX_ROWS_PER_REQUEST) return jsonError(`At most ${MAX_ROWS_PER_REQUEST} rows per request`, 413);

  for (const r of reps) {
    if (
      !isIntInRange(r.setNumber, 1, 100) ||
      !isIntInRange(r.repNumber, 1, 10000) ||
      !isFiniteNumber(r.enteredAt) ||
      !isIntInRange(r.durationMs, 0, 3_600_000) ||
      !isAngle(r.bestAngle) ||
      !isFiniteNumber(r.accuracy) || r.accuracy < 0 || r.accuracy > 100 ||
      (r.isCorrect !== undefined && typeof r.isCorrect !== 'boolean')
    ) {
      return badRequest('Each rep needs setNumber, repNumber, enteredAt (epoch ms), durationMs, bestAngle, accuracy 0–100, optional isCorrect');
    }
  }
  for (const l of logs) {
    if (!isKnownJoint(l.joint ?? l.jointName)) return badRequest('Each log needs a known joint');
    if (![l.angle, l.idealAngle, l.minAngle, l.maxAngle].every(isAngle)) {
      return badRequest('Each log needs numeric angle, idealAngle, minAngle, maxAngle');
    }
    if (l.repNumber !== undefined && !isIntInRange(l.repNumber, 0, 10000)) return badRequest('repNumber must be an integer');
  }
  for (const f of faults) {
    if (
      !FAULT_TYPES.includes(f.type as FaultType) ||
      !isKnownJoint(f.joint) ||
      !isAngle(f.measuredAngle) ||
      !optAngle(f.expectedMin) || !optAngle(f.expectedMax) ||
      !(f.deficit === undefined || f.deficit === null || (isFiniteNumber(f.deficit) && f.deficit >= 0 && f.deficit <= 360)) ||
      typeof f.message !== 'string' || !f.message.trim() ||
      !isFiniteNumber(f.occurredAt) ||
      (f.repNumber !== undefined && !isIntInRange(f.repNumber, 1, 10000))
    ) {
      return badRequest('Each fault needs type, known joint, measuredAngle, message, occurredAt (epoch ms); optional repNumber, expectedMin/Max, deficit');
    }
  }

  try {
    const session = await db.exerciseSession.findFirst({
      where: { id: sessionId, patientId: auth.user.patientId! },
      select: { id: true, review: { select: { id: true } } },
    });
    if (!session) return notFound('Session not found');
    // Rows may arrive just after the session is finished (final flush), but
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
          isCorrect: r.isCorrect !== false,
        })),
        skipDuplicates: true,
      });
    }

    // Map repNumber → rep id for logs and faults
    const repNumbers = [
      ...new Set([...logs, ...faults].map((x) => x.repNumber).filter((n): n is number => typeof n === 'number')),
    ];
    const repRows = repNumbers.length
      ? await db.sessionRep.findMany({ where: { sessionId, repNumber: { in: repNumbers } }, select: { id: true, repNumber: true } })
      : [];
    const repId = (n: unknown) => (typeof n === 'number' ? repRows.find((r) => r.repNumber === n)?.id ?? null : null);

    let createdLogs = 0;
    if (logs.length) {
      const result = await db.jointAngleLog.createMany({
        data: logs.map((l) => {
          const angle = l.angle as number;
          const idealAngle = l.idealAngle as number;
          const minAngle = l.minAngle as number;
          const maxAngle = l.maxAngle as number;
          return {
            sessionId,
            repId: repId(l.repNumber),
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
      createdLogs = result.count;
    }

    let createdFaults = 0;
    if (faults.length) {
      const result = await db.sessionFault.createMany({
        data: faults.map((f) => ({
          sessionId,
          repId: repId(f.repNumber),
          type: f.type as FaultType,
          checkId: optionalString(f.checkId, 100) ?? null,
          joint: f.joint as JointName,
          measuredAngle: f.measuredAngle as number,
          expectedMin: (f.expectedMin as number | null | undefined) ?? null,
          expectedMax: (f.expectedMax as number | null | undefined) ?? null,
          deficit: (f.deficit as number | null | undefined) ?? null,
          message: cleanText(f.message, 300) ?? 'Form fault',
          occurredAt: new Date(f.occurredAt as number),
        })),
      });
      createdFaults = result.count;
    }

    return NextResponse.json({ reps: reps.length, logs: createdLogs, faults: createdFaults });
  } catch (error) {
    return serverError('Session logs POST error', error);
  }
}
