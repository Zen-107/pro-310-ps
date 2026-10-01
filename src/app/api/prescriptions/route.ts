import { NextRequest, NextResponse } from 'next/server';
import type { PrescriptionStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { dateOnly, isValidDay, localDateString } from '@/lib/dates';
import { prescriptionDTO, prescriptionInclude, validateItemInput, type ItemInput } from '@/lib/prescriptions';

const STATUSES: PrescriptionStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

// Prescriptions of a patient. Patients get their own; clinicians pass ?patientId.
export async function GET(req: NextRequest) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;

  const patientId = auth.user.role === 'PATIENT' ? auth.user.patientId : req.nextUrl.searchParams.get('patientId');
  if (!patientId) return badRequest('patientId is required');
  const status = req.nextUrl.searchParams.get('status') as PrescriptionStatus | null;
  if (status && !STATUSES.includes(status)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);

  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const list = await db.prescription.findMany({
      where: { patientId, ...(status ? { status } : {}) },
      include: prescriptionInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(list.map(prescriptionDTO));
  } catch (error) {
    return serverError('Prescriptions GET error', error);
  }
}

// Create a prescription (care-team clinician), optionally with items
export async function POST(req: Request) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const patientId = typeof body.patientId === 'string' ? body.patientId : null;
  const title = optionalString(body.title, 200);
  if (!patientId) return badRequest('patientId is required');
  if (!title) return badRequest('title is required');
  const startDate = body.startDate ?? localDateString();
  if (!isValidDay(startDate)) return badRequest('startDate must be YYYY-MM-DD');
  if (body.endDate != null && (!isValidDay(body.endDate) || body.endDate < startDate)) {
    return badRequest('endDate must be YYYY-MM-DD and not before startDate');
  }

  const items: ItemInput[] = [];
  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) return badRequest('items must be an array');
    for (const raw of body.items as Record<string, unknown>[]) {
      const result = await validateItemInput(raw ?? {});
      if (!result.ok) return badRequest(result.error);
      items.push(result.value);
    }
  }

  try {
    if (!(await canAccessPatient(auth.user, patientId))) return notFound('Patient not found');
    const created = await db.prescription.create({
      data: {
        title,
        notes: optionalString(body.notes) ?? null,
        startDate: dateOnly(startDate),
        endDate: body.endDate ? dateOnly(body.endDate as string) : null,
        patient: { connect: { id: patientId } },
        clinician: { connect: { id: auth.user.clinicianId! } },
        items: {
          create: items.map((i, idx) => ({
            exerciseId: i.exerciseId!,
            sets: i.sets!,
            repsPerSet: i.repsPerSet!,
            restSeconds: i.restSeconds!,
            daysOfWeek: i.daysOfWeek ?? [],
            sortOrder: i.sortOrder ?? idx,
            notes: i.notes ?? null,
            targetOverrides: { create: i.targetOverrides ?? [] },
          })),
        },
      },
      include: prescriptionInclude,
    });
    return NextResponse.json(prescriptionDTO(created), { status: 201 });
  } catch (error) {
    return serverError('Prescriptions POST error', error);
  }
}
