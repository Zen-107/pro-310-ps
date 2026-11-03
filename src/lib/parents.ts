import { db } from '@/lib/db';
import { normalizeCode, PARENT_CODE_LENGTH } from '@/lib/kid-login';

// Parents reach a child through the 8-character link code on the teacher's card.

export const isParentLinkCode = (code: string) => code.length === PARENT_CODE_LENGTH;

/** Child for a link code, or null */
export async function childForLinkCode(raw: unknown) {
  const code = normalizeCode(raw);
  if (!isParentLinkCode(code)) return null;
  return db.patient.findFirst({ where: { parentLinkCode: code, archivedAt: null } });
}

/** Link a parent profile to a child as GUARDIAN (idempotent) */
export async function linkParent(parentClinicianId: string, patientId: string) {
  await db.careAssignment.upsert({
    where: { patientId_clinicianId: { patientId, clinicianId: parentClinicianId } },
    create: { patientId, clinicianId: parentClinicianId, role: 'GUARDIAN' },
    update: {},
  });
}
