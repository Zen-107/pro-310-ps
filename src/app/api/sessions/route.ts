import { NextRequest, NextResponse } from 'next/server';
import type { Prisma, SessionStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient, sessionScope } from '@/lib/access';
import { badRequest, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { dateOnlyString, localDateString } from '@/lib/dates';
import { ANGLE_ALGORITHM_VERSION, ANGLE_DEFINITION } from '@/lib/joint-formulas';
import { exerciseDTO, exerciseInclude, sessionDTO } from '@/lib/presenters';
import { questDTO, questInclude } from '@/lib/quests';

const STATUSES: SessionStatus[] = ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

// Sessions in scope: a patient's own, or a clinician's care-team patients.
// Optional ?patientId, ?status, ?limit (default 50, max 200).
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const params = req.nextUrl.searchParams;
  const patientId = params.get('patientId');
  const status = params.get('status')?.toUpperCase() as SessionStatus | undefined;
  if (status && !STATUSES.includes(status)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);
  const limit = Math.min(200, Math.max(1, parseInt(params.get('limit') || '50', 10) || 50));

  try {
    if (patientId && !(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const where: Prisma.ExerciseSessionWhereInput = {
      AND: [sessionScope(auth.user), patientId ? { patientId } : {}, status ? { status } : {}],
    };
    const sessions = await db.exerciseSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: { exercise: { select: { name: true, nameTh: true, category: true, icon: true } }, review: { select: { status: true } } },
    });
    return NextResponse.json(sessions.map(sessionDTO));
  } catch (error) {
    return serverError('Sessions GET error', error);
  }
}

// Start a session (patient). Body: { questId } for a prescribed quest (uses the
// prescription's dose and angle overrides) or { exerciseId } for free practice.
export async function POST(req: Request) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const patientId = auth.user.patientId!;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const questId = typeof body.questId === 'string' ? body.questId : null;
  const exerciseId = typeof body.exerciseId === 'string' ? body.exerciseId : null;
  if (!questId && !exerciseId) return badRequest('questId or exerciseId is required');

  try {
    let exercise: ReturnType<typeof exerciseDTO>;
    if (questId) {
      const quest = await db.quest.findFirst({ where: { id: questId, patientId }, include: questInclude });
      if (!quest) return notFound('Quest not found');
      if (dateOnlyString(quest.dueDate) !== localDateString() || quest.status === 'MISSED') {
        return jsonError('This quest is not due today', 409);
      }
      if (quest.prescriptionItem.prescription.status !== 'ACTIVE') return jsonError('This prescription is not active', 409);
      exercise = questDTO(quest).exercise;
    } else {
      const ex = await db.exercise.findFirst({ where: { id: exerciseId!, status: 'PUBLISHED' }, include: exerciseInclude });
      if (!ex) return notFound('Exercise not found');
      exercise = exerciseDTO(ex);
    }

    const session = await db.$transaction(async (tx) => {
      const created = await tx.exerciseSession.create({
        data: {
          patientId,
          exerciseId: exercise.id,
          questId,
          algorithmVersion: ANGLE_ALGORITHM_VERSION,
          targetSnapshot: {
            exerciseSlug: exercise.slug,
            exerciseName: exercise.name,
            sets: exercise.sets,
            repsPerSet: exercise.repsPerSet,
            restSeconds: exercise.restSeconds,
            angleDefinition: ANGLE_DEFINITION,
            targets: exercise.targetJoints,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      if (questId) {
        await tx.quest.updateMany({ where: { id: questId, status: 'PENDING' }, data: { status: 'IN_PROGRESS' } });
      }
      return created;
    });

    return NextResponse.json({ id: session.id, questId, startedAt: session.startedAt.toISOString(), exercise }, { status: 201 });
  } catch (error) {
    return serverError('Sessions POST error', error);
  }
}
