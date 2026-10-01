import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, notFound, readJson, serverError } from '@/lib/api-utils';
import { prescriptionDTO, prescriptionInclude, validateItemInput } from '@/lib/prescriptions';

type Params = { params: Promise<{ id: string; itemId: string }> };

async function findItem(userScope: Prisma.PatientWhereInput, id: string, itemId: string) {
  return db.prescriptionItem.findFirst({ where: { id: itemId, prescriptionId: id, prescription: { patient: userScope } } });
}

// Update dose / schedule / notes; `targetOverrides` (if given) replaces all overrides
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id, itemId } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  try {
    const item = await findItem(patientScope(auth.user), id, itemId);
    if (!item) return notFound('Prescription item not found');

    const result = await validateItemInput(body, item.exerciseId);
    if (!result.ok) return badRequest(result.error);
    const { targetOverrides, exerciseId: _ignored, ...fields } = result.value;

    await db.$transaction([
      db.prescriptionItem.update({ where: { id: itemId }, data: fields }),
      ...(targetOverrides
        ? [
            db.prescriptionTargetOverride.deleteMany({ where: { itemId } }),
            db.prescriptionTargetOverride.createMany({ data: targetOverrides.map((o) => ({ ...o, itemId })) }),
          ]
        : []),
    ]);

    const updated = await db.prescription.findUniqueOrThrow({ where: { id }, include: prescriptionInclude });
    return NextResponse.json(prescriptionDTO(updated));
  } catch (error) {
    return serverError('Prescription item PATCH error', error);
  }
}

// Remove an exercise from the prescription. Past sessions are kept
// (their quest link is cleared); future quests for it stop being generated.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id, itemId } = await params;
  try {
    const item = await findItem(patientScope(auth.user), id, itemId);
    if (!item) return notFound('Prescription item not found');
    await db.prescriptionItem.delete({ where: { id: itemId } });
    const updated = await db.prescription.findUniqueOrThrow({ where: { id }, include: prescriptionInclude });
    return NextResponse.json(prescriptionDTO(updated));
  } catch (error) {
    return serverError('Prescription item DELETE error', error);
  }
}
