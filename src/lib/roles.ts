import type { UserRole } from '@prisma/client';

// Who may do what (kids branch). DB role names are kept from the clinical app:
//   PATIENT   = child
//   CLINICIAN = physio expert (exercise library, session review, reports)
//   TEACHER   = class teacher (classes, kid cards, class mission sets)
//   PARENT    = parent / guardian (consent, progress, plays at home)
// Every adult reaches a child through a CareAssignment (src/lib/access.ts).

export const KID: UserRole[] = ['PATIENT'];
/** Every adult with an adult profile (Clinician row) */
export const ADULTS: UserRole[] = ['CLINICIAN', 'TEACHER', 'PARENT'];
/** School-side adults: dashboards, insights, full reports */
export const STAFF: UserRole[] = ['CLINICIAN', 'TEACHER'];
/** Manage classes, kid cards and class mission sets */
export const ASSIGNERS: UserRole[] = ['TEACHER'];
/** Give one child missions and change that child's plans (decision 0005) */
export const PLAN_EDITORS: UserRole[] = ['TEACHER', 'CLINICIAN'];

/**
 * A class mission set (classroomId set) is one set copied to every child, so
 * only the teacher changes it; the expert changes the child's own plans.
 */
export const mayEditPlan = (role: UserRole, plan: { classroomId: string | null }) => role === 'TEACHER' || plan.classroomId === null;
export const CLASS_SET_MESSAGE = 'Class mission sets are changed by the teacher';
export const EXPERTS: UserRole[] = ['CLINICIAN'];
/** Care chat about a child: the expert and the child's parents (adults only) */
export const CHAT: UserRole[] = ['CLINICIAN', 'PARENT'];
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
