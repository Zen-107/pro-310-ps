import { describe, expect, test } from 'bun:test';
import { assessRisk, type RiskInput } from '@/lib/risk-score';

const base: RiskInput = {
  redFlagMessages: 0,
  forecasts: [],
  adherence: 90,
  daysSinceLastSession: 1,
  hasActivePlan: true,
  trends: [],
};
const forecast = (status: RiskInput['forecasts'][number]['status'], extra: Partial<RiskInput['forecasts'][number]> = {}) => ({
  exerciseTh: 'การงอเข่า',
  status,
  adherence: 90,
  slowResponder: false,
  fasterThanPercent: null,
  ...extra,
});
const codes = (input: RiskInput) => assessRisk(input).factors.map((f) => f.code);

describe('assessRisk', () => {
  test('no factors → low, score 0', () => {
    expect(assessRisk(base)).toEqual({ level: 'low', score: 0, factors: [] });
  });

  test('plateau or declining recovery alone → moderate (always surfaced to the care team)', () => {
    expect(assessRisk({ ...base, forecasts: [forecast('plateau')] })).toMatchObject({ level: 'moderate', score: 3 });
    expect(assessRisk({ ...base, forecasts: [forecast('declining')] })).toMatchObject({ level: 'moderate', score: 4 });
  });

  test('plateau + low adherence + inactivity → high, factors ordered by points', () => {
    const r = assessRisk({ ...base, forecasts: [forecast('plateau')], adherence: 40, daysSinceLastSession: 9 });
    expect(r.level).toBe('high');
    expect(r.score).toBe(7);
    expect(r.factors.map((f) => f.points)).toEqual([3, 2, 2]);
  });

  test('declining takes precedence over plateau (counted once)', () => {
    expect(codes({ ...base, forecasts: [forecast('declining'), forecast('plateau')] })).toEqual(['recovery_declining']);
  });

  test('slow responder counts only when not already plateau/declining', () => {
    expect(codes({ ...base, forecasts: [forecast('on_track', { slowResponder: true, fasterThanPercent: 12 })] })).toEqual(['slow_responder']);
    expect(codes({ ...base, forecasts: [forecast('plateau', { slowResponder: true, fasterThanPercent: 12 })] })).toEqual(['recovery_plateau']);
  });

  test('adherence and inactivity only matter while a plan is active', () => {
    const idle = { ...base, adherence: 20, daysSinceLastSession: 30 };
    expect(codes(idle)).toEqual(['low_adherence', 'inactive']);
    expect(codes({ ...idle, hasActivePlan: false })).toEqual([]);
  });

  test('fair adherence = 1 point, low = 2', () => {
    expect(assessRisk({ ...base, adherence: 70 }).score).toBe(1);
    expect(assessRisk({ ...base, adherence: 45 }).score).toBe(2);
  });

  test('worsening form is capped at 2 points', () => {
    const r = assessRisk({
      ...base,
      trends: [{ exerciseTh: 'A', flags: ['compensation_increasing', 'accuracy_declining', 'rom_declining', 'improving'], sessions: 6, lastAccuracy: 80 }],
    });
    expect(r.factors).toHaveLength(1);
    expect(r.factors[0].points).toBe(2);
  });

  test('red-flag symptoms add 3 points', () => {
    const r = assessRisk({ ...base, redFlagMessages: 2 });
    expect(r.factors[0]).toMatchObject({ code: 'red_flag_symptoms', points: 3 });
    expect(r.level).toBe('moderate');
  });

  test('low accuracy needs enough sessions', () => {
    const t = { exerciseTh: 'A', flags: [], lastAccuracy: 40 };
    expect(codes({ ...base, trends: [{ ...t, sessions: 2 }] })).toEqual([]);
    expect(codes({ ...base, trends: [{ ...t, sessions: 3 }] })).toEqual(['low_accuracy']);
  });
});
