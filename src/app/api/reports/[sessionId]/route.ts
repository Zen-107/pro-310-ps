import ZAI from 'z-ai-web-dev-sdk';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser, type SessionUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { jsonError, notFound, serverError } from '@/lib/api-utils';
import { ANGLE_DEFINITION, JOINT_FORMULAS } from '@/lib/joint-formulas';
import type { TargetDTO } from '@/lib/presenters';

type Params = { params: Promise<{ sessionId: string }> };

// How the metrics in this report are computed (shown to clinicians)
const SCORING = {
  accuracy: 'accuracy = max(0, 100 − |angle − ideal| ÷ ((max − min) ÷ 2) × 50); a rep is scored on its best angle while in range',
  rep: 'rep = enter [min, max] → hold ≥ 300 ms → leave the range by ≥ 5°; left/right sides tracked separately, both sides within 800 ms count once',
  rom: 'ROM = max − min of the primary measurement over visible frames',
  sessionAccuracy: 'session accuracy = mean of per-rep accuracy',
};

async function loadSession(user: SessionUser, id: string) {
  return db.exerciseSession.findFirst({
    where: { AND: [{ id }, sessionScope(user)] },
    include: {
      exercise: true,
      patient: { select: { name: true } },
      reps: { orderBy: { repNumber: 'asc' } },
      logs: true,
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

  const stored = s.reports[0];
  return {
    sessionId: s.id,
    patientName: s.patient.name,
    exerciseName: s.exercise.nameTh,
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
    })),
    clinicalSummary: isClinician ? stored?.content ?? null : null,
    generatedAt: isClinician ? stored?.generatedAt.toISOString() ?? null : null,
    reportModel: isClinician ? stored?.model ?? null : null,
    review: s.review && {
      status: s.review.status,
      comment: isClinician ? s.review.comment : null,
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

    const jointLines = report.jointReport
      .map((j) => {
        const range = j.target ? `เป้าหมาย ${j.target.minAngle}–${j.target.maxAngle}° (ideal ${j.target.idealAngle}°)` : 'ไม่มีเป้าหมาย';
        return `- ${j.nameTh} [${j.formula ?? '-'}]: เฉลี่ย ${j.avgAngle}° (ต่ำสุด ${j.minAngle}°, สูงสุด ${j.maxAngle}°), ${range}, ถูกต้อง ${j.accuracy}% จาก ${j.samples} ครั้ง`;
      })
      .join('\n');

    const prompt = `สร้าง Clinical Summary Report สำหรับนักกายภาพบำบัด

ข้อมูลเซสชัน:
- ท่าทาง: ${report.exerciseName} (${report.exerciseNameEn}), หมวด ${report.category}
- เวลา: ${s.startedAt.toLocaleString('th-TH')} – ${s.endedAt?.toLocaleString('th-TH') ?? '-'}
- จำนวนครั้ง: ${report.totalReps}, ความแม่นยำเฉลี่ย ${report.avgAccuracy}%
- ROM (${report.primaryJoint ?? '-'}): ${report.maxRom}° (ช่วง ${report.romMinAngle ?? '-'}° – ${report.romMaxAngle ?? '-'}°)

วิธีคำนวณ:
- มุม: ${report.angleDefinition}
- ${report.scoring.accuracy}
- ${report.scoring.rom}

ข้อมูลข้อต่อแต่ละจุด:
${jointLines || '- ไม่มีข้อมูลข้อต่อ'}

กรุณาสรุปเป็นรายงานคลินิกภาษาไทย 3-4 ย่อหน้า:
1. สรุปผลการฝึก
2. การวิเคราะห์ข้อต่อแต่ละจุด (อ้างอิงตัวเลขด้านบน)
3. คำแนะนำสำหรับครั้งต่อไป
4. ระดับความเสี่ยง (ถ้ามี)

หมายเหตุ: ข้อมูลมาจากการตรวจจับท่าทางด้วย AI แพทย์ควรพิจารณาร่วมกับการตรวจร่างกาย ห้ามเปลี่ยนแผนการรักษาเอง`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'คุณคือนักกายภาพบำบัดที่เขียนรายงานคลินิก ใช้ภาษาไทยที่เป็นมืออาชีพ แต่อ่านง่าย' },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return jsonError('The AI service returned no report', 502);

    const stored = await db.clinicalReport.create({
      data: { sessionId, content, model: (completion as { model?: string }).model ?? 'z-ai' },
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
