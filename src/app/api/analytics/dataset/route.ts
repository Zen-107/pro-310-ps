import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { FaultType } from '@prisma/client';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { patientScope } from '@/lib/access';
import { serverError } from '@/lib/api-utils';
import { ageFromDob, dateOnlyString, localDateString } from '@/lib/dates';
import { DEMO_NOTE } from '@/lib/demo-data';
import { dailyDeficits, forecastRecovery, type SessionPoint } from '@/lib/recovery-forecast';
import { estimateRate } from '@/lib/population-model';
import { sessionTarget } from '@/lib/population-refs';

// De-identified training dataset for a future outcome model (care team only).
// One row per prescribed exercise (prescription item): features measured
// during the plan + the outcome the clinician recorded when it ended.
//
//   GET /api/analytics/dataset            CSV (download)
//   GET /api/analytics/dataset?format=json
//
// No names, HN, dates of birth, free text or exact dates: patients and rows
// get keyed hashes (stable within this deployment), age is a 5-year band and
// time is days since the plan started. `simulated` marks demo-seed data.

const FAULTS: FaultType[] = ['INCOMPLETE_ROM', 'COMPENSATION', 'LOW_ACCURACY'];

const COLUMNS = [
  'row_key', 'patient_key', 'simulated', 'age_band', 'gender', 'exercise', 'plan_status', 'plan_days',
  'sets', 'reps_per_set', 'quests_due', 'quests_completed', 'adherence_pct', 'sessions', 'practice_days',
  'baseline_deficit_deg', 'final_deficit_deg', 'rate_ln_per_day', 'forecast_status', 'avg_accuracy',
  'incomplete_rom_per_rep', 'compensation_per_rep', 'low_accuracy_per_rep', 'red_flag_messages',
  'outcome', 'outcome_day',
] as const;
type Row = Record<(typeof COLUMNS)[number], string | number | boolean | null>;

const DAY_MS = 86_400_000;
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

export async function GET(req: Request) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'csv';
  const salt = process.env.NEXTAUTH_SECRET ?? 'ai-physio';
  const key = (id: string) => createHash('sha256').update(`${salt}:${id}`).digest('hex').slice(0, 12);

  try {
    const items = await db.prescriptionItem.findMany({
      where: { prescription: { patient: patientScope(auth.user) } },
      orderBy: { prescription: { startDate: 'asc' } },
      select: {
        id: true,
        sets: true,
        repsPerSet: true,
        exercise: { select: { slug: true } },
        prescription: {
          select: {
            status: true, startDate: true, endDate: true, outcome: true, outcomeAt: true,
            patient: { select: { id: true, dateOfBirth: true, gender: true } },
          },
        },
        quests: { where: { status: { in: ['COMPLETED', 'MISSED'] } }, select: { status: true } },
        sessions: {
          where: { status: 'COMPLETED' },
          orderBy: { startedAt: 'asc' },
          select: {
            startedAt: true, romMinAngle: true, romMaxAngle: true, primaryJoint: true, targetSnapshot: true,
            avgAccuracy: true, totalReps: true, notes: true, faults: { select: { type: true } },
          },
        },
      },
    });

    const patientIds = [...new Set(items.map((i) => i.prescription.patient.id))];
    const escalations = await db.careMessage.findMany({
      where: { patientId: { in: patientIds }, escalated: true },
      select: { patientId: true, createdAt: true },
    });

    const rows: Row[] = items.map((item) => {
      const rx = item.prescription;
      const start = rx.startDate.getTime();
      const end = (rx.endDate ?? rx.outcomeAt ?? new Date()).getTime();
      const points: SessionPoint[] = item.sessions.map((s) => ({
        day: localDateString(s.startedAt),
        romMinAngle: s.romMinAngle,
        romMaxAngle: s.romMaxAngle,
        target: sessionTarget(s.targetSnapshot, s.primaryJoint),
      }));
      const daily = dailyDeficits(points);
      const forecast = forecastRecovery(points);
      const rate = estimateRate(daily);
      const reps = item.sessions.reduce((n, s) => n + Math.max(s.totalReps, 1), 0);
      const perRep = (t: FaultType) => (item.sessions.length ? round(item.sessions.reduce((n, s) => n + s.faults.filter((f) => f.type === t).length, 0) / reps) : null);
      const completed = item.quests.filter((q) => q.status === 'COMPLETED').length;
      const age = ageFromDob(rx.patient.dateOfBirth);

      return {
        row_key: key(item.id),
        patient_key: key(rx.patient.id),
        simulated: item.sessions.some((s) => s.notes === DEMO_NOTE),
        age_band: age === null ? null : `${Math.floor(age / 5) * 5}-${Math.floor(age / 5) * 5 + 4}`,
        gender: rx.patient.gender,
        exercise: item.exercise.slug,
        plan_status: rx.status,
        plan_days: Math.max(0, Math.round((end - start) / DAY_MS)),
        sets: item.sets,
        reps_per_set: item.repsPerSet,
        quests_due: item.quests.length,
        quests_completed: completed,
        adherence_pct: item.quests.length ? Math.round((completed / item.quests.length) * 100) : null,
        sessions: item.sessions.length,
        practice_days: daily.length,
        baseline_deficit_deg: daily.length ? daily[0].deficit : null,
        final_deficit_deg: forecast.currentDeficit,
        rate_ln_per_day: rate ? round(rate.rate, 4) : null,
        forecast_status: forecast.status,
        avg_accuracy: item.sessions.length ? Math.round(item.sessions.reduce((a, s) => a + s.avgAccuracy, 0) / item.sessions.length) : null,
        incomplete_rom_per_rep: perRep(FAULTS[0]),
        compensation_per_rep: perRep(FAULTS[1]),
        low_accuracy_per_rep: perRep(FAULTS[2]),
        red_flag_messages: escalations.filter((m) => m.patientId === rx.patient.id && m.createdAt.getTime() >= start && m.createdAt.getTime() <= end + DAY_MS).length,
        outcome: rx.outcome,
        outcome_day: rx.outcomeAt ? Math.round((rx.outcomeAt.getTime() - start) / DAY_MS) : null,
      };
    });

    if (format === 'json') {
      return NextResponse.json({ generatedAt: new Date().toISOString(), columns: COLUMNS, rows, labelled: rows.filter((r) => r.outcome !== null).length });
    }
    const cell = (v: Row[keyof Row]) => (v === null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ai-physio-outcomes-${dateOnlyString(new Date())}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return serverError('Analytics dataset error', error);
  }
}
