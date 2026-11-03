import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, optionalString, readJson, serverError } from '@/lib/api-utils';
import { dateOnly, localDateString } from '@/lib/dates';
import { ASSIGNERS, STAFF } from '@/lib/roles';
import { ensureClassQuestsToday } from '@/lib/classrooms';

// Classrooms: a teacher's own classes; an expert sees every class of their organization.
export async function GET() {
  const auth = await requireApiUser(STAFF);
  if ('response' in auth) return auth.response;
  const { clinicianId, organizationId, role } = auth.user;
  try {
    const today = dateOnly(localDateString());
    const scope = role === 'TEACHER' ? { teacherId: clinicianId ?? '__none__' } : { organizationId: organizationId ?? '__none__' };
    const ids = await db.classroom.findMany({ where: { archivedAt: null, ...scope }, select: { id: true } });
    await ensureClassQuestsToday(ids.map((c) => c.id));
    const classrooms = await db.classroom.findMany({
      where: { archivedAt: null, ...scope },
      include: {
        teacher: { select: { user: { select: { name: true } } } },
        members: {
          where: { patient: { archivedAt: null } },
          select: { patient: { select: { quests: { where: { dueDate: today }, select: { status: true } } } } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(
      classrooms.map((c) => {
        const withMissions = c.members.filter((m) => m.patient.quests.length > 0);
        return {
          id: c.id,
          name: c.name,
          gradeLabel: c.gradeLabel,
          teacherName: c.teacher.user.name,
          studentCount: c.members.length,
          // Kids with missions today, and those who finished all of them
          dueToday: withMissions.length,
          doneToday: withMissions.filter((m) => m.patient.quests.every((q) => q.status === 'COMPLETED')).length,
        };
      })
    );
  } catch (error) {
    return serverError('Classrooms GET error', error);
  }
}

// Create a class (teacher): { name, gradeLabel? }
export async function POST(req: Request) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  const name = optionalString(body?.name, 60);
  if (!name) return badRequest('name is required');
  try {
    const teacher = await db.clinician.findUnique({ where: { id: auth.user.clinicianId ?? '' } });
    if (!teacher) return jsonError('Teacher profile not found', 403);
    const c = await db.classroom.create({
      data: { name, gradeLabel: optionalString(body?.gradeLabel, 60) ?? null, teacherId: teacher.id, organizationId: teacher.organizationId },
    });
    return NextResponse.json({ id: c.id, name: c.name, gradeLabel: c.gradeLabel }, { status: 201 });
  } catch (error) {
    return serverError('Classrooms POST error', error);
  }
}
