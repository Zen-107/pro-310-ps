'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart, Line, ResponsiveContainer,
} from 'recharts';
import {
  Users, CalendarCheck, Target, Activity, AlertTriangle,
  Clock, Flame, ChevronRight, User,
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

interface SessionBrief {
  id: string;
  patientId: string;
  startedAt: string;
  avgAccuracy: number;
  status: string;
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
  const [sessions, setSessions] = useState<SessionBrief[]>([]);
  const [sparklineMap, setSparklineMap] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  /* ---- Data fetching ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Parallel: patients list + all sessions (for "today" count)
        const [patientsRes, sessionsRes] = await Promise.all([
          fetch('/api/patients'),
          fetch('/api/sessions'),
        ]);

        if (!patientsRes.ok || !sessionsRes.ok) throw new Error('fetch failed');

        const patientsData: PatientSummary[] = await patientsRes.json();
        const sessionsData: SessionBrief[] = await sessionsRes.json();

        if (cancelled) return;

        setPatients(patientsData);
        setSessions(sessionsData);

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

    // Sessions today (completed, started today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sessionsToday = sessions.filter(
      (s) => s.status === 'COMPLETED' && new Date(s.startedAt) >= todayStart
    ).length;

    // Overall average accuracy (from patients with at least 1 session)
    const patientsWithAcc = patients.filter((p) => p.latestAccuracy > 0);
    const overallAvgAccuracy =
      patientsWithAcc.length > 0
        ? Math.round(
            patientsWithAcc.reduce((sum, p) => sum + p.latestAccuracy, 0) /
              patientsWithAcc.length
          )
        : 0;

    // Active patients (recentSessions7d > 0)
    const activePatients = patients.filter((p) => p.recentSessions7d > 0).length;

    return { totalPatients, sessionsToday, overallAvgAccuracy, activePatients };
  }, [patients, sessions]);

  /* ---- Quick alerts (computed) ---- */
  const alerts = useMemo(() => {
    const result: { type: 'warning' | 'info'; message: string; patientName: string; patientId: string }[] = [];

    for (const p of patients) {
      // Inactive for 7+ days (has sessions but no recent)
      if (p.totalSessions > 0 && p.recentSessions7d === 0) {
        result.push({
          type: 'warning',
          message: 'ไม่ได้ฝึกมา 7 วัน',
          patientName: p.name,
          patientId: p.id,
        });
      }
      // Never started
      if (p.totalSessions === 0) {
        result.push({
          type: 'info',
          message: 'ยังไม่เคยเริ่มฝึก',
          patientName: p.name,
          patientId: p.id,
        });
      }
      // Low accuracy
      if (p.latestAccuracy > 0 && p.latestAccuracy < 50 && p.totalSessions >= 3) {
        result.push({
          type: 'warning',
          message: `ความแม่นยำต่ำ (${p.latestAccuracy}%)`,
          patientName: p.name,
          patientId: p.id,
        });
      }
    }

    return result;
  }, [patients]);

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

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ---- Header ---- */}
      <motion.div variants={item}>
        <h2 className="text-2xl font-bold tracking-tight">ภาพรวมผู้ป่วย</h2>
        <p className="text-muted-foreground mt-1">ติดตามความคืบหน้าของผู้ป่วยทั้งหมด</p>
      </motion.div>

      {/* ---- Summary Stats Row ---- */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Users className="h-4.5 w-4.5 text-emerald-600" />}
          label="จำนวนผู้ป่วยทั้งหมด"
          value={stats.totalPatients}
          color="emerald"
        />
        <SummaryCard
          icon={<CalendarCheck className="h-4.5 w-4.5 text-amber-500" />}
          label="เซสชันวันนี้"
          value={stats.sessionsToday}
          color="amber"
        />
        <SummaryCard
          icon={<Target className="h-4.5 w-4.5 text-emerald-600" />}
          label="ความแม่นยำเฉลี่ยรวม"
          value={`${stats.overallAvgAccuracy}%`}
          color="emerald"
        />
        <SummaryCard
          icon={<Activity className="h-4.5 w-4.5 text-amber-500" />}
          label="ผู้ป่วยที่กำลังฝึก"
          value={stats.activePatients}
          color="amber"
        />
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

      {/* ---- Quick Alerts ---- */}
      {alerts.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-amber-200/60 dark:border-amber-800/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                การแจ้งเตือนด่วน
                <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0 text-[10px] px-1.5">
                  {alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-64">
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <button
                      key={`${alert.patientId}-${i}`}
                      onClick={() => onSelectPatient(alert.patientId)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/30 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-950/40 transition-colors text-left group"
                    >
                      <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.type === 'warning' ? 'text-amber-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm flex-1">
                        <span className="font-medium">{alert.patientName}</span>{' '}
                        <span className="text-muted-foreground">— {alert.message}</span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Stat Card                                                  */
/* ------------------------------------------------------------------ */

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'emerald' | 'amber';
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </CardContent>
      {/* Subtle accent line */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-0.5 ${
          color === 'emerald' ? 'bg-emerald-500/40' : 'bg-amber-500/40'
        }`}
      />
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
        className="cursor-pointer hover:shadow-md hover:border-emerald-300/50 dark:hover:border-emerald-700/50 transition-all group"
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
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
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
                      stroke="#10b981"
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