import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import type { Gender } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, jsonError, optionalString, readJson, serverError } from '@/lib/api-utils';
import { dateOnly, isValidDay } from '@/lib/dates';
import { hashPassword } from '@/lib/password';
import { buildPatientSummaries } from '@/lib/patient-summary';

const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'];

// Care-team patients of the signed-in clinician
export async function GET() {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  try {
    const patients = await db.patient.findMany({ where: patientScope(auth.user), orderBy: { createdAt: 'desc' } });
    return NextResponse.json(await buildPatientSummaries(patients));
  } catch (error) {
    return serverError('Patients GET error', error);
  }
}

// Register a patient in the clinician's organization (clinician becomes PRIMARY).
// With `email`, a login is created and a one-time temporary password returned.
export async function POST(req: Request) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const name = optionalString(body.name, 200);
  if (!name) return badRequest('name is required');
  if (body.dateOfBirth != null && !isValidDay(body.dateOfBirth)) return badRequest('dateOfBirth must be YYYY-MM-DD');
  const gender = (body.gender ?? 'UNSPECIFIED') as Gender;
  if (!GENDERS.includes(gender)) return badRequest(`gender must be one of ${GENDERS.join(', ')}`);
  const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().toLowerCase() : null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest('email is invalid');

  try {
    const clinician = await db.clinician.findUnique({ where: { id: auth.user.clinicianId! } });
    if (!clinician) return jsonError('Clinician profile not found', 403);
    if (email && (await db.user.findUnique({ where: { email } }))) return jsonError('Email already in use', 409);

    const temporaryPassword = email ? randomBytes(9).toString('base64url') : null;
    const patient = await db.patient.create({
      data: {
        name,
        dateOfBirth: body.dateOfBirth ? dateOnly(body.dateOfBirth as string) : null,
        gender,
        condition: optionalString(body.condition) ?? null,
        phone: optionalString(body.phone, 50) ?? null,
        organization: { connect: { id: clinician.organizationId } },
        careAssignments: { create: { clinicianId: clinician.id, role: 'PRIMARY' } },
        ...(email && temporaryPassword
          ? { user: { create: { email, name, role: 'PATIENT' as const, passwordHash: await hashPassword(temporaryPassword) } } }
          : {}),
      },
    });

    const [summary] = await buildPatientSummaries([patient]);
    return NextResponse.json({ ...summary, loginEmail: email, temporaryPassword }, { status: 201 });
  } catch (error) {
    return serverError('Patients POST error', error);
  }
}
