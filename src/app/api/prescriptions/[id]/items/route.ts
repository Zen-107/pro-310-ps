import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, notFound, readJson, serverError } from '@/lib/api-utils';
import { prescriptionDTO, prescriptionInclude, validateItemInput } from '@/lib/prescriptions';

type Params = { params: Promise<{ id: string }> };

// Add an exercise (quest template) to a prescription; returns the full prescription
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  try {
    const prescription = await db.prescription.findFirst({
      where: { id, patient: patientScope(auth.user) },
      include: { items: { select: { sortOrder: true } } },
    });
    if (!prescription) return notFound('Prescription not found');

    const result = await validateItemInput(body);
    if (!result.ok) return badRequest(result.error);
    const i = result.value;

    await db.prescriptionItem.create({
      data: {
        prescriptionId: id,
        exerciseId: i.exerciseId!,
        sets: i.sets!,
        repsPerSet: i.repsPerSet!,
        restSeconds: i.restSeconds!,
        daysOfWeek: i.daysOfWeek ?? [],
        sortOrder: i.sortOrder ?? Math.max(-1, ...prescription.items.map((x) => x.sortOrder)) + 1,
        notes: i.notes ?? null,
        targetOverrides: { create: i.targetOverrides ?? [] },
      },
    });

    const updated = await db.prescription.findUniqueOrThrow({ where: { id }, include: prescriptionInclude });
    return NextResponse.json(prescriptionDTO(updated), { status: 201 });
  } catch (error) {
    return serverError('Prescription item POST error', error);
  }
}
