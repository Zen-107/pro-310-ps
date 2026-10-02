import { NextResponse } from 'next/server';
import type { Gender, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { badRequest, notFound, optionalString, readJson, serverError } from '@/lib/api-utils';
import { dateOnly, isValidDay, localDateString } from '@/lib/dates';
import { buildPatientSummaries } from '@/lib/patient-summary';

type Params = { params: Promise<{ id: string }> };
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'];

// Patient detail: summary, recent sessions, ROM per exercise, joint trends.
// Clinicians (care team) see everything; a patient sees their own record
// without clinician-only fields (notes, alerts).
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;

  try {
    const patient = await db.patient.findFirst({ where: { AND: [{ id }, patientScope(auth.user)] } });
    if (!patient) return notFound('Patient not found');

    const [[summary], sessions, careTeam] = await Promise.all([
      buildPatientSummaries([patient]),
      db.exerciseSession.findMany({
        where: { patientId: id, status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
        include: {
          exercise: { select: { name: true, nameTh: true, category: true } },
          logs: { select: { joint: true, angle: true, idealAngle: true, timestamp: true } },
        },
      }),
      db.careAssignment.findMany({
        where: { patientId: id },
        select: { role: true, clinician: { select: { id: true, title: true, user: { select: { name: true } } } } },
      }),
    ]);

    const totalReps = sessions.reduce((sum, s) => sum + s.totalReps, 0);
    const avgAccuracy = sessions.length
      ? Math.round(sessions.reduce((sum, s) => sum + s.avgAccuracy, 0) / sessions.length)
      : 0;

    // Recent vs previous accuracy (up to 5 sessions each)
    let improvementTrend = 0;
    if (sessions.length >= 4) {
      const half = Math.min(5, Math.floor(sessions.length / 2));
      const avg = (list: typeof sessions) => list.reduce((s, x) => s + x.avgAccuracy, 0) / list.length;
      improvementTrend = Math.round(avg(sessions.slice(0, half)) - avg(sessions.slice(half, half * 2)));
    }

    const latestRom = new Map<string, { exercise: string; exerciseTh: string; rom: number; accuracy: number; date: string }>();
    for (const s of sessions) {
      if (!latestRom.has(s.exerciseId)) {
        latestRom.set(s.exerciseId, {
          exercise: s.exercise.name,
          exerciseTh: s.exercise.name, // English display name (field kept for compatibility)
          rom: Math.round(s.romDegrees ?? 0),
          accuracy: Math.round(s.avgAccuracy),
          date: localDateString(s.startedAt),
        });
      }
    }

    const jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]> = {};
    for (const s of [...sessions].reverse()) {
      for (const log of s.logs) {
        (jointTrends[log.joint] ??= []).push({
          date: localDateString(log.timestamp),
          angle: log.angle,
          idealAngle: log.idealAngle,
        });
      }
    }

    const alerts: { type: 'warning' | 'info' | 'success'; message: string }[] = [];
    if (sessions.length >= 5 && improvementTrend <= 0) {
      alerts.push({ type: 'warning', message: 'กราฟพัฒนาการแบนราบ — ความแม่นยำไม่ดีขึ้นในช่วงล่าสุด' });
    }
    if (avgAccuracy >= 80 && sessions.length > 0) {
      alerts.push({ type: 'success', message: `ทำท่าได้ค่อนข้างถูกต้อง — เฉลี่ย ${avgAccuracy}%` });
    }
    if (summary.recentSessions7d >= 5) {
      alerts.push({ type: 'info', message: `ใน 7 วันที่ผ่านมาทำไป ${summary.recentSessions7d} เซสชัน` });
    }
    if (sessions.length === 0) {
      alerts.push({ type: 'warning', message: 'ยังไม่มีข้อมูลเซสชัน — คนไข้ยังไม่ได้เริ่มฝึก' });
    }

    const isClinician = auth.user.role === 'CLINICIAN';
    return NextResponse.json({
      patient: {
        ...summary,
        therapistNotes: isClinician ? summary.therapistNotes : '',
        totalReps,
        avgAccuracy,
        exercisesCompleted: new Set(sessions.map((s) => s.exerciseId)).size,
        improvementTrend,
        alerts: isClinician ? alerts : [],
        careTeam: careTeam.map((c) => ({ id: c.clinician.id, name: c.clinician.user.name, title: c.clinician.title, role: c.role })),
      },
      sessionDetails: sessions.slice(0, 20).map((s) => ({
        id: s.id,
        exerciseName: s.exercise.name,
        exerciseCategory: s.exercise.category,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
        totalReps: s.totalReps,
        avgAccuracy: Math.round(s.avgAccuracy),
        maxRom: Math.round(s.romDegrees ?? 0),
        logCount: s.logs.length,
      })),
      latestRomPerExercise: [...latestRom.values()],
      jointTrends,
    });
  } catch (error) {
    return serverError('Patient detail error', error);
  }
}

// Update profile / clinical notes (care-team clinicians only)
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');

  const data: Prisma.PatientUpdateInput = {};
  if (body.name !== undefined) {
    const name = optionalString(body.name, 200);
    if (!name) return badRequest('name cannot be empty');
    data.name = name;
  }
  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth !== null && !isValidDay(body.dateOfBirth)) return badRequest('dateOfBirth must be YYYY-MM-DD');
    data.dateOfBirth = body.dateOfBirth ? dateOnly(body.dateOfBirth as string) : null;
  }
  if (body.gender !== undefined) {
    if (!GENDERS.includes(body.gender as Gender)) return badRequest(`gender must be one of ${GENDERS.join(', ')}`);
    data.gender = body.gender as Gender;
  }
  if (body.condition !== undefined) data.condition = optionalString(body.condition) ?? null;
  if (body.phone !== undefined) data.phone = optionalString(body.phone, 50) ?? null;
  // `therapistNotes` accepted as an alias used by older screens
  const notes = body.clinicalNotes ?? body.therapistNotes;
  if (notes !== undefined) data.clinicalNotes = optionalString(notes, 10000) ?? null;

  try {
    const patient = await db.patient.findFirst({ where: { AND: [{ id }, patientScope(auth.user)] } });
    if (!patient) return notFound('Patient not found');
    const updated = await db.patient.update({ where: { id }, data });
    const [summary] = await buildPatientSummaries([updated]);
    return NextResponse.json(summary);
  } catch (error) {
    return serverError('Patient PATCH error', error);
  }
}

// Archive (medical records are never hard-deleted)
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    const patient = await db.patient.findFirst({ where: { AND: [{ id }, patientScope(auth.user)] } });
    if (!patient) return notFound('Patient not found');
    await db.patient.update({ where: { id }, data: { archivedAt: new Date() } });
    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    return serverError('Patient DELETE error', error);
  }
}
