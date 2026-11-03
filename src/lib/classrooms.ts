import { randomBytes } from 'crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth-guard';
import { hashPassword } from '@/lib/password';
import { dateOnly, localDateString } from '@/lib/dates';
import { ensureQuestsForDay } from '@/lib/quests';
import { computeStreak } from '@/lib/presenters';
import { childHasConsent } from '@/lib/terms';
import { hasValidVideoConsent } from '@/lib/consent';
import { starsFor, AVATARS } from '@/lib/kids';
import type { ItemInput } from '@/lib/prescriptions';
import {
  hashPicturePin,
  newCode,
  PARENT_CODE_LENGTH,
  randomPicturePin,
  type PictureId,
} from '@/lib/kid-login';

// Classroom logic shared by the /api/classrooms routes and the seed.

type Tx = Prisma.TransactionClient;

/** Classroom of the signed-in teacher (or any classroom of an expert's organization), or null */
export async function findClassroomFor(user: SessionUser, classroomId: string) {
  if (!user.clinicianId) return null;
  if (user.role === 'TEACHER') {
    return db.classroom.findFirst({ where: { id: classroomId, teacherId: user.clinicianId, archivedAt: null } });
  }
  if (user.role === 'CLINICIAN' && user.organizationId) {
    return db.classroom.findFirst({ where: { id: classroomId, organizationId: user.organizationId, archivedAt: null } });
  }
  return null;
}

/** A unique code for one of the Patient code columns (retries on the rare collision) */
async function uniqueCode(tx: Tx, field: 'kidCode' | 'parentLinkCode', length?: number): Promise<string> {
  for (;;) {
    const code = newCode(length);
    const taken = await tx.patient.findFirst({ where: { [field]: code }, select: { id: true } });
    if (!taken) return code;
  }
}

export interface NewKidCard {
  id: string;
  name: string;
  nickname: string | null;
  kidCode: string;
  pictures: PictureId[];
  parentLinkCode: string;
}

/**
 * Create a child in a classroom: login user (no email login; a synthetic
 * address), kid code + picture password, parent link code, teacher care
 * assignment, class membership and the class's active mission sets.
 * Returns the printable card (the only time the pictures are shown).
 */
export async function createKidInClassroom(
  tx: Tx,
  classroom: { id: string; organizationId: string; teacherId: string },
  kid: { name: string; nickname?: string | null; avatar?: string | null; pictures?: PictureId[] }
): Promise<NewKidCard> {
  const kidCode = await uniqueCode(tx, 'kidCode');
  const parentLinkCode = await uniqueCode(tx, 'parentLinkCode', PARENT_CODE_LENGTH);
  const pictures = kid.pictures ?? randomPicturePin();
  const nickname = kid.nickname?.trim() || null;
  const patient = await tx.patient.create({
    data: {
      name: kid.name,
      nickname,
      avatar: kid.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)].id,
      kidCode,
      picturePinHash: await hashPicturePin(pictures),
      parentLinkCode,
      organization: { connect: { id: classroom.organizationId } },
      user: {
        create: {
          email: `kid-${randomBytes(9).toString('base64url').toLowerCase()}@kids.aiphysio.local`,
          name: nickname || kid.name,
          role: 'PATIENT',
          passwordHash: await hashPassword(randomBytes(24).toString('base64url')),
        },
      },
      careAssignments: { create: { clinicianId: classroom.teacherId, role: 'TEACHER' } },
      classrooms: { create: { classroomId: classroom.id } },
    },
  });
  await copyClassPlansTo(tx, classroom.id, patient.id);
  return { id: patient.id, name: patient.name, nickname, kidCode, pictures, parentLinkCode };
}

const planItemsInclude = { items: { include: { targetOverrides: true } } } satisfies Prisma.PrescriptionInclude;

/** A child joining late gets every active class mission set (copied from a classmate's) */
async function copyClassPlansTo(tx: Tx, classroomId: string, patientId: string) {
  const plans = await tx.prescription.findMany({
    where: { classroomId, status: 'ACTIVE' },
    include: planItemsInclude,
    orderBy: { createdAt: 'asc' },
  });
  const seen = new Set<string>();
  for (const p of plans) {
    if (seen.has(p.title)) continue;
    seen.add(p.title);
    await tx.prescription.create({
      data: {
        title: p.title,
        notes: p.notes,
        startDate: dateOnly(localDateString()),
        endDate: p.endDate,
        patientId,
        clinicianId: p.clinicianId,
        classroomId,
        items: {
          create: p.items.map((i) => ({
            exerciseId: i.exerciseId,
            sets: i.sets,
            repsPerSet: i.repsPerSet,
            restSeconds: i.restSeconds,
            daysOfWeek: i.daysOfWeek,
            sortOrder: i.sortOrder,
            notes: i.notes,
            targetOverrides: {
              create: i.targetOverrides.map((o) => ({ joint: o.joint, idealAngle: o.idealAngle, minAngle: o.minAngle, maxAngle: o.maxAngle })),
            },
          })),
        },
      },
    });
  }
}

/** One mission set for every child in the class (one Prescription each, linked by classroomId) */
export async function assignToClassroom(
  tx: Tx,
  classroom: { id: string; teacherId: string },
  plan: { title: string; notes: string | null; startDate: string; endDate: string | null; items: ItemInput[] }
): Promise<number> {
  const members = await tx.classroomMember.findMany({
    where: { classroomId: classroom.id, patient: { archivedAt: null } },
    select: { patientId: true },
  });
  for (const m of members) {
    await tx.prescription.create({
      data: {
        title: plan.title,
        notes: plan.notes,
        startDate: dateOnly(plan.startDate),
        endDate: plan.endDate ? dateOnly(plan.endDate) : null,
        patientId: m.patientId,
        clinicianId: classroom.teacherId,
        classroomId: classroom.id,
        items: {
          create: plan.items.map((i, idx) => ({
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
    });
  }
  return members.length;
}

/**
 * Today's quests exist only once generated (lazily, when a child opens the
 * app); generate them for every child so the teacher's "today" is complete.
 */
export async function ensureClassQuestsToday(classroomIds: string[]) {
  const members = await db.classroomMember.findMany({
    where: { classroomId: { in: classroomIds }, patient: { archivedAt: null } },
    select: { patientId: true },
  });
  const day = localDateString();
  for (const m of members) await ensureQuestsForDay(m.patientId, day);
}

/** Classroom page data: students with today's progress and the active class mission sets */
export async function classroomDetail(classroomId: string) {
  await ensureClassQuestsToday([classroomId]);
  const today = dateOnly(localDateString());
  const since = new Date(Date.now() - 7 * 86_400_000);
  const classroom = await db.classroom.findUniqueOrThrow({
    where: { id: classroomId },
    include: {
      teacher: { select: { user: { select: { name: true } } } },
      members: {
        where: { patient: { archivedAt: null } },
        include: {
          patient: {
            include: {
              careAssignments: { where: { role: 'GUARDIAN' }, select: { clinician: { select: { user: { select: { name: true } } } } } },
              quests: { where: { dueDate: today }, select: { status: true } },
              sessions: {
                where: { status: 'COMPLETED' },
                select: { startedAt: true, endedAt: true, avgAccuracy: true },
                orderBy: { startedAt: 'desc' },
                take: 60,
              },
            },
          },
        },
        orderBy: { patient: { name: 'asc' } },
      },
      prescriptions: {
        where: { status: 'ACTIVE' },
        include: { items: { include: { exercise: { select: { id: true, slug: true, name: true, nameTh: true } } }, orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Class mission sets: one per title (each child holds a copy)
  const plans = new Map<string, { title: string; notes: string | null; startDate: string; endDate: string | null; kids: number; items: { exerciseId: string; slug: string; name: string; nameTh: string; sets: number; repsPerSet: number; daysOfWeek: number[] }[] }>();
  for (const p of classroom.prescriptions) {
    const existing = plans.get(p.title);
    if (existing) {
      existing.kids++;
      continue;
    }
    plans.set(p.title, {
      title: p.title,
      notes: p.notes,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
      kids: 1,
      items: p.items.map((i) => ({
        exerciseId: i.exercise.id,
        slug: i.exercise.slug,
        name: i.exercise.name,
        nameTh: i.exercise.nameTh,
        sets: i.sets,
        repsPerSet: i.repsPerSet,
        daysOfWeek: i.daysOfWeek,
      })),
    });
  }

  const students = classroom.members.map(({ patient: p }) => {
    const week = p.sessions.filter((s) => s.startedAt >= since);
    const weekAccuracy = week.length ? week.reduce((a, s) => a + s.avgAccuracy, 0) / week.length : null;
    return {
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      avatar: p.avatar,
      kidCode: p.kidCode,
      parentLinkCode: p.parentLinkCode,
      parents: p.careAssignments.map((c) => c.clinician.user.name),
      hasConsent: childHasConsent(p),
      schoolConsent: p.schoolConsentAt !== null,
      videoConsent: hasValidVideoConsent(p),
      today: { total: p.quests.length, done: p.quests.filter((q) => q.status === 'COMPLETED').length },
      streak: computeStreak(p.sessions),
      sessions7d: week.length,
      stars7d: weekAccuracy === null ? null : starsFor(weekAccuracy),
      accuracy7d: weekAccuracy === null ? null : Math.round(weekAccuracy),
      lastPlayedAt: p.sessions[0]?.startedAt.toISOString() ?? null,
    };
  });

  return {
    id: classroom.id,
    name: classroom.name,
    gradeLabel: classroom.gradeLabel,
    teacherName: classroom.teacher.user.name,
    students,
    plans: [...plans.values()],
  };
}
