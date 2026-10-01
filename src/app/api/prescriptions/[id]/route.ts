import { NextResponse } from 'next/server';
import type { Prisma, PrescriptionStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { dateOnly, isValidDay } from '@/lib/dates';
import { prescriptionDTO, prescriptionInclude } from '@/lib/prescriptions';

type Params = { params: Promise<{ id: string }> };
const STATUSES: PrescriptionStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    const p = await db.prescription.findFirst({ where: { id, patient: patientScope(auth.user) }, include: prescriptionInclude });
    if (!p) return notFound('Prescription not found');
    return NextResponse.json(prescriptionDTO(p));
  } catch (error) {
    return serverError('Prescription GET error', error);
  }
}

// Update title / notes / status / dates (care-team clinician)
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const data: Prisma.PrescriptionUpdateInput = {};
  if (body.title !== undefined) {
    const title = optionalString(body.title, 200);
    if (!title) return badRequest('title cannot be empty');
    data.title = title;
  }
  if (body.notes !== undefined) data.notes = optionalString(body.notes) ?? null;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as PrescriptionStatus)) return badRequest(`status must be one of ${STATUSES.join(', ')}`);
    data.status = body.status as PrescriptionStatus;
  }
  if (body.startDate !== undefined) {
    if (!isValidDay(body.startDate)) return badRequest('startDate must be YYYY-MM-DD');
    data.startDate = dateOnly(body.startDate);
  }
  if (body.endDate !== undefined) {
    if (body.endDate !== null && !isValidDay(body.endDate)) return badRequest('endDate must be YYYY-MM-DD or null');
    data.endDate = body.endDate ? dateOnly(body.endDate as string) : null;
  }

  try {
    const existing = await db.prescription.findFirst({ where: { id, patient: patientScope(auth.user) } });
    if (!existing) return notFound('Prescription not found');
    const start = (data.startDate as Date | undefined) ?? existing.startDate;
    const end = data.endDate === undefined ? existing.endDate : (data.endDate as Date | null);
    if (end && end < start) return badRequest('endDate cannot be before startDate');

    const updated = await db.prescription.update({ where: { id }, data, include: prescriptionInclude });
    return NextResponse.json(prescriptionDTO(updated));
  } catch (error) {
    return serverError('Prescription PATCH error', error);
  }
}

// Cancel (kept for history; quests stop being generated)
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    const existing = await db.prescription.findFirst({ where: { id, patient: patientScope(auth.user) } });
    if (!existing) return notFound('Prescription not found');
    const updated = await db.prescription.update({ where: { id }, data: { status: 'CANCELLED' }, include: prescriptionInclude });
    return NextResponse.json(prescriptionDTO(updated));
  } catch (error) {
    return serverError('Prescription DELETE error', error);
  }
}
