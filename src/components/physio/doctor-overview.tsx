'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewQueue } from '@/components/physio/review-queue';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart, Line, ResponsiveContainer,
} from 'recharts';
import {
  Users, CalendarCheck, AlertTriangle, ClipboardCheck, ShieldAlert,
  Flame, ChevronRight, User,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PatientSummary {
  id: string;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  phone: string;
  assignedExerciseIds: string[];
  therapistNotes: string;
  streak: number;
  totalMinutes: number;
  lastActiveAt: string | null;
  totalSessions: number;
  recentSessions7d: number;
  latestAccuracy: number;
}

interface ClinicianSummary {
  completedToday: number;
  pendingReviews: number;
  redFlags: { patientId: string; patientName: string; message: string; at: string; count: number }[];
  redFlagWindowDays: number;
}

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DoctorOverview({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [summary, setSummary] = useState<ClinicianSummary | null>(null);
  const [sparklineMap, setSparklineMap] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* ---- Data fetching ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Parallel: patients list + dashboard headline numbers
        const [patientsRes, summaryRes] = await Promise.all([
          fetch('/api/patients'),
          fetch('/api/clinician/summary').catch(() => null),
        ]);

        if (!patientsRes.ok) throw new Error('fetch failed');

        const patientsData: PatientSummary[] = await patientsRes.json();
        const summaryData: ClinicianSummary | null = summaryRes?.ok ? await summaryRes.json() : null;

        if (cancelled) return;

        setPatients(patientsData);
        setSummary(summaryData);

        // Fetch sparkline data (last 3 session accuracies) for patients with sessions
        const patientsWithSessions = patientsData.filter((p) => p.totalSessions > 0);
        if (patientsWithSessions.length > 0) {
          const detailPromises = patientsWithSessions.map(async (p) => {
            try {
              const res = await fetch(`/api/patients/${p.id}`);
              if (!res.ok) return null;
              const detail = await res.json();
              // sessionDetails is ordered by startedAt desc
              const last3 = (detail.sessionDetails || [])
                .slice(0, 3)
                .map((s: { avgAccuracy: number }) => s.avgAccuracy);
              return { id: p.id, accuracies: last3.reverse() }; // chronological order
            } catch {
              return null;
            }
          });

          const results = await Promise.all(detailPromises);
          if (cancelled) return;

          const map: Record<string, number[]> = {};
          for (const r of results) {
            if (r) map[r.id] = r.accuracies;
          }
          setSparklineMap(map);
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  /* ---- Computed summary stats ---- */
  const stats = useMemo(() => {
    const totalPatients = patients.length;
    const activePatients = patients.filter((p) => p.recentSessions7d > 0).length;
    return { totalPatients, activePatients };
  }, [patients]);

  /* ---- Alerts: red flags (escalated symptoms) first, then risk signals ---- */
  const alerts = useMemo(() => {
    const result: { level: 'red' | 'warning' | 'info'; message: string; patientName: string; patientId: string }[] = [];

    for (const f of summary?.redFlags ?? []) {
      result.push({
        level: 'red',
        message: `แจ้งอาการที่ต้องประเมิน${f.count > 1 ? ` (${f.count} ครั้ง)` : ''}: “${f.message}”`,
        patientName: f.patientName,
        patientId: f.patientId,
      });
    }
    for (const p of patients) {
      // Low accuracy over several sessions
      if (p.latestAccuracy > 0 && p.latestAccuracy < 50 && p.totalSessions >= 3) {
        result.push({ level: 'warning', message: `ความแม่นยำต่ำ (${p.latestAccuracy}%)`, patientName: p.name, patientId: p.id });
      }
      // Inactive for 7+ days (has sessions but no recent)
      if (p.totalSessions > 0 && p.recentSessions7d === 0) {
        result.push({ level: 'warning', message: 'ไม่ได้ฝึกมา 7 วัน', patientName: p.name, patientId: p.id });
      }
      // Never started
      if (p.totalSessions === 0) {
        result.push({ level: 'info', message: 'ยังไม่เคยเริ่มฝึก', patientName: p.name, patientId: p.id });
      }
    }
    return result;
  }, [patients, summary]);

  const highRiskCount = useMemo(
    () => new Set(alerts.filter((a) => a.level !== 'info').map((a) => a.patientId)).size,
    [alerts]
  );
  const redFlagCount = summary?.redFlags.length ?? 0;

  /* ---- Render ---- */
  if (loading) return <DoctorOverviewSkeleton />;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mb-3 text-amber-500" />
        <p className="text-sm">ไม่สามารถโหลดข้อมูลได้</p>
      </div>
    );
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div variants={item} className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ภาพรวมผู้ป่วย</h2>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* ---- Summary cards ---- */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<CalendarCheck className="h-5 w-5" />}
          label="ฝึกเสร็จวันนี้"
          value={summary?.completedToday ?? '—'}
          hint="เซสชันที่เสร็จสมบูรณ์"
          tone="teal"
        />
        <SummaryCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="รอตรวจสอบ"
          value={summary?.pendingReviews ?? '—'}
          hint="รายงานที่ยังไม่ได้รับรอง"
          tone={summary?.pendingReviews ? 'amber' : 'slate'}
          onClick={() => scrollTo('review-queue')}
        />
        <SummaryCard
          icon={<ShieldAlert className="h-5 w-5" />}
          label="ความเสี่ยงสูง / Red flags"
          value={highRiskCount}
          hint={redFlagCount ? `Red flag ${redFlagCount} ราย ใน ${summary?.redFlagWindowDays ?? 7} วัน` : 'ไม่มี Red flag ใน 7 วัน'}
          tone={redFlagCount ? 'red' : highRiskCount ? 'amber' : 'slate'}
          onClick={() => scrollTo('alerts')}
        />
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          label="กำลังฝึก (7 วัน)"
          value={`${stats.activePatients}/${stats.totalPatients}`}
          hint="ผู้ป่วยที่มีการฝึกล่าสุด"
          tone="slate"
        />
      </motion.div>

      {/* ---- Alerts + review queue ---- */}
      <motion.div variants={item} className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card id="alerts" className={`scroll-mt-20 ${redFlagCount ? 'border-red-300/70 dark:border-red-900/60' : ''}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className={`h-4 w-4 ${redFlagCount ? 'text-red-500' : 'text-amber-500'}`} />
              การแจ้งเตือนและความเสี่ยง
              {alerts.length > 0 && (
                <Badge variant="secondary" className="ml-1 border-0 px-1.5 text-[10px]">
                  {alerts.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีการแจ้งเตือน</p>
            ) : (
              <ScrollArea className="max-h-80">
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <button
                      key={`${alert.patientId}-${i}`}
                      onClick={() => onSelectPatient(alert.patientId)}
                      className={`group flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${ALERT_STYLE[alert.level]}`}
                    >
                      {alert.level === 'red' ? (
                        <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                      ) : (
                        <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.level === 'warning' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      )}
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{alert.patientName}</span>{' '}
                        <span className="text-muted-foreground">— {alert.message}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
        <div id="review-queue" className="scroll-mt-20">
          <ReviewQueue />
        </div>
      </motion.div>

      {/* ---- Patient Cards Grid ---- */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">รายชื่อผู้ป่วย</h3>
          <span className="text-xs text-muted-foreground">{patients.length} คน</span>
        </div>

        {patients.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">ยังไม่มีผู้ป่วยในระบบ</p>
              <p className="text-xs mt-1">เพิ่มผู้ป่วยจากแท็บ &quot;ผู้ป่วย&quot;</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map((p) => (
              <PatientCard
                key={p.id}
                patient={p}
                sparkline={sparklineMap[p.id] || []}
                onClick={() => onSelectPatient(p.id)}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

const ALERT_STYLE: Record<'red' | 'warning' | 'info', string> = {
  red: 'border-red-200 bg-red-50/80 hover:bg-red-100/80 dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50',
  warning: 'border-amber-200/60 bg-amber-50/60 hover:bg-amber-100/70 dark:border-amber-800/30 dark:bg-amber-950/20 dark:hover:bg-amber-950/40',
  info: 'border-border bg-muted/40 hover:bg-muted',
};

/* ------------------------------------------------------------------ */
/*  Summary Stat Card                                                  */
/* ------------------------------------------------------------------ */

type Tone = 'teal' | 'amber' | 'red' | 'slate';

const TONE: Record<Tone, { icon: string; bar: string; value: string }> = {
  teal: { icon: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300', bar: 'bg-teal-500', value: '' },
  amber: { icon: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', bar: 'bg-amber-500', value: 'text-amber-700 dark:text-amber-300' },
  red: { icon: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300', bar: 'bg-red-500', value: 'text-red-700 dark:text-red-300' },
  slate: { icon: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-300 dark:bg-slate-600', value: '' },
};

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone: Tone;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  const body = (
    <CardContent className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.icon}`}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold tabular-nums tracking-tight ${t.value}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </CardContent>
  );
  return (
    <Card className="relative overflow-hidden">
      {onClick ? (
        <button type="button" onClick={onClick} className="h-full w-full text-left transition-colors hover:bg-muted/40 focus-visible:outline-2">
          {body}
        </button>
      ) : (
        body
      )}
      <div className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Patient Card                                                       */
/* ------------------------------------------------------------------ */

function PatientCard({
  patient,
  sparkline,
  onClick,
}: {
  patient: PatientSummary;
  sparkline: number[];
  onClick: () => void;
}) {
  const isActive = patient.recentSessions7d > 0;

  const lastActive = patient.lastActiveAt
    ? new Date(patient.lastActiveAt).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <motion.div variants={item}>
      <Card
        className="cursor-pointer hover:shadow-md hover:border-teal-300/60 dark:hover:border-teal-700/60 transition-all group"
        onClick={onClick}
      >
        <CardContent className="p-4 space-y-3">
          {/* Top row: name + badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{patient.name}</p>
              {patient.condition && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{patient.condition}</p>
              )}
            </div>
            <Badge
              variant="secondary"
              className={`shrink-0 text-[10px] border-0 px-2 py-0.5 ${
                isActive
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {isActive ? 'กำลังฝึก' : 'ไม่มีกิจกรรม'}
            </Badge>
          </div>

          {/* Age / Gender */}
          <p className="text-xs text-muted-foreground">
            {[
              patient.age ? `${patient.age} ปี` : null,
              patient.gender !== 'ไม่ระบุ' ? patient.gender : null,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-sm font-bold">{patient.totalSessions}</p>
              <p className="text-[10px] text-muted-foreground">เซสชัน</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className={`text-sm font-bold ${patient.latestAccuracy >= 70 ? 'text-emerald-600' : patient.latestAccuracy >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                {patient.latestAccuracy > 0 ? `${patient.latestAccuracy}%` : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">แม่นยำ</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-sm font-bold flex items-center justify-center gap-1">
                {patient.streak > 0 && <Flame className="h-3 w-3 text-amber-500" />}
                {patient.streak}
              </p>
              <p className="text-[10px] text-muted-foreground">Streak</p>
            </div>
          </div>

          {/* Sparkline + last active */}
          <div className="flex items-end justify-between gap-3 pt-1">
            {sparkline.length > 1 ? (
              <div className="w-24 h-[50px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkline.map((v, i) => ({ i, v }))}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="w-24 h-[50px] flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">ยังไม่มีข้อมูล</span>
              </div>
            )}
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">กิจกรรมล่าสุด</p>
              <p className="text-xs font-medium">{lastActive || '—'}</p>
            </div>
          </div>

          {/* Click indicator */}
          <div className="flex items-center justify-end">
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              ดูรายละเอียด <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function DoctorOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3.5 w-28 mb-2" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Patient cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-12" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-16" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
                <div className="flex items-end justify-between">
                  <Skeleton className="h-[50px] w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Alerts skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}