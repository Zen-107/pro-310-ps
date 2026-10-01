import { NextResponse } from 'next/server';
import type { JointName } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { badRequest, isFiniteNumber, isIntInRange, jsonError, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { JOINT_FORMULAS } from '@/lib/joint-formulas';
import { sessionDTO } from '@/lib/presenters';

type Params = { params: Promise<{ id: string }> };

// Full session: metrics, target snapshot (incl. formulas), reps, joint logs, review
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    const s = await db.exerciseSession.findFirst({
      where: { AND: [{ id }, sessionScope(auth.user)] },
      include: {
        exercise: { select: { name: true, nameTh: true, category: true, icon: true } },
        reps: { orderBy: { repNumber: 'asc' } },
        logs: { orderBy: { timestamp: 'asc' }, take: 5000 },
        review: { include: { clinician: { select: { title: true, user: { select: { name: true } } } } } },
      },
    });
    if (!s) return notFound('Session not found');
    return NextResponse.json({
      ...sessionDTO(s),
      algorithmVersion: s.algorithmVersion,
      targetSnapshot: s.targetSnapshot,
      reps: s.reps,
      logs: s.logs,
      review: s.review && {
        status: s.review.status,
        comment: s.review.comment,
        reviewedAt: s.review.reviewedAt.toISOString(),
        reviewer: { name: s.review.clinician.user.name, title: s.review.clinician.title },
      },
    });
  } catch (error) {
    return serverError('Session GET error', error);
  }
}

const angleOrNull = (v: unknown) => v === null || v === undefined || (isFiniteNumber(v) && v >= -360 && v <= 360);

// Finish a session (owning patient, once). Body: { status: COMPLETED | CANCELLED,
// totalReps, avgAccuracy, romMinAngle, romMaxAngle, primaryJoint, notes? }.
// endedAt and romDegrees are set by the server.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const status = typeof body.status === 'string' ? body.status.toUpperCase() : '';
  if (status !== 'COMPLETED' && status !== 'CANCELLED') return badRequest('status must be COMPLETED or CANCELLED');
  if (!isIntInRange(body.totalReps ?? 0, 0, 10000)) return badRequest('totalReps must be an integer 0–10000');
  const avgAccuracy = body.avgAccuracy ?? 0;
  if (!isFiniteNumber(avgAccuracy) || avgAccuracy < 0 || avgAccuracy > 100) return badRequest('avgAccuracy must be 0–100');
  if (!angleOrNull(body.romMinAngle) || !angleOrNull(body.romMaxAngle)) return badRequest('romMinAngle/romMaxAngle must be numbers within ±360');
  const primaryJoint = body.primaryJoint ?? null;
  if (primaryJoint !== null && !(typeof primaryJoint === 'string' && primaryJoint in JOINT_FORMULAS)) {
    return badRequest('primaryJoint is not a known measurement');
  }

  try {
    const session = await db.exerciseSession.findFirst({ where: { id, patientId: auth.user.patientId! } });
    if (!session) return notFound('Session not found');
    if (session.status !== 'IN_PROGRESS') return jsonError('Session is already finished', 409);

    const romMin = (body.romMinAngle as number | null | undefined) ?? null;
    const romMax = (body.romMaxAngle as number | null | undefined) ?? null;
    const updated = await db.$transaction(async (tx) => {
      const s = await tx.exerciseSession.update({
        where: { id },
        data: {
          status,
          endedAt: new Date(),
          totalReps: (body.totalReps as number | undefined) ?? 0,
          avgAccuracy,
          romMinAngle: romMin,
          romMaxAngle: romMax,
          romDegrees: romMin !== null && romMax !== null && romMax >= romMin ? romMax - romMin : null,
          primaryJoint: primaryJoint as JointName | null,
          notes: optionalString(body.notes) ?? null,
        },
        include: { exercise: { select: { name: true, nameTh: true, category: true, icon: true } } },
      });

      if (s.questId) {
        if (status === 'COMPLETED') {
          await tx.quest.update({ where: { id: s.questId }, data: { status: 'COMPLETED', completedAt: new Date() } });
        } else {
          // Cancelled attempt: back to PENDING unless another session completed it
          await tx.quest.updateMany({ where: { id: s.questId, status: 'IN_PROGRESS' }, data: { status: 'PENDING' } });
        }
      }
      return s;
    });

    return NextResponse.json(sessionDTO(updated));
  } catch (error) {
    return serverError('Session PATCH error', error);
  }
}
