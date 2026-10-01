import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth-guard';

// Data scoping rules:
//  - PATIENT sees only their own records
//  - CLINICIAN sees patients they have a CareAssignment with (care team)
// Callers return 404 (not 403) for records outside scope, so IDs don't leak.

/** Prisma filter for the patients a user may see (non-archived). */
export function patientScope(user: SessionUser): Prisma.PatientWhereInput {
  if (user.role === 'PATIENT') return { id: user.patientId ?? '__none__', archivedAt: null };
  if (user.role === 'CLINICIAN' && user.clinicianId) {
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
