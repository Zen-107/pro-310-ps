// AI agent service (server only).
//
//  1. Clinical analyst — summarises one session (Reporter) and analyses a
//     patient's recent session logs for fault trends, for clinicians.
//  2. Patient companion — answers patient exercise questions in the care-team
//     chat, grounded in the patient's prescription and general therapeutic
//     exercise principles (Kisner & Colby). It never diagnoses, never changes
//     the plan, and escalates red-flag symptoms to the care team without
//     calling the model.
//
// Numbers given to the model are computed deterministically here, so the
// model only explains them; the computed trends are returned alongside its text.

import type { FaultType } from '@prisma/client';
import { db } from '@/lib/db';
import { parseFormChecks } from '@/lib/form-checks';
import { mergeTargets } from '@/lib/presenters';
import { cleanText, safeTruncate } from '@/lib/text-safe';
import { cleanClinicalSummary, thaiMeasurementName } from '@/lib/clinical-markdown';

// ─── Model access ────────────────────────────────────────────────────
// Every supported provider exposes an OpenAI-compatible Chat Completions
// endpoint, so one fetch-based client covers all of them (no SDK). Providers
// are picked from environment variables; see .env.example.
//
//   AI_PROVIDER=gemini|groq|openrouter|openai   optional: try this one first
//   GEMINI_API_KEY      Google AI Studio (free tier)      GEMINI_MODEL
//   GROQ_API_KEY        Groq (free tier)                  GROQ_MODEL
//   OPENROUTER_API_KEY  OpenRouter (":free" models)       OPENROUTER_MODEL
//   OPENAI_API_KEY      OpenAI or any compatible server   OPENAI_MODEL, OPENAI_BASE_URL
//                       (e.g. local Ollama: OPENAI_BASE_URL=http://127.0.0.1:11434/v1)
//
// When several keys are set, a provider that fails (rate limit, outage) falls
// through to the next one.

type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'openai';

interface ProviderDef {
  id: ProviderId;
  label: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  baseUrl: () => string;
  /** Sent as reasoning_effort for thinking models; AI_REASONING_EFFORT overrides */
  reasoningEffort?: string;
  headers?: () => Record<string, string>;
}

// Free-tier defaults as of 2026-10; override with the *_MODEL variables.
const PROVIDERS: ProviderDef[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-3.8-flash',
    baseUrl: () => 'https://generativelanguage.googleapis.com/v1beta/openai',
    reasoningEffort: 'low',
  },
  {
    id: 'groq',
    label: 'Groq',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
    baseUrl: () => 'https://api.groq.com/openai/v1',
    reasoningEffort: 'low',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'openrouter/free',
    baseUrl: () => 'https://openrouter.ai/api/v1',
    headers: () => ({
      'HTTP-Referer': process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
      'X-Title': 'AI Physio',
    }),
  },
  {
    id: 'openai',
    label: 'OpenAI-compatible',
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    baseUrl: () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
  },
];

const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30_000;

export class AiUnavailableError extends Error {}

interface ResolvedProvider {
  def: ProviderDef;
  apiKey: string;
  model: string;
}

/** Configured providers in try order (AI_PROVIDER first, then the default order) */
export function configuredProviders(): ResolvedProvider[] {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();
  const ordered = [...PROVIDERS].sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
  return ordered
    .filter((p) => process.env[p.keyEnv]?.trim())
    .map((p) => ({ def: p, apiKey: process.env[p.keyEnv]!.trim(), model: process.env[p.modelEnv]?.trim() || p.defaultModel }));
}

/** Which provider/model the agent would use first (for status displays and logs) */
export function aiProviderInfo(): { provider: string; model: string } | null {
  const first = configuredProviders()[0];
  return first ? { provider: first.def.label, model: first.model } : null;
}

export interface AgentText {
  content: string;
  model: string;
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function callProvider(p: ResolvedProvider, messages: { role: string; content: string }[], maxTokens?: number): Promise<AgentText> {
  const effort = process.env.AI_REASONING_EFFORT?.trim() || p.def.reasoningEffort;
  const res = await fetch(`${p.def.baseUrl()}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}`, ...p.def.headers?.() },
    body: JSON.stringify({
      model: p.model,
      messages,
      temperature: 0.4,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(effort && effort !== 'off' ? { reasoning_effort: effort } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = safeTruncate(await res.text().catch(() => ''), 300);
    throw new Error(`${p.def.label} ${res.status}: ${detail}`);
  }
  const data = (await res.json()) as { model?: string; choices?: { message?: { content?: string | null } }[] };
  const content = cleanText(data.choices?.[0]?.message?.content, 8000);
  if (!content) throw new Error(`${p.def.label} returned no content`);
  return { content, model: `${p.def.id}:${data.model ?? p.model}` };
}

/**
 * One chat completion from the first configured provider that succeeds.
 * Throws AiUnavailableError when no provider is configured or all fail.
 */
export async function complete(system: string, user: string, history: ChatTurn[] = [], opts: { maxTokens?: number } = {}): Promise<AgentText> {
  const providers = configuredProviders();
  if (!providers.length) {
    throw new AiUnavailableError('No AI provider configured: set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY or OPENAI_API_KEY');
  }
  const messages = [{ role: 'system', content: system }, ...history, { role: 'user', content: user }];
  const errors: string[] = [];
  for (const p of providers) {
    try {
      return await callProvider(p, messages, opts.maxTokens);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new AiUnavailableError(`All AI providers failed — ${errors.join(' | ')}`);
}

// ─── 1a. Session summary (Reporter) ──────────────────────────────────

export interface SessionReportInput {
  exerciseName: string;
  exerciseNameEn: string;
  category: string;
  startedAt: Date;
  endedAt: Date | null;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  romMinAngle: number | null;
  romMaxAngle: number | null;
  primaryJoint: string | null;
  angleDefinition: string;
  scoring: Record<string, string>;
  jointReport: {
    joint?: string;
    nameTh: string;
    formula: string | null;
    target: { idealAngle: number; minAngle: number; maxAngle: number } | null;
    samples: number;
    avgAngle: number;
    minAngle: number;
    maxAngle: number;
    accuracy: number;
  }[];
  faults: {
    incorrectReps: number;
    counts: Record<FaultType, number>;
    avgIncompleteDeficit: number | null;
    compensations: { message: string; count: number }[];
  };
}

const REPORTER_SYSTEM = `คุณคือนักกายภาพบำบัดที่เขียนบันทึกทางคลินิกลงเวชระเบียน ใช้ภาษาไทยทางการแพทย์ที่สุภาพ กระชับ อ่านง่าย
กฎการเขียน:
- ไม่ต้องเขียนหัวรายงาน ชื่อผู้ป่วย HN วันที่ หรือข้อมูลประจำตัวใดๆ (ระบบใส่ไว้ในหัวเอกสารแล้ว) เริ่มที่หัวข้อแรกทันที
- ไม่ใช้ตาราง ไม่ใช้เส้นคั่น (---) ใช้หัวข้อระดับ ### และย่อหน้า/รายการสั้นๆ เท่านั้น (ตารางตัวเลขระบบแสดงแยกไว้แล้ว)
- เรียกข้อต่อด้วยชื่อภาษาไทยตามที่ให้มาเท่านั้น ห้ามใช้ชื่อตัวแปรภาษาอังกฤษ สูตร หรือรหัส เช่น left_knee, angle(...), INCOMPLETE_ROM
- อ้างอิงเฉพาะตัวเลขที่ให้มา ห้ามแต่งข้อมูลเพิ่ม และระบุข้อจำกัดเมื่อข้อมูลน้อย
- ห้ามวินิจฉัยโรคหรือเปลี่ยนแผนการรักษา ข้อเสนอแนะเป็นประเด็นให้ผู้ดูแลพิจารณา`;

const FAULT_LABEL_TH = { INCOMPLETE_ROM: 'ทำไม่สุดระยะ', COMPENSATION: 'ท่าชดเชย', LOW_ACCURACY: 'ความแม่นยำต่ำ' } as const;

export async function summarizeSession(report: SessionReportInput): Promise<AgentText> {
  // Thai names only: identifiers and formulas in the prompt end up in the text
  const jointLines = report.jointReport
    .map((j) => {
      const range = j.target ? `ช่วงเป้าหมาย ${j.target.minAngle}–${j.target.maxAngle}° (ค่าที่เหมาะสม ${j.target.idealAngle}°)` : 'ไม่มีช่วงเป้าหมาย';
      return `- ${j.nameTh}: เฉลี่ย ${j.avgAngle}° (ต่ำสุด ${j.minAngle}°, สูงสุด ${j.maxAngle}°), ${range}, อยู่ในช่วงเป้าหมาย ${j.accuracy}% ของ ${j.samples} ครั้ง`;
    })
    .join('\n');
  const names = Object.fromEntries(report.jointReport.filter((j) => j.joint).map((j) => [j.joint!, j.nameTh]));
  const primaryTh = report.primaryJoint ? thaiMeasurementName(report.primaryJoint, names) : '-';
  const minutes = report.endedAt ? Math.max(1, Math.round((report.endedAt.getTime() - report.startedAt.getTime()) / 60000)) : null;

  const prompt = `ข้อมูลการฝึก:
- ท่าฝึก: ${report.exerciseName}${report.exerciseNameEn && report.exerciseNameEn !== report.exerciseName ? ` (${report.exerciseNameEn})` : ''}
- ระยะเวลา: ${minutes ? `ประมาณ ${minutes} นาที` : 'ไม่ทราบ'}
- จำนวนครั้งที่นับได้: ${report.totalReps} ครั้ง, ความแม่นยำเฉลี่ย ${report.avgAccuracy}%
- ช่วงการเคลื่อนไหว (ROM) ของ${primaryTh}: ${report.maxRom}° (จาก ${report.romMinAngle ?? '-'}° ถึง ${report.romMaxAngle ?? '-'}°)

มุมข้อต่อที่วัดได้:
${jointLines || '- ไม่มีข้อมูลข้อต่อ'}

ข้อผิดพลาดของท่าทาง:
- ครั้งที่ไม่ถูกต้อง: ${report.faults.incorrectReps} จาก ${report.totalReps} ครั้ง
- ${FAULT_LABEL_TH.INCOMPLETE_ROM}: ${report.faults.counts.INCOMPLETE_ROM} ครั้ง${report.faults.avgIncompleteDeficit !== null ? ` (ขาดจากช่วงเป้าหมายเฉลี่ย ${report.faults.avgIncompleteDeficit}°)` : ''}
- ${FAULT_LABEL_TH.COMPENSATION}: ${report.faults.compensations.map((c) => `"${c.message}" ${c.count} ครั้ง`).join(', ') || 'ไม่พบ'} (ข้อความท่าชดเชยเป็นภาษาอังกฤษ ให้สรุปเป็นภาษาไทย)
- ${FAULT_LABEL_TH.LOW_ACCURACY}: ${report.faults.counts.LOW_ACCURACY} ครั้ง

เขียนบันทึกทางคลินิก 4 หัวข้อ:
### 1. สรุปผลการฝึก
### 2. การประเมินมุมข้อต่อและช่วงการเคลื่อนไหว
### 3. ข้อเสนอแนะสำหรับการฝึกครั้งต่อไป
### 4. ข้อควรระวัง (ถ้ามี)`;

  const result = await complete(REPORTER_SYSTEM, prompt);
  return { ...result, content: cleanClinicalSummary(result.content, names) };
}

// ─── 1b. Fault-trend analysis across sessions ────────────────────────

const TREND_SESSIONS = 20;

export interface ExerciseTrend {
  exerciseId: string;
  exercise: string;
  exerciseTh: string;
  sessions: number;
  firstAt: string;
  lastAt: string;
  accuracy: { first: number; last: number; slopePerSession: number };
  rom: { joint: string | null; first: number | null; last: number | null; slopePerSession: number | null };
  /** Faults per counted rep, first half of the sessions vs second half */
  faultRate: Record<FaultType, { early: number; recent: number }>;
  topCompensations: { checkId: string; message: string; count: number; recentShare: number }[];
  avgIncompleteDeficit: { early: number | null; recent: number | null };
  flags: string[];
}

export interface PatientTrendAnalysis {
  patientId: string;
  generatedAt: string;
  sessionsAnalysed: number;
  trends: ExerciseTrend[];
  summary: string | null;
  model: string | null;
  aiError: string | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Least-squares slope of ys over 0…n−1 */
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : 0;
}

const FAULT_TYPES: FaultType[] = ['INCOMPLETE_ROM', 'COMPENSATION', 'LOW_ACCURACY'];

/** Deterministic per-exercise trends from the patient's recent completed sessions */
export async function computeFaultTrends(patientId: string): Promise<{ trends: ExerciseTrend[]; sessions: number }> {
  const sessions = await db.exerciseSession.findMany({
    where: { patientId, status: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    take: TREND_SESSIONS,
    select: {
      id: true,
      exerciseId: true,
      startedAt: true,
      totalReps: true,
      avgAccuracy: true,
      romDegrees: true,
      primaryJoint: true,
      exercise: { select: { name: true, nameTh: true } },
      faults: { select: { type: true, checkId: true, message: true, deficit: true } },
    },
  });
  sessions.reverse(); // oldest first

  const byExercise = new Map<string, typeof sessions>();
  for (const s of sessions) byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]);

  const trends: ExerciseTrend[] = [...byExercise.entries()].map(([exerciseId, list]) => {
    const half = Math.ceil(list.length / 2);
    const early = list.length > 1 ? list.slice(0, half) : list;
    const recent = list.length > 1 ? list.slice(half) : list;
    const rate = (group: typeof list, type: FaultType) => {
      const reps = group.reduce((n, s) => n + Math.max(s.totalReps, 1), 0);
      return round1(group.reduce((n, s) => n + s.faults.filter((f) => f.type === type).length, 0) / reps);
    };
    const deficit = (group: typeof list) => {
      const d = group.flatMap((s) => s.faults.filter((f) => f.type === 'INCOMPLETE_ROM' && f.deficit !== null).map((f) => f.deficit as number));
      return d.length ? round1(mean(d)) : null;
    };

    const comp = new Map<string, { checkId: string; message: string; count: number; recent: number }>();
    list.forEach((s) => {
      const isRecent = recent.includes(s);
      s.faults
        .filter((f) => f.type === 'COMPENSATION')
        .forEach((f) => {
          const key = f.checkId ?? f.message;
          const e = comp.get(key) ?? { checkId: key, message: safeTruncate(f.message, 160), count: 0, recent: 0 };
          e.count++;
          if (isRecent) e.recent++;
          comp.set(key, e);
        });
    });

    const accuracies = list.map((s) => s.avgAccuracy);
    const roms = list.map((s) => s.romDegrees).filter((v): v is number => v !== null);
    const faultRate = Object.fromEntries(FAULT_TYPES.map((t) => [t, { early: rate(early, t), recent: rate(recent, t) }])) as ExerciseTrend['faultRate'];

    const flags: string[] = [];
    const accSlope = slope(accuracies);
    if (list.length >= 3 && accSlope <= -2) flags.push('accuracy_declining');
    if (list.length >= 3 && roms.length >= 3 && slope(roms) <= -2) flags.push('rom_declining');
    if (faultRate.COMPENSATION.recent > faultRate.COMPENSATION.early + 0.1) flags.push('compensation_increasing');
    if (faultRate.INCOMPLETE_ROM.recent > faultRate.INCOMPLETE_ROM.early + 0.1) flags.push('incomplete_rom_increasing');
    if (list.length >= 3 && accSlope >= 2 && faultRate.COMPENSATION.recent <= faultRate.COMPENSATION.early) flags.push('improving');

    return {
      exerciseId,
      exercise: list[0].exercise.name,
      exerciseTh: list[0].exercise.nameTh,
      sessions: list.length,
      firstAt: list[0].startedAt.toISOString(),
      lastAt: list[list.length - 1].startedAt.toISOString(),
      accuracy: { first: Math.round(accuracies[0]), last: Math.round(accuracies[accuracies.length - 1]), slopePerSession: round1(accSlope) },
      rom: {
        joint: list[list.length - 1].primaryJoint,
        first: roms.length ? Math.round(roms[0]) : null,
        last: roms.length ? Math.round(roms[roms.length - 1]) : null,
        slopePerSession: roms.length >= 2 ? round1(slope(roms)) : null,
      },
      faultRate,
      topCompensations: [...comp.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ recent: r, ...c }) => ({ ...c, recentShare: c.count ? Math.round((r / c.count) * 100) / 100 : 0 })),
      avgIncompleteDeficit: { early: deficit(early), recent: deficit(recent) },
      flags,
    };
  });

  return { trends, sessions: sessions.length };
}

const ANALYST_SYSTEM = `คุณคือผู้ช่วยวิเคราะห์ข้อมูลสำหรับแพทย์และนักกายภาพบำบัด
- เขียนภาษาไทยแบบมืออาชีพ กระชับ ใช้ Markdown หัวข้อสั้นๆ
- อ้างอิงเฉพาะตัวเลขที่ให้มา ห้ามแต่งตัวเลขหรือข้อมูลเพิ่ม
- ข้อมูลมาจากการตรวจจับท่าทางด้วยกล้อง (ความคลาดเคลื่อนได้) ให้ระบุข้อจำกัดเมื่อมีข้อมูลน้อย
- ข้อเสนอแนะเป็นเพียงประเด็นให้ผู้ดูแลพิจารณา ไม่ใช่คำสั่งการรักษา และห้ามวินิจฉัยโรค`;

export async function analyzePatientTrends(patientId: string): Promise<PatientTrendAnalysis> {
  const [{ trends, sessions }, patient] = await Promise.all([
    computeFaultTrends(patientId),
    db.patient.findUnique({ where: { id: patientId }, select: { condition: true } }),
  ]);
  const base = { patientId, generatedAt: new Date().toISOString(), sessionsAnalysed: sessions, trends };
  if (trends.length === 0) return { ...base, summary: null, model: null, aiError: null };

  const lines = trends
    .map((t) => {
      const comps = t.topCompensations.map((c) => `${c.message} ×${c.count} (ล่าสุด ${Math.round(c.recentShare * 100)}%)`).join('; ') || 'ไม่พบ';
      return `### ${t.exerciseTh} (${t.exercise}) — ${t.sessions} เซสชัน
- ความแม่นยำ: ${t.accuracy.first}% → ${t.accuracy.last}% (แนวโน้ม ${t.accuracy.slopePerSession}%/เซสชัน)
- ROM ${t.rom.joint ?? '-'}: ${t.rom.first ?? '-'}° → ${t.rom.last ?? '-'}° (แนวโน้ม ${t.rom.slopePerSession ?? '-'}°/เซสชัน)
- ข้อผิดพลาดต่อครั้ง (ช่วงแรก → ช่วงหลัง): ทำไม่สุดระยะ ${t.faultRate.INCOMPLETE_ROM.early} → ${t.faultRate.INCOMPLETE_ROM.recent}, ท่าชดเชย ${t.faultRate.COMPENSATION.early} → ${t.faultRate.COMPENSATION.recent}, ความแม่นยำต่ำ ${t.faultRate.LOW_ACCURACY.early} → ${t.faultRate.LOW_ACCURACY.recent}
- องศาที่ขาดเฉลี่ย (ทำไม่สุดระยะ): ${t.avgIncompleteDeficit.early ?? '-'}° → ${t.avgIncompleteDeficit.recent ?? '-'}°
- ท่าชดเชยที่พบบ่อย: ${comps}
- สัญญาณที่ระบบตรวจพบ: ${t.flags.join(', ') || 'ไม่มี'}`;
    })
    .join('\n\n');

  const prompt = `วิเคราะห์แนวโน้มการฝึกของผู้ป่วยจาก ${sessions} เซสชันล่าสุดที่เสร็จสมบูรณ์
ภาวะ/การวินิจฉัยที่บันทึกไว้: ${patient?.condition ? safeTruncate(patient.condition, 200) : 'ไม่ระบุ'}

${lines}

กรุณาเขียน:
1. **สรุปภาพรวม** (2-3 ประโยค)
2. **แนวโน้มข้อผิดพลาด** แยกตามท่า — ดีขึ้น/แย่ลง/คงที่ พร้อมตัวเลขอ้างอิง
3. **ท่าชดเชยที่ควรติดตาม** และความหมายทางคลินิกที่เป็นไปได้
4. **ประเด็นให้ผู้ดูแลพิจารณา** (เช่น ปรับช่วงเป้าหมาย ทบทวนท่าทางกับผู้ป่วย ดู Clinical Session Replay ของเซสชันที่มีปัญหา) — ไม่เกิน 4 ข้อ`;

  try {
    const { content, model } = await complete(ANALYST_SYSTEM, prompt);
    return { ...base, summary: content, model, aiError: null };
  } catch (error) {
    console.error('AI trend analysis error:', error);
    return { ...base, summary: null, model: null, aiError: 'AI service unavailable — computed trends only' };
  }
}

// ─── 2. Patient companion ────────────────────────────────────────────

// Symptoms that must go to a human, never to the model (Thai + English)
const RED_FLAGS: { pattern: RegExp; label: string }[] = [
  { pattern: /เจ็บหน้าอก|แน่นหน้าอก|chest pain|chest tight/i, label: 'chest pain' },
  { pattern: /หายใจไม่ออก|หายใจลำบาก|หอบเหนื่อย|short(ness)? of breath|can'?t breathe/i, label: 'breathing difficulty' },
  { pattern: /หน้ามืด|เป็นลม|หมดสติ|ใจสั่น|faint|pass(ed)? out|palpitation/i, label: 'fainting / palpitations' },
  // Thai has no word boundaries: "ชา" alone would also match ชาย (male), ชาเขียว (tea)
  { pattern: /(มือ|เท้า|ขา|แขน|นิ้ว|หน้า|ปาก|เหน็บ|อาการ|รู้สึก)ชา|อ่อนแรง|ปากเบี้ยว|พูดไม่ชัด|\bnumb|weakness|tingling|slurred/i, label: 'numbness / weakness' },
  { pattern: /บวม|แดงร้อน|มีไข้|ไข้ขึ้น|swell|swollen|fever|red and hot/i, label: 'swelling / fever' },
  { pattern: /ปวดมาก|ปวดรุนแรง|ปวดจนทน|เจ็บมาก|severe pain|unbearable|sharp pain/i, label: 'severe pain' },
  { pattern: /หกล้ม|ล้มลง|ข้อหลุด|ข้อเคลื่อน|ได้ยินเสียง.*(ดัง|ป๊อก)|\bfell\b|\bfall(en)?\b|dislocat|\bpop(ped)?\b/i, label: 'fall / joint injury' },
  { pattern: /เลือดออก|แผลแยก|bleeding|wound open/i, label: 'bleeding / wound' },
];

export function detectRedFlags(text: string): string[] {
  return RED_FLAGS.filter((f) => f.pattern.test(text)).map((f) => f.label);
}

export const ESCALATION_REPLY = `⚠️ อาการที่แจ้งมาอาจต้องได้รับการประเมินจากบุคลากรทางการแพทย์
• หยุดออกกำลังกายทันที และพักในท่าที่สบาย
• หากอาการรุนแรง เจ็บหน้าอก หายใจลำบาก หมดสติ หรือแขนขาอ่อนแรงทันที — โทร 1669 (เหตุฉุกเฉิน) ทันที
• ทีมผู้ดูแลของคุณจะเห็นข้อความนี้ในแชท กรุณารอการติดต่อกลับก่อนฝึกต่อ

(ข้อความอัตโนมัติจากผู้ช่วย AI — ไม่ใช่การวินิจฉัย)`;

const COMPANION_SYSTEM = `คุณคือ "ผู้ช่วยฝึกกายภาพ AI" ในแชทของผู้ป่วยกับทีมผู้ดูแล (แพทย์/นักกายภาพบำบัด) ทีมผู้ดูแลอ่านแชทนี้ได้ทั้งหมด
หน้าที่: ตอบคำถามเกี่ยวกับการทำท่าออกกำลังกายที่ผู้ป่วยได้รับมอบหมาย โดยอิงข้อมูลแผนการฝึกที่ให้มา และหลักการออกกำลังกายเพื่อการรักษา (Therapeutic Exercise ตามแนวทางของ Kisner & Colby):
- ทำตามขนาดที่กำหนด (จำนวนเซ็ต ครั้ง เวลาพัก ความถี่) — ห้ามแนะนำให้เพิ่ม/ลด/เปลี่ยนแผนเอง ให้ปรึกษาทีมผู้ดูแล
- คุณภาพท่าสำคัญกว่าจำนวน: เคลื่อนไหวช้าและควบคุมได้ ในช่วงการเคลื่อนไหวที่ไม่เจ็บ หยุดเมื่อเหนื่อยจนท่าเสีย
- อุ่นเครื่องก่อนและคลายกล้ามเนื้อหลังฝึก
- หายใจสม่ำเสมอ ไม่กลั้นหายใจขณะออกแรง (หายใจออกช่วงออกแรง)
- ติดตามอาการปวด: ตึงหรือเมื่อยเล็กน้อยระหว่างฝึกยอมรับได้ แต่ถ้าปวดแปลบ ปวดมากขึ้นเรื่อยๆ หรือปวดค้างนานหลายชั่วโมงหลังฝึก/ปวดมากขึ้นในวันถัดไป ให้หยุดและแจ้งทีมผู้ดูแล
- การเพิ่มความยากเป็นแบบค่อยเป็นค่อยไป และเป็นการตัดสินใจของทีมผู้ดูแล
- แก้ท่าชดเชยตามคำแนะนำของแต่ละท่า (เช่น ลำตัวตรง เข่าเหยียด)

กฎ:
- ตอบภาษาไทย สุภาพ เป็นกันเอง สั้น (ไม่เกินประมาณ 120 คำ) ใช้ bullet ได้
- ตอบเฉพาะเรื่องการฝึกในแผน ถ้าถามนอกขอบเขต (ยา การวินิจฉัย ผลตรวจ การผ่าตัด) ให้บอกว่าจะให้ทีมผู้ดูแลตอบ
- ห้ามวินิจฉัย ห้ามแนะนำยา ห้ามเปลี่ยนแผนการรักษา ห้ามแต่งข้อมูลที่ไม่มีในแผน
- ถ้าผู้ป่วยรายงานอาการผิดปกติ ให้แนะนำให้หยุดฝึกและแจ้งทีมผู้ดูแล (เหตุฉุกเฉินโทร 1669)`;

const HISTORY_MESSAGES = 6;

/** Prescription + recent-fault context for the companion */
async function companionContext(patientId: string): Promise<string> {
  const [prescriptions, recent] = await Promise.all([
    db.prescription.findMany({
      where: { patientId, status: 'ACTIVE' },
      select: {
        title: true,
        notes: true,
        items: {
          orderBy: { sortOrder: 'asc' },
          select: {
            sets: true,
            repsPerSet: true,
            restSeconds: true,
            daysOfWeek: true,
            notes: true,
            targetOverrides: { select: { joint: true, idealAngle: true, minAngle: true, maxAngle: true } },
            exercise: { select: { name: true, nameTh: true, instructions: true, formChecks: true, targets: true } },
          },
        },
      },
    }),
    db.exerciseSession.findMany({
      where: { patientId, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        startedAt: true,
        totalReps: true,
        avgAccuracy: true,
        exercise: { select: { nameTh: true } },
        faults: { where: { type: { in: ['COMPENSATION', 'INCOMPLETE_ROM'] } }, select: { type: true, message: true } },
      },
    }),
  ]);

  const plan = prescriptions
    .flatMap((p) =>
      p.items.map((it) => {
        const ex = it.exercise;
        const steps = Array.isArray(ex.instructions) ? (ex.instructions as string[]).join(' → ') : '';
        const targets = mergeTargets(ex.targets, it.targetOverrides)
          .map((t) => `${t.nameTh} ${t.minAngle}–${t.maxAngle}°`)
          .join(', ');
        const cues = parseFormChecks(ex.formChecks).map((c) => c.message).join('; ');
        const days = it.daysOfWeek.length ? `วัน ${it.daysOfWeek.join(',')} (0=อาทิตย์)` : 'ทุกวัน';
        return `- ${ex.nameTh} (${ex.name}): ${it.sets} เซ็ต × ${it.repsPerSet} ครั้ง, พัก ${it.restSeconds} วิ, ${days}
  ขั้นตอน: ${safeTruncate(steps, 400)}
  ช่วงมุมเป้าหมาย: ${targets || '-'}
  ข้อควรระวังท่า: ${cues || '-'}${it.notes ? `\n  หมายเหตุจากผู้ดูแล: ${safeTruncate(it.notes, 200)}` : ''}`;
      })
    )
    .join('\n');

  const history = recent
    .map((s) => {
      const faults = new Map<string, number>();
      s.faults.forEach((f) => faults.set(f.message, (faults.get(f.message) ?? 0) + 1));
      const top = [...faults.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, n]) => `${safeTruncate(m, 80)} ×${n}`);
      return `- ${s.startedAt.toISOString().slice(0, 10)} ${s.exercise.nameTh}: ${s.totalReps} ครั้ง, ความแม่นยำ ${Math.round(s.avgAccuracy)}%${top.length ? `, ข้อผิดพลาด: ${top.join('; ')}` : ''}`;
    })
    .join('\n');

  return `แผนการฝึกปัจจุบัน:\n${plan || '- ยังไม่มีแผนการฝึกที่ใช้งานอยู่'}\n\nเซสชันล่าสุด:\n${history || '- ยังไม่มีเซสชัน'}`;
}

export interface CompanionReply {
  body: string;
  escalated: boolean;
  redFlags: string[];
  model: string | null;
}

/**
 * Answer a patient's exercise question. Red-flag symptoms get a fixed
 * escalation reply without calling the model.
 */
export async function companionReply(patientId: string, question: string): Promise<CompanionReply> {
  const redFlags = detectRedFlags(question);
  if (redFlags.length) return { body: ESCALATION_REPLY, escalated: true, redFlags, model: null };

  const [context, previous] = await Promise.all([
    companionContext(patientId),
    db.careMessage.findMany({
      where: { patientId, kind: { in: ['ASSISTANT_QUESTION', 'ASSISTANT_REPLY'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_MESSAGES,
      select: { kind: true, body: true },
    }),
  ]);
  const history = previous.reverse().map((m) => ({
    role: m.kind === 'ASSISTANT_REPLY' ? ('assistant' as const) : ('user' as const),
    content: safeTruncate(m.body, 600),
  }));

  try {
    const { content, model } = await complete(`${COMPANION_SYSTEM}\n\n${context}`, question, history);
    return { body: safeTruncate(content, 2000), escalated: false, redFlags, model };
  } catch (error) {
    console.error('AI companion error:', error);
    return {
      body: 'ขออภัย ผู้ช่วย AI ไม่สามารถตอบได้ในขณะนี้ ทีมผู้ดูแลของคุณจะเห็นคำถามนี้และตอบกลับในแชท',
      escalated: false,
      redFlags,
      model: null,
    };
  }
}
