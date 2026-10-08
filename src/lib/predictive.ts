// Predictive analytics service (server only): recovery forecasts with the
// population model, and the early-warning risk score, per patient.
//
//   lib/recovery-forecast.ts   one patient's own trend → ETA / plateau / declining
//   lib/population-model.ts    the clinic's other patients → prior → early, sharper ETA
//   lib/risk-score.ts          explainable early-warning score from the above + adherence, activity, red flags

import { db } from '@/lib/db';
import { addDays, dateOnly, localDateString } from '@/lib/dates';
import { computeFaultTrends, computeRecoveryForecasts, type ExerciseForecast, type ExerciseTrend } from '@/lib/ai-agent';
import { loadReferenceRates, type ReferenceRates } from '@/lib/population-refs';
import { RISK, assessRisk, type RiskAssessment } from '@/lib/risk-score';

const ADHERENCE_DAYS = 28;

export interface PatientPrediction {
  patientId: string;
  generatedAt: string;
  risk: RiskAssessment;
  forecasts: ExerciseForecast[];
  trends: ExerciseTrend[];
  sessionsAnalysed: number;
  adherence: number | null;
  daysSinceLastSession: number | null;
}

export async function predictPatient(patientId: string, ctx: { references?: ReferenceRates } = {}): Promise<PatientPrediction | null> {
  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { organizationId: true } });
  if (!patient) return null;
  const references = ctx.references ?? (await loadReferenceRates(patient.organizationId));
  const today = localDateString();

  const [forecasts, { trends, sessions }, redFlagMessages, quests, lastSession, activePlans] = await Promise.all([
    computeRecoveryForecasts(patientId, { references }),
    computeFaultTrends(patientId),
    db.careMessage.count({
      where: { patientId, escalated: true, createdAt: { gte: new Date(Date.now() - RISK.RED_FLAG_WINDOW_DAYS * 86_400_000) } },
    }),
    db.quest.findMany({
      where: { patientId, dueDate: { gte: dateOnly(addDays(today, -ADHERENCE_DAYS)), lt: dateOnly(today) }, status: { in: ['COMPLETED', 'MISSED'] } },
      select: { status: true },
    }),
    db.exerciseSession.findFirst({ where: { patientId, status: 'COMPLETED' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
    db.prescription.count({ where: { patientId, status: 'ACTIVE' } }),
  ]);

  const adherence = quests.length ? Math.round((quests.filter((q) => q.status === 'COMPLETED').length / quests.length) * 100) : null;
  const daysSinceLastSession = lastSession
    ? Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${localDateString(lastSession.startedAt)}T00:00:00Z`)) / 86_400_000))
    : null;

  const risk = assessRisk({
    redFlagMessages,
    forecasts: forecasts.map((f) => ({
      exerciseTh: f.exerciseTh,
      status: f.forecast.status,
      adherence: f.adherence,
      slowResponder: f.population?.slowResponder ?? false,
      fasterThanPercent: f.population?.fasterThanPercent ?? null,
    })),
    adherence,
    daysSinceLastSession,
    hasActivePlan: activePlans > 0,
    trends: trends.map((t) => ({ exerciseTh: t.exerciseTh, flags: t.flags, sessions: t.sessions, lastAccuracy: t.accuracy.last })),
  });

  return { patientId, generatedAt: new Date().toISOString(), risk, forecasts, trends, sessionsAnalysed: sessions, adherence, daysSinceLastSession };
}

/** Predictions for many patients, loading each organization's reference rates once */
export async function predictPatients(patients: { id: string; organizationId: string }[]): Promise<Map<string, PatientPrediction>> {
  const refsByOrg = new Map<string, Promise<ReferenceRates>>();
  const refs = (orgId: string) => {
    if (!refsByOrg.has(orgId)) refsByOrg.set(orgId, loadReferenceRates(orgId));
    return refsByOrg.get(orgId)!;
  };
  const results = await Promise.all(patients.map(async (p) => predictPatient(p.id, { references: await refs(p.organizationId) })));
  return new Map(results.filter((r): r is PatientPrediction => r !== null).map((r) => [r.patientId, r]));
}
