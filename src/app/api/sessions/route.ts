import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, SessionStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient, sessionScope } from '@/lib/access';
import { badRequest, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { dateOnlyString, localDateString } from '@/lib/dates';
import { ANGLE_ALGORITHM_VERSION, ANGLE_DEFINITION } from '@/lib/joint-formulas';
import { sessionDTO } from '@/lib/presenters';
import { questDTO, questInclude } from '@/lib/quests';

const STATUSES: SessionStatus[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// Sessions in scope: a patient's own, or a clinician's care-team patients.
// Optional ?patientId, ?status, ?awaitingReview=true (completed, not yet
// reviewed — the clinician review queue), ?limit (default 50, max 200).
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const params = req.nextUrl.searchParams;
  const patientId = params.get('patientId');
  const status = params.get('status')?.toUpperCase() as SessionStatus | undefined;
  if (status && !STATUSES.includes(status)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);
  const awaitingReview = params.get('awaitingReview') === 'true';
  const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50));

  try {
    if (patientId && !(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const where: Prisma.ExerciseSessionWhereInput = {
      AND: [
        sessionScope(auth.user),
        patientId ? { patientId } : {},
        status ? { status } : {},
        awaitingReview ? { status: 'COMPLETED', review: { is: null } } : {},
      ],
    };
    const sessions = await db.exerciseSession.findMany({
      where,
      orderBy: awaitingReview ? { endedAt: 'asc' } : { startedAt: 'desc' },
      take: limit,
      include: {
        exercise: { select: { name: true, nameTh: true, category: true, icon: true } },
        review: { select: { status: true } },
        patient: { select: { name: true } },
        _count: { select: { faults: true } },
      },
    });
    return NextResponse.json(sessions.map((s) => ({ ...sessionDTO(s), patientName: s.patient.name })));
  } catch (error) {
    return serverError('Sessions GET error', error);
  }
}

// Start a session (patient) for one of today's prescribed quests: { questId }.
// Free practice is disabled — patients only perform exercises their care team
// assigned. The session records the prescription, item and prescribing
// clinician so it shows up on the clinician side immediately.
export async function POST(req: Request) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const patientId = auth.user.patientId!;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const questId = typeof body.questId === 'string' ? body.questId : null;
  if (!questId) {
    return body.exerciseId
      ? jsonError('Free practice is disabled. Start one of your prescribed quests instead.', 403)
      : badRequest('questId is required');
  }

  try {
    const quest = await db.quest.findFirst({ where: { id: questId, patientId }, include: questInclude });
    if (!quest) return notFound('Quest not found');
    if (dateOnlyString(quest.dueDate) !== localDateString() || quest.status === 'MISSED') {
      return jsonError('This quest is not due today', 409);
    }
    const prescription = quest.prescriptionItem.prescription;
    if (prescription.status !== 'ACTIVE') return jsonError('This prescription is not active', 409);
    const exercise = questDTO(quest).exercise;

    const session = await db.$transaction(async (tx) => {
      const created = await tx.exerciseSession.create({
        data: {
          patientId,
          exerciseId: exercise.id,
          questId,
          prescriptionId: prescription.id,
          prescriptionItemId: quest.prescriptionItemId,
          clinicianId: prescription.clinicianId,
          algorithmVersion: ANGLE_ALGORITHM_VERSION,
          targetSnapshot: {
            exerciseSlug: exercise.slug,
            exerciseName: exercise.name,
            sets: exercise.sets,
            repsPerSet: exercise.repsPerSet,
            restSeconds: exercise.restSeconds,
            angleDefinition: ANGLE_DEFINITION,
            targets: exercise.targetJoints,
            formChecks: exercise.formChecks,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.quest.updateMany({ where: { id: questId, status: 'PENDING' }, data: { status: 'IN_PROGRESS' } });
      return created;
    });

    return NextResponse.json({ id: session.id, questId, startedAt: session.startedAt.toISOString(), exercise }, { status: 201 });
  } catch (error) {
    return serverError('Sessions POST error', error);
  }
}
