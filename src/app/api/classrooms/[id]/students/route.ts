import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { createKidInClassroom, findClassroomFor, type NewKidCard } from '@/lib/classrooms';
import { ASSIGNERS } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };
const MAX_PER_REQUEST = 60;

/**
 * Add students (teacher): { students: [{ name, nickname? }] }. Returns the
 * printable cards (kid code, 3 pictures, parent link code) — the pictures are
 * shown only here and after a reset.
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson<{ students?: unknown }>(req);
  if (!body || !Array.isArray(body.students) || body.students.length === 0) {
    return badRequest('students must be a non-empty array of { name, nickname? }');
  }
  if (body.students.length > MAX_PER_REQUEST) return badRequest(`At most ${MAX_PER_REQUEST} students per request`);
  const students: { name: string; nickname: string | null }[] = [];
  for (const raw of body.students as Record<string, unknown>[]) {
    const name = optionalString(raw?.name, 120);
    if (!name) return badRequest('Every student needs a name');
    students.push({ name, nickname: optionalString(raw?.nickname, 40) ?? null });
  }

  try {
    const classroom = await findClassroomFor(auth.user, id);
    if (!classroom) return notFound('Classroom not found');
    const cards = await db.$transaction(
      async (tx) => {
        const out: NewKidCard[] = [];
        for (const s of students) out.push(await createKidInClassroom(tx, classroom, s));
        return out;
      },
      { timeout: 60_000 }
    );
    return NextResponse.json({ cards }, { status: 201 });
  } catch (error) {
    return serverError('Classroom students POST error', error);
  }
}
