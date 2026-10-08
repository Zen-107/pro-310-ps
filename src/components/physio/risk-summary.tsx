'use client';

import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

// Early-warning risk score (lib/risk-score.ts): level, score and the factors
// behind every point. Explainable heuristic, not a validated outcome prediction.

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface RiskDTO {
  level: RiskLevel;
  score: number;
  factors: { code: string; points: number; label: string }[];
}

export const RISK_STYLE: Record<RiskLevel, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  high: { label: 'ความเสี่ยงสูง', icon: ShieldAlert, className: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' },
  moderate: { label: 'ควรติดตาม', icon: ShieldQuestion, className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  low: { label: 'ความเสี่ยงต่ำ', icon: ShieldCheck, className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
};

export function RiskBadge({ risk }: { risk: Pick<RiskDTO, 'level' | 'score'> }) {
  const s = RISK_STYLE[risk.level];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {s.label} · {risk.score} คะแนน
    </span>
  );
}

export function RiskSummary({ risk }: { risk: RiskDTO }) {
  return (
    <section className="space-y-2 rounded-lg border p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-foreground">คะแนนเฝ้าระวัง (Early warning)</h4>
        <RiskBadge risk={risk} />
      </div>
      {risk.factors.length === 0 ? (
        <p className="text-muted-foreground">ไม่พบปัจจัยเสี่ยงจากข้อมูลที่มี</p>
      ) : (
        <ul className="space-y-1">
          {risk.factors.map((f) => (
            <li key={f.code} className="flex items-start gap-2">
              <span className="mt-px shrink-0 rounded bg-muted px-1.5 font-semibold tabular-nums text-foreground">+{f.points}</span>
              <span className="text-muted-foreground">{f.label}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        คะแนนรวมจากปัจจัยที่ตรวจสอบได้ (≥3 ควรติดตาม, ≥5 ความเสี่ยงสูง) — ต้นแบบเพื่อการศึกษา เกณฑ์ตั้งโดยทีมพัฒนา
        ยังไม่ได้ตรวจสอบทางสถิติ (รอผลการรักษาจริงจากผู้ใช้) และไม่ใช่การพยากรณ์การบาดเจ็บซ้ำ
      </p>
    </section>
  );
}
