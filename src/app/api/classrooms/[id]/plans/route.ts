import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { assignToClassroom, findClassroomFor } from '@/lib/classrooms';
import { isValidDay, localDateString } from '@/lib/dates';
import { validateItemInput, type ItemInput } from '@/lib/prescriptions';
import { ASSIGNERS } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

/**
 * Assign a mission set to the whole class (teacher):
 * { title, notes?, startDate?, endDate?, items: [{ exerciseId, sets?, repsPerSet?, restSeconds?, daysOfWeek? }] }
 * Every child gets their own copy (one Prescription each, linked by classroomId);
 * children who join later get it too.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');
  const title = optionalString(body.title, 200);
  if (!title) return badRequest('title is required');
  const startDate = body.startDate ?? localDateString();
  if (!isValidDay(startDate)) return badRequest('startDate must be YYYY-MM-DD');
  if (body.endDate != null && (!isValidDay(body.endDate) || body.endDate < startDate)) {
    return badRequest('endDate must be YYYY-MM-DD and not before startDate');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) return badRequest('items must be a non-empty array');
  const items: ItemInput[] = [];
  for (const raw of body.items as Record<string, unknown>[]) {
    const result = await validateItemInput(raw ?? {});
    if (!result.ok) return badRequest(result.error);
    items.push(result.value);
  }

  try {
    const classroom = await findClassroomFor(auth.user, id);
    if (!classroom) return notFound('Classroom not found');
    const clash = await db.prescription.findFirst({ where: { classroomId: id, title, status: 'ACTIVE' }, select: { id: true } });
    if (clash) return jsonError('An active mission set with this title already exists in the class', 409);
    const kids = await db.$transaction(
      (tx) =>
        assignToClassroom(tx, classroom, {
          title,
          notes: optionalString(body.notes) ?? null,
          startDate,
          endDate: (body.endDate as string | undefined) ?? null,
          items,
        }),
      { timeout: 60_000 }
    );
    return NextResponse.json({ title, kids }, { status: 201 });
  } catch (error) {
    return serverError('Classroom plans POST error', error);
  }
}

// End a class mission set for everyone (teacher): { title, status: 'COMPLETED' | 'CANCELLED' }
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  const title = optionalString(body?.title, 200);
  const status = body?.status;
  if (!title) return badRequest('title is required');
  if (status !== 'COMPLETED' && status !== 'CANCELLED') return badRequest('status must be COMPLETED or CANCELLED');
  try {
    if (!(await findClassroomFor(auth.user, id))) return notFound('Classroom not found');
    const { count } = await db.prescription.updateMany({ where: { classroomId: id, title, status: 'ACTIVE' }, data: { status } });
    if (count === 0) return notFound('Mission set not found');
    return NextResponse.json({ title, status, kids: count });
  } catch (error) {
    return serverError('Classroom plans PATCH error', error);
  }
}
