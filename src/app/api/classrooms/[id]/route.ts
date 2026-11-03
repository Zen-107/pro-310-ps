import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { classroomDetail, findClassroomFor } from '@/lib/classrooms';
import { ASSIGNERS, STAFF } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

// Class page: students with today's progress, consent and codes, plus class mission sets
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(STAFF);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    if (!(await findClassroomFor(auth.user, id))) return notFound('Classroom not found');
    const detail = await classroomDetail(id);
    // Login codes are for the class teacher only
    if (auth.user.role !== 'TEACHER') {
      detail.students = detail.students.map((s) => ({ ...s, kidCode: null, parentLinkCode: null }));
    }
    return NextResponse.json(detail);
  } catch (error) {
    return serverError('Classroom GET error', error);
  }
}

// Rename / archive (teacher): { name?, gradeLabel?, archived? }
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');
  const name = optionalString(body.name, 60);
  if (body.name !== undefined && !name) return badRequest('name cannot be empty');
  try {
    if (!(await findClassroomFor(auth.user, id))) return notFound('Classroom not found');
    const c = await db.classroom.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(body.gradeLabel !== undefined ? { gradeLabel: optionalString(body.gradeLabel, 60) ?? null } : {}),
        ...(body.archived === true ? { archivedAt: new Date() } : {}),
      },
    });
    return NextResponse.json({ id: c.id, name: c.name, gradeLabel: c.gradeLabel, archived: c.archivedAt !== null });
  } catch (error) {
    return serverError('Classroom PATCH error', error);
  }
}
