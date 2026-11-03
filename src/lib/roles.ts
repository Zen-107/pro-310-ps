import type { UserRole } from '@prisma/client';

// Who may do what (kids branch). DB role names are kept from the clinical app:
//   PATIENT   = child
//   CLINICIAN = physio expert (exercise library, session review, reports)
//   TEACHER   = class teacher (the only role that assigns missions)
//   PARENT    = parent / guardian (consent, progress, plays at home)
// Every adult reaches a child through a CareAssignment (src/lib/access.ts).

export const KID: UserRole[] = ['PATIENT'];
/** Every adult with an adult profile (Clinician row) */
export const ADULTS: UserRole[] = ['CLINICIAN', 'TEACHER', 'PARENT'];
/** School-side adults: dashboards, insights, full reports */
export const STAFF: UserRole[] = ['CLINICIAN', 'TEACHER'];
/** Create / change mission sets */
export const ASSIGNERS: UserRole[] = ['TEACHER'];
export const EXPERTS: UserRole[] = ['CLINICIAN'];
/** Anyone who can read a child's progress (the child included) */
export const ANYONE_WITH_CHILD: UserRole[] = [...KID, ...ADULTS];

export const isKid = (role: UserRole) => role === 'PATIENT';
export const isAdult = (role: UserRole) => ADULTS.includes(role);
export const isStaff = (role: UserRole) => STAFF.includes(role);

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  CLINICIAN: 'ผู้เชี่ยวชาญ',
  TEACHER: 'คุณครู',
  PARENT: 'ผู้ปกครอง',
  PATIENT: 'นักเรียน',
};
