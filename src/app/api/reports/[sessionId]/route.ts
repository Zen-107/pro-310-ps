import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser, type SessionUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { jsonError, notFound, serverError } from '@/lib/api-utils';
import { ANGLE_DEFINITION, JOINT_FORMULAS } from '@/lib/joint-formulas';
import { summarizeSession } from '@/lib/ai-agent';
import { displayText, TEXT_LIMITS, type TargetDTO } from '@/lib/presenters';

type Params = { params: Promise<{ sessionId: string }> };

// How the metrics in this report are computed (shown to clinicians)
const SCORING = {
  accuracy: 'accuracy = max(0, 100 − |angle − ideal| ÷ ((max − min) ÷ 2) × 50); a rep is scored on its best angle while in range',
  rep: 'rep = enter [min, max] → hold ≥ 300 ms → leave the range by ≥ 5°; left/right sides tracked separately, both sides within 800 ms count once',
  rom: 'ROM = max − min of the primary measurement over visible frames',
  sessionAccuracy: 'session accuracy = mean of per-rep accuracy',
  incompleteRom: 'INCOMPLETE_ROM = moved ≥ 10° from rest toward the range but returned without reaching it; deficit = degrees short of the nearest range edge',
  compensation: 'COMPENSATION = a form check failed at the rep’s best moment (e.g. lifted knee < 160° in a straight leg raise); deficit = degrees beyond the allowed value',
  lowAccuracy: 'LOW_ACCURACY = counted rep with accuracy < 60%; a rep with COMPENSATION or LOW_ACCURACY is marked incorrect',
};

async function loadSession(user: SessionUser, id: string) {
  return db.exerciseSession.findFirst({
    where: { AND: [{ id }, sessionScope(user)] },
    include: {
      exercise: true,
      patient: { select: { name: true } },
      reps: { orderBy: { repNumber: 'asc' } },
      logs: true,
      faults: { orderBy: { occurredAt: 'asc' }, include: { rep: { select: { repNumber: true } } } },
      review: { include: { clinician: { select: { title: true, user: { select: { name: true } } } } } },
      reports: { orderBy: { generatedAt: 'desc' }, take: 1 },
    },
  });
}

type LoadedSession = NonNullable<Awaited<ReturnType<typeof loadSession>>>;

function buildReport(s: LoadedSession, isClinician: boolean) {
  const snapshot = (s.targetSnapshot ?? {}) as { targets?: TargetDTO[]; angleDefinition?: string };
  const targets = snapshot.targets ?? [];
  const targetByJoint = new Map(targets.map((t) => [t.name, t]));

  const byJoint = new Map<string, typeof s.logs>();
  for (const l of s.logs) byJoint.set(l.joint, [...(byJoint.get(l.joint) ?? []), l]);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const jointReport = [...byJoint.entries()].map(([joint, logs]) => {
    const angles = logs.map((l) => l.angle);
    const t = targetByJoint.get(joint);
    return {
      joint,
      nameTh: t?.nameTh ?? joint,
      formula: t?.formula ?? JOINT_FORMULAS[joint] ?? null,
      target: t ? { idealAngle: t.idealAngle, minAngle: t.minAngle, maxAngle: t.maxAngle, angleBasis: t.angleBasis } : null,
      samples: logs.length,
      avgAngle: Math.round(mean(angles)),
      maxAngle: Math.round(Math.max(...angles)),
      minAngle: Math.round(Math.min(...angles)),
      avgDeviation: Math.round(mean(logs.map((l) => l.deviation))),
      accuracy: Math.round((logs.filter((l) => l.isCorrect).length / logs.length) * 100),
    };
  });

  const faultCounts = { INCOMPLETE_ROM: 0, COMPENSATION: 0, LOW_ACCURACY: 0 };
  const byCheck = new Map<string, { checkId: string; message: string; count: number }>();
  for (const f of s.faults) {
    faultCounts[f.type]++;
    if (f.type === 'COMPENSATION') {
      const key = f.checkId ?? f.message;
      const entry = byCheck.get(key) ?? { checkId: key, message: displayText(f.message, TEXT_LIMITS.faultMessage) ?? '', count: 0 };
      entry.count++;
      byCheck.set(key, entry);
    }
  }
  const incompleteDeficits = s.faults.filter((f) => f.type === 'INCOMPLETE_ROM' && f.deficit !== null).map((f) => f.deficit as number);

  const stored = s.reports[0];
  return {
    sessionId: s.id,
    patientName: s.patient.name,
    exerciseName: s.exercise.name,
    exerciseNameEn: s.exercise.name,
    category: s.exercise.category,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    totalReps: s.totalReps,
    avgAccuracy: Math.round(s.avgAccuracy),
    maxRom: Math.round(s.romDegrees ?? 0),
    romMinAngle: s.romMinAngle,
    romMaxAngle: s.romMaxAngle,
    primaryJoint: s.primaryJoint,
    algorithmVersion: s.algorithmVersion,
    angleDefinition: snapshot.angleDefinition ?? ANGLE_DEFINITION,
    scoring: SCORING,
    targets,
    jointReport,
    reps: s.reps.map((r) => ({
      setNumber: r.setNumber,
      repNumber: r.repNumber,
      bestAngle: Math.round(r.bestAngle * 10) / 10,
      accuracy: Math.round(r.accuracy),
      durationMs: r.durationMs,
      isCorrect: r.isCorrect,
      enteredAt: r.enteredAt.toISOString(),
    })),
    faults: {
      total: s.faults.length,
      counts: faultCounts,
      incorrectReps: s.reps.filter((r) => !r.isCorrect).length,
      avgIncompleteDeficit: incompleteDeficits.length ? Math.round(mean(incompleteDeficits) * 10) / 10 : null,
      compensations: [...byCheck.values()].sort((a, b) => b.count - a.count),
      items: s.faults.map((f) => ({
        type: f.type,
        repNumber: f.rep?.repNumber ?? null,
        joint: f.joint,
        measuredAngle: f.measuredAngle,
        expectedMin: f.expectedMin,
        expectedMax: f.expectedMax,
        deficit: f.deficit,
        message: displayText(f.message, TEXT_LIMITS.faultMessage) ?? '',
        occurredAt: f.occurredAt.toISOString(),
      })),
    },
    clinicalSummary: isClinician ? stored?.content ?? null : null,
    generatedAt: isClinician ? stored?.generatedAt.toISOString() ?? null : null,
    reportModel: isClinician ? stored?.model ?? null : null,
    review: s.review && {
      status: s.review.status,
      comment: isClinician ? displayText(s.review.comment, TEXT_LIMITS.notes) : null,
      reviewedAt: s.review.reviewedAt.toISOString(),
      reviewer: { name: s.review.clinician.user.name, title: s.review.clinician.title },
    },
  };
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { sessionId } = await params;
  try {
    const s = await loadSession(auth.user, sessionId);
    if (!s) return notFound('Session not found');
    return NextResponse.json(buildReport(s, auth.user.role === 'CLINICIAN'));
  } catch (error) {
    return serverError('Report GET error', error);
  }
}

// Generate and store an AI clinical summary (Reporter agent), care-team clinician
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { sessionId } = await params;

  try {
    const s = await loadSession(auth.user, sessionId);
    if (!s) return notFound('Session not found');
    if (s.status !== 'COMPLETED') return jsonError('Reports can only be generated for completed sessions', 409);
    const report = buildReport(s, true);

    let summary;
    try {
      summary = await summarizeSession({ ...report, startedAt: s.startedAt, endedAt: s.endedAt });
    } catch (error) {
      console.error('AI report error:', error);
      return jsonError('The AI service returned no report', 502);
    }

    const stored = await db.clinicalReport.create({
      data: { sessionId, content: summary.content, model: summary.model },
    });
    return NextResponse.json({
      ...report,
      clinicalSummary: stored.content,
      generatedAt: stored.generatedAt.toISOString(),
      reportModel: stored.model,
    });
  } catch (error) {
    return serverError('Report generation error', error);
  }
}
