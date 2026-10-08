'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Hourglass, TrendingDown, TrendingUp, Users } from 'lucide-react';

// Clinician-only card: recovery forecast for one exercise (lib/recovery-forecast.ts).
// Chart: "degrees still short of the target range" per day (lower is better,
// 0 = target reached), the robust trend line, and — when on track — a dashed
// projection to the goal line with the estimated arrival window as a band.
// Below it, the population model (lib/population-model.ts): how this patient
// compares with the clinic's other patients on the same exercise, and an early
// estimate before the patient's own trend is long enough.

export type ForecastStatus = 'goal_reached' | 'on_track' | 'plateau' | 'declining' | 'insufficient';

export interface ExerciseForecastDTO {
  /** Unique per series (exercise, plus side for one-side-at-a-time exercises) */
  key: string;
  exerciseId: string;
  exerciseTh: string;
  target: { joint: string; jointTh: string; minAngle: number; maxAngle: number } | null;
  adherence: number | null;
  forecast: {
    status: ForecastStatus;
    points: { day: string; x: number; deficit: number }[];
    daysWithData: number;
    spanDays: number;
    currentDeficit: number | null;
    slopePerWeek: number | null;
    slopeInterval: [number, number] | null;
    etaDays: [number, number, number] | null;
    etaCapped: boolean;
    fit: { intercept: number; slopePerDay: number } | null;
    daysNeeded: number | null;
    reasons: string[];
  };
  population: {
    k: number;
    ownWeight: number;
    etaDays: [number, number, number] | null;
    etaCapped: boolean;
    fasterThanPercent: number | null;
    slowResponder: boolean;
    typicalHalfLifeDays: number | null;
  } | null;
  referencePatients: number;
}

/** Reference patients needed before the population model is used (POPULATION.MIN_REFERENCE_PATIENTS) */
const MIN_REFERENCE_PATIENTS = 5;

// Status colours are reserved for state and always shown with an icon + label
const STATUS: Record<ForecastStatus, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  goal_reached: { label: 'ถึงช่วงเป้าหมายแล้ว', icon: CheckCircle2, className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  on_track: { label: 'กำลังดีขึ้น', icon: TrendingUp, className: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' },
  plateau: { label: 'พัฒนาการหยุดนิ่ง', icon: AlertTriangle, className: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  declining: { label: 'แย่ลง', icon: TrendingDown, className: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300' },
  insufficient: { label: 'ข้อมูลยังไม่พอ', icon: CircleDashed, className: 'border-border bg-muted text-muted-foreground' },
};

const addDaysIso = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const thDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

/** "5–9 วัน" · "3–6 สัปดาห์" · "มากกว่า 6 เดือน" */
export function formatEta(eta: [number, number, number], capped: boolean): string {
  const [lo, , hi] = eta;
  if (capped && lo >= 180) return 'มากกว่า 6 เดือน';
  if (hi <= 13) return `${lo}–${hi} วัน`;
  const w = (d: number) => Math.max(1, Math.round(d / 7));
  const loText = lo < 7 ? `${lo} วัน` : `${w(lo)} สัปดาห์`;
  if (capped) return `${loText} ถึงมากกว่า 6 เดือน`;
  if (lo >= 7 && w(lo) === w(hi)) return `ประมาณ ${w(hi)} สัปดาห์`;
  return lo < 7 ? `${loText} – ${w(hi)} สัปดาห์` : `${w(lo)}–${w(hi)} สัปดาห์`;
}

function headline(data: ExerciseForecastDTO): string {
  const f = data.forecast;
  switch (f.status) {
    case 'on_track':
      return f.etaDays ? `คาดว่าถึงช่วงเป้าหมายใน ${formatEta(f.etaDays, f.etaCapped)}` : 'กำลังดีขึ้น';
    case 'goal_reached':
      return 'มุมที่ทำได้อยู่ในช่วงเป้าหมายต่อเนื่องแล้ว';
    case 'plateau':
      return 'ไม่มีพัฒนาการที่วัดได้ใน 14 วันล่าสุด — พิจารณาปรับแผน';
    case 'declining':
      return 'มุมที่ทำได้ห่างจากเป้าหมายมากขึ้น — ควรประเมินผู้ป่วย';
    case 'insufficient':
      if (data.population?.etaDays) return `ประมาณการเบื้องต้น (เทียบผู้ป่วยที่ฝึกท่าเดียวกัน): ${formatEta(data.population.etaDays, data.population.etaCapped)}`;
      return f.daysNeeded ? `ต้องฝึกเพิ่มอีกอย่างน้อย ${f.daysNeeded} วันจึงจะประมาณการได้` : 'แนวโน้มยังไม่ชัดเจนพอจะประมาณการ';
  }
}

// ─── Chart ───────────────────────────────────────────────────────────

const W = 320;
const H = 150;
const PAD = { l: 34, r: 12, t: 12, b: 26 }; // bottom includes the x-axis label band

function ForecastChart({ data }: { data: ExerciseForecastDTO }) {
  const f = data.forecast;
  const [active, setActive] = useState<number | null>(null);
  const pts = f.points;
  if (pts.length === 0) return null;

  const lastX = pts[pts.length - 1].x;
  const eta = f.status === 'on_track' && f.etaDays ? f.etaDays : null;
  const xMax = Math.max(lastX + (eta ? Math.min(eta[2], 120) : 0), 7);
  const yMax = Math.max(10, ...pts.map((p) => p.deficit), f.fit ? f.fit.intercept : 0) * 1.1;
  const sx = (x: number) => PAD.l + (x / xMax) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - Math.max(0, y) / yMax) * (H - PAD.t - PAD.b);
  const yTicks = [0, Math.round(yMax / 2), Math.round(yMax)];
  const fitY = (x: number) => (f.fit ? f.fit.intercept + f.fit.slopePerDay * x : 0);
  const current = f.fit ? Math.max(0, fitY(lastX)) : null;
  const hovered = active !== null ? pts[active] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`องศาที่ยังขาดจากช่วงเป้าหมาย รายวัน ${pts.length} วัน`}>
        {/* grid: solid hairlines, recessive */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} className={v === 0 ? 'stroke-foreground/40' : 'stroke-border'} strokeWidth={1} />
            <text x={PAD.l - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[9px]">
              {v}°
            </text>
          </g>
        ))}
        <text x={PAD.l + 4} y={sy(0) - 4} className="fill-muted-foreground text-[9px]">
          0° = ถึงช่วงเป้าหมาย
        </text>

        {/* estimated arrival window on the goal line */}
        {eta && (
          <g>
            <rect
              x={sx(lastX + eta[0])}
              y={sy(0) - 5}
              width={Math.max(2, sx(lastX + Math.min(eta[2], 120)) - sx(lastX + eta[0]))}
              height={10}
              rx={3}
              className="fill-teal-500/20"
            />
            <line x1={sx(lastX)} y1={sy(current ?? 0)} x2={sx(lastX + eta[1])} y2={sy(0)} className="stroke-teal-600 dark:stroke-teal-400" strokeWidth={2} strokeDasharray="5 4" />
          </g>
        )}

        {/* robust trend over the observed period */}
        {f.fit && (
          <line x1={sx(0)} y1={sy(fitY(0))} x2={sx(lastX)} y2={sy(fitY(lastX))} className="stroke-teal-600 dark:stroke-teal-400" strokeWidth={2} strokeLinecap="round" />
        )}

        {/* daily points: 8px markers with a 2px surface ring; ≥24px hit areas */}
        {pts.map((p, i) => (
          <g key={p.day}>
            <circle cx={sx(p.x)} cy={sy(p.deficit)} r={4} className="fill-teal-600 stroke-card dark:fill-teal-400" strokeWidth={2} />
            <circle
              cx={sx(p.x)}
              cy={sy(p.deficit)}
              r={12}
              className="fill-transparent outline-none"
              tabIndex={0}
              aria-label={`${thDay(p.day)} ขาด ${p.deficit} องศา`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            />
          </g>
        ))}

        {/* x-axis: first day, last day */}
        <text x={sx(0)} y={H - 8} className="fill-muted-foreground text-[9px]">
          {thDay(pts[0].day)}
        </text>
        <text x={sx(lastX)} y={H - 8} textAnchor={eta ? 'middle' : 'end'} className="fill-muted-foreground text-[9px]">
          {thDay(pts[pts.length - 1].day)}
        </text>
        {eta && sx(lastX + Math.min(eta[2], 120)) - sx(lastX) > 60 && (
          <text x={W - PAD.r} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[9px]">
            {eta[2] > 120 ? 'เกินกรอบกราฟ' : thDay(addDaysIso(pts[pts.length - 1].day, eta[2]))}
          </text>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-md"
          style={{ left: `${(sx(hovered.x) / W) * 100}%`, top: `${(sy(hovered.deficit) / H) * 100}%` }}
        >
          <span className="font-medium">{thDay(hovered.day)}</span> · ขาด {hovered.deficit}°
        </div>
      )}
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────

export function RecoveryForecastCard({ data }: { data: ExerciseForecastDTO }) {
  const f = data.forecast;
  const s = STATUS[f.status];
  const Icon = s.icon;

  return (
    <div className="space-y-2 rounded-lg border p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{data.exerciseTh}</span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.className}`}>
          <Icon className="h-3.5 w-3.5" />
          {s.label}
        </span>
      </div>

      <p className="text-sm font-semibold leading-snug text-foreground">{headline(data)}</p>

      <ForecastChart data={data} />

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
        {data.target && (
          <div className="col-span-2">
            <dt className="inline">เป้าหมาย: </dt>
            <dd className="inline text-foreground">
              {data.target.jointTh} {data.target.minAngle}°–{data.target.maxAngle}°
            </dd>
          </div>
        )}
        {f.currentDeficit !== null && (
          <div>
            <dt className="inline">ยังขาด: </dt>
            <dd className="inline text-foreground">≈{f.currentDeficit}°</dd>
          </div>
        )}
        {f.slopePerWeek !== null && f.slopeInterval && (
          <div>
            <dt className="inline">แนวโน้ม: </dt>
            <dd className="inline text-foreground">
              {f.slopePerWeek > 0 ? '+' : ''}
              {f.slopePerWeek}°/สัปดาห์
            </dd>
          </div>
        )}
        <div>
          <dt className="inline">ข้อมูล: </dt>
          <dd className="inline text-foreground">
            {f.daysWithData} วัน ใน {f.spanDays + 1} วัน
          </dd>
        </div>
        {data.adherence !== null && (
          <div>
            <dt className="inline">ฝึกตามแผน (28 วัน): </dt>
            <dd className="inline text-foreground">{data.adherence}%</dd>
          </div>
        )}
      </dl>

      <PopulationNote data={data} />

      {f.points.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer select-none">ดูข้อมูลเป็นตาราง</summary>
          <table className="mt-1 w-full tabular-nums">
            <thead>
              <tr className="text-left">
                <th className="py-0.5 font-medium">วันที่</th>
                <th className="py-0.5 text-right font-medium">องศาที่ยังขาด (ดีที่สุดของวัน)</th>
              </tr>
            </thead>
            <tbody>
              {f.points.map((p) => (
                <tr key={p.day} className="border-t">
                  <td className="py-0.5">{thDay(p.day)}</td>
                  <td className="py-0.5 text-right text-foreground">{p.deficit}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

/** Comparison with the clinic's other patients (population model) */
function PopulationNote({ data }: { data: ExerciseForecastDTO }) {
  const pop = data.population;
  // Not used after the goal, or for a plateau/decline (see computeRecoveryForecasts)
  if (data.forecast.status !== 'on_track' && data.forecast.status !== 'insufficient') return null;
  if (!pop) {
    return (
      <p className="flex items-start gap-1.5 text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {data.referencePatients < MIN_REFERENCE_PATIENTS
          ? `แบบจำลองประชากร: ผู้ป่วยอ้างอิงที่ฝึกท่านี้ยังมีไม่พอ (${data.referencePatients}/${MIN_REFERENCE_PATIENTS} คน)`
          : 'แบบจำลองประชากร: ต้องมีข้อมูลการฝึกอย่างน้อย 2 วัน'}
      </p>
    );
  }
  const own = Math.round(pop.ownWeight * 100);
  return (
    <div className={`space-y-1 rounded-md border p-2 ${pop.slowResponder ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20' : 'bg-muted/40'}`}>
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <Users className="h-3.5 w-3.5 shrink-0" />
        เทียบกับผู้ป่วยอื่น {pop.k} คนที่ฝึกท่านี้
      </p>
      <ul className="space-y-0.5 pl-5 text-muted-foreground">
        {pop.typicalHalfLifeDays !== null && <li>ผู้ป่วยทั่วไปลดองศาที่ยังขาดลงครึ่งหนึ่งในราว {pop.typicalHalfLifeDays} วัน</li>}
        {pop.fasterThanPercent !== null && (
          <li className={pop.slowResponder ? 'font-medium text-amber-800 dark:text-amber-300' : undefined}>
            รายนี้ฟื้นตัวเร็วกว่าผู้ป่วยอ้างอิง {pop.fasterThanPercent}%{pop.slowResponder ? ' — ช้ากว่าส่วนใหญ่ ควรทบทวนแผน' : ''}
          </li>
        )}
        <li>
          น้ำหนักข้อมูลของผู้ป่วยรายนี้ {own}%{own < 50 ? ' (ข้อมูลยังน้อย ตัวเลขจึงใกล้ค่าเฉลี่ยของผู้ป่วยอื่น)' : ''}
        </li>
      </ul>
    </div>
  );
}

/** Caveat shown once under the forecast cards */
export function ForecastCaveat() {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <Hourglass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ประมาณการจากแนวโน้มของผู้ป่วยรายนี้เท่านั้น (Theil–Sen + bootstrap) ช่วงเร็วสุดคือกรณีพัฒนาการคงที่ ช่วงช้าสุดคือกรณีพัฒนาการช้าลงตามธรรมชาติ
      ในการทดสอบด้วยข้อมูลจำลอง ช่วงนี้ครอบคลุมวันที่ถึงเป้าหมายจริงประมาณ 63–95% ของกรณี ถือว่าการฝึกสม่ำเสมอเท่าปัจจุบัน และกล้องคลาดเคลื่อนได้ราว 5–10°
      ประมาณการเบื้องต้น (ก่อนมีข้อมูลพอ) ใช้แบบจำลองประชากรจากผู้ป่วยอื่นที่ฝึกท่าเดียวกัน ซึ่งแม่นในข้อมูลจำลองเฉพาะเมื่อการฟื้นตัวเป็นเส้นโค้งอิ่มตัวตามที่สมมติไว้
      — <strong className="font-semibold">ต้นแบบเพื่อการศึกษา ยังไม่ได้ตรวจสอบกับข้อมูลผู้ใช้จริง</strong> ใช้ประกอบการตัดสินใจของผู้ดูแลเท่านั้น
      (ผลทางสถิติ: docs/PREDICTIVE-ANALYTICS.md)
    </p>
  );
}
