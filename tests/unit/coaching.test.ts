import { describe, expect, test } from 'bun:test';
import { CueGate, FaultPersistence } from '@/lib/cue-gate';
import { compensationCue, cueState, isSpeakable, localCue, phraseForState, type CueState } from '@/lib/coach-cues';
import { EXERCISES, exerciseIdFromName } from '@/lib/exercises-data';

describe('CueGate', () => {
  test('posture cues only while performing the rep', () => {
    const g = new CueGate();
    expect(g.phaseAllows('posture', 'moving', 0)).toBe(true);
    expect(g.phaseAllows('posture', 'hold', 0)).toBe(true);
    expect(g.phaseAllows('posture', 'returning', 0)).toBe(false);
    expect(g.phaseAllows('posture', 'rest', 0)).toBe(false);
  });

  test('nothing but info for 2.5 s after a rep ends', () => {
    const g = new CueGate();
    g.noteRepEnd(1000);
    expect(g.phaseAllows('posture', 'moving', 3000)).toBe(false);
    expect(g.phaseAllows('coach', 'rest', 3000)).toBe(false);
    expect(g.phaseAllows('info', 'returning', 3000)).toBe(true);
    expect(g.phaseAllows('posture', 'moving', 3600)).toBe(true);
  });

  test('"range not reached" waits until the return is over', () => {
    const g = new CueGate();
    expect(g.phaseAllows('rom', 'returning', 0)).toBe(false);
    expect(g.phaseAllows('rom', 'rest', 0)).toBe(true);
  });

  test('2.5 s between any cues, 6 s before the same cue repeats', () => {
    const g = new CueGate();
    expect(g.allow('a', 'posture', 'hold', 0)).toBe(true);
    expect(g.allow('b', 'posture', 'hold', 1000)).toBe(false);
    expect(g.allow('b', 'posture', 'hold', 2600)).toBe(true);
    expect(g.allow('a', 'posture', 'hold', 5200)).toBe(false);
    expect(g.allow('a', 'posture', 'hold', 6100)).toBe(true);
  });

  test('a fault must persist before it is announced', () => {
    const p = new FaultPersistence();
    expect(p.update(['trunk'], 0)).toEqual([]);
    expect(p.update(['trunk'], 300)).toEqual([]);
    expect(p.update(['trunk'], 450)).toEqual(['trunk']);
    expect(p.update([], 500)).toEqual([]);
    expect(p.update(['trunk'], 600)).toEqual([]); // timer restarted
  });
});

describe('coaching phrases', () => {
  const target = { name: 'left_knee', nameTh: 'เข่าซ้าย', minAngle: 80, maxAngle: 100, idealAngle: 90 };

  test('cueState is qualitative', () => {
    expect(cueState(target, 90)).toBe('in_range');
    expect(cueState(target, 75)).toBe('below_near');
    expect(cueState(target, 50)).toBe('below_far');
    expect(cueState(target, 105)).toBe('above_near');
    expect(cueState(target, 140)).toBe('above_far');
  });

  test('isSpeakable rejects degrees, องศา and percentages', () => {
    expect(isSpeakable('ยกแขนขึ้นอีกนิดครับ')).toBe(true);
    expect(isSpeakable('ยกเพิ่ม 12°')).toBe(false);
    expect(isSpeakable('ขาดอีก 10 องศา')).toBe(false);
    expect(isSpeakable('แม่นยำ 80%')).toBe(false);
    expect(isSpeakable('')).toBe(false);
  });

  test('every phrase for every catalogue exercise is speakable (no numbers)', () => {
    const states: CueState[] = ['in_range', 'below_near', 'below_far', 'above_near', 'above_far'];
    for (const ex of EXERCISES) {
      const slug = exerciseIdFromName(ex.name);
      for (const t of ex.targetJoints) {
        for (const st of states) {
          const phrase = phraseForState(slug, t, st);
          expect(isSpeakable(phrase)).toBe(true);
          expect(phrase).not.toMatch(/\d/);
        }
      }
      for (const c of ex.formChecks ?? []) expect(isSpeakable(compensationCue(c.id))).toBe(true);
    }
    expect(compensationCue('unknown_check')).toBeTruthy();
  });

  test('localCue gives the worst joint’s advice, never a number', () => {
    const targets = [target];
    expect(localCue('ex_knee_flexion', targets, { left_knee: 140 }, 1)).not.toMatch(/\d/);
    expect(localCue('ex_knee_flexion', targets, {}, 1)).toContain('กล้อง');
    for (let seed = 0; seed < 9; seed++) expect(isSpeakable(localCue('ex_knee_flexion', targets, { left_knee: 90 }, seed))).toBe(true);
  });
});
