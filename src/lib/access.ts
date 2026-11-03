import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth-guard';
import { isAdult } from '@/lib/roles';

// Data scoping rules:
//  - PATIENT (child) sees only their own records
//  - adults (expert, teacher, parent) see children they have a CareAssignment
//    with: teachers via their class, parents via the link code, experts as assigned
// Callers return 404 (not 403) for records outside scope, so IDs don't leak.

/** Prisma filter for the patients a user may see (non-archived). */
export function patientScope(user: SessionUser): Prisma.PatientWhereInput {
  if (user.role === 'PATIENT') return { id: user.patientId ?? '__none__', archivedAt: null };
  if (isAdult(user.role) && user.clinicianId) {
    return { archivedAt: null, careAssignments: { some: { clinicianId: user.clinicianId } } };
  }
  return { id: '__none__' };
}

export async function canAccessPatient(user: SessionUser, patientId: string): Promise<boolean> {
  const found = await db.patient.findFirst({ where: { AND: [{ id: patientId }, patientScope(user)] }, select: { id: true } });
  return !!found;
}

/** Prisma filter for sessions a user may see. */
export function sessionScope(user: SessionUser): Prisma.ExerciseSessionWhereInput {
  return { patient: patientScope(user) };
}
