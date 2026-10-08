// Reference recovery rates for the population model (lib/population-model.ts),
// loaded from one organization's completed sessions. Server only.
//
// Every patient of the organization counts as a reference, including archived
// (discharged) ones: their measured progress is exactly the history new
// patients are compared with. Only aggregates (mean rate, spread, count) leave
// this module; no other patient's data reaches the requesting clinician.

import { db } from '@/lib/db';
import { localDateString } from '@/lib/dates';
import { dailyDeficits, type RangeTarget, type SessionPoint } from '@/lib/recovery-forecast';
import { POPULATION, estimateRate, poolRates, type PopulationPrior, type RateEstimate } from '@/lib/population-model';
import { snapshotSide } from '@/lib/exercises-data';

export const REFERENCE_LOOKBACK_DAYS = 365;

/** exerciseId → series (patientId, or patientId#side for one-side-at-a-time exercises) → that series' recovery rate */
export type ReferenceRates = Map<string, Map<string, RateEstimate>>;

export type SnapshotTarget = RangeTarget & { nameTh?: string };

/** Target of the session's measured joint (its primary joint, else the exercise's primary target) */
export function sessionTarget(snapshot: unknown, primaryJoint: string | null): SnapshotTarget | null {
  const targets = ((snapshot ?? {}) as { targets?: SnapshotTarget[] }).targets ?? [];
  return targets.find((t) => t.name === primaryJoint) ?? targets.find((t) => t.isPrimary) ?? targets[0] ?? null;
}

export async function loadReferenceRates(organizationId: string): Promise<ReferenceRates> {
  const sessions = await db.exerciseSession.findMany({
    where: {
      status: 'COMPLETED',
      startedAt: { gte: new Date(Date.now() - REFERENCE_LOOKBACK_DAYS * 86_400_000) },
      patient: { organizationId },
    },
    select: { patientId: true, exerciseId: true, startedAt: true, romMinAngle: true, romMaxAngle: true, primaryJoint: true, targetSnapshot: true },
  });

  const grouped = new Map<string, Map<string, SessionPoint[]>>();
  for (const s of sessions) {
    const byPatient = grouped.get(s.exerciseId) ?? new Map<string, SessionPoint[]>();
    // Left and right sides recover separately: one series per side
    const side = snapshotSide(s.targetSnapshot);
    const series = side ? `${s.patientId}#${side}` : s.patientId;
    const list = byPatient.get(series) ?? [];
    list.push({
      day: localDateString(s.startedAt),
      romMinAngle: s.romMinAngle,
      romMaxAngle: s.romMaxAngle,
      target: sessionTarget(s.targetSnapshot, s.primaryJoint),
    });
    byPatient.set(series, list);
    grouped.set(s.exerciseId, byPatient);
  }

  const rates: ReferenceRates = new Map();
  for (const [exerciseId, byPatient] of grouped) {
    const perPatient = new Map<string, RateEstimate>();
    for (const [patientId, list] of byPatient) {
      const pts = dailyDeficits(list);
      if (pts.length < POPULATION.REF_MIN_DAYS || pts[pts.length - 1].x < POPULATION.REF_MIN_SPAN_DAYS) continue;
      const r = estimateRate(pts);
      if (r) perPatient.set(patientId, r);
    }
    if (perPatient.size) rates.set(exerciseId, perPatient);
  }
  return rates;
}

/** Population prior for one exercise, leaving the patient themself out */
export function priorFor(refs: ReferenceRates, exerciseId: string, excludePatientId: string): PopulationPrior | null {
  const perPatient = refs.get(exerciseId);
  if (!perPatient) return null;
  const others = [...perPatient.entries()].filter(([id]) => seriesPatient(id) !== excludePatientId).map(([, r]) => r);
  return poolRates(exerciseId, others);
}

/** Number of reference patients for an exercise, excluding the patient themself */
export function referenceCount(refs: ReferenceRates, exerciseId: string, excludePatientId: string): number {
  const perPatient = refs.get(exerciseId);
  if (!perPatient) return 0;
  return new Set([...perPatient.keys()].map(seriesPatient).filter((id) => id !== excludePatientId)).size;
}

const seriesPatient = (series: string) => series.split('#')[0];
