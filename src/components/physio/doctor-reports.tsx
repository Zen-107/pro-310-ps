'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClinicalSummaryMarkdown, ReportPrintDocument, type PrintableReport } from '@/components/physio/report-print';
import { useAppStore } from '@/lib/store';
import { categoryLabel } from '@/lib/exercises-data';
import { getAccuracyTextColor, getAccuracyBarColor } from '@/lib/angle-utils';
import {
  ReportFormulas,
  ReportReps,
  ReviewPanel,
  ReportFaultsPanel,
  ClinicalSessionReplay,
  type ReportFaults,
  type ReportRep,
  type ReportReview,
  type ReportTarget,
} from '@/components/physio/report-transparency';
import {
  FileText,
  RefreshCw,
  Printer,
  Loader2,
  ClipboardList,
  Eye,
  Stethoscope,
  Sparkles,
  UserSearch,
  Activity,
  Target,
  TrendingUp,
  CalendarDays,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Patient {
  id: string;
  name: string;
  age?: number;
  gender?: string;
  condition?: string;
  totalSessions?: number;
  recentSessions7d?: number;
  latestAccuracy?: number;
}

interface Session {
  id: string;
  exerciseId: string;
  patientId: string;
  startedAt: string;
  endedAt: string | null;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  status: string;
  exercise?: { name: string; nameTh: string; category: string; icon: string };
}

interface JointReport {
  joint: string;
  nameTh: string;
  formula: string | null;
  target: { idealAngle: number; minAngle: number; maxAngle: number; angleBasis: string } | null;
  samples: number;
  avgAngle: number;
  maxAngle: number;
  minAngle: number;
  avgDeviation: number;
  accuracy: number;
}

interface ReportData extends PrintableReport {
  sessionId: string;
  patientName: string;
  exerciseName: string;
  exerciseNameEn: string;
  category: string;
  startedAt: string;
  endedAt: string | null;
  status: string;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  romMinAngle: number | null;
  romMaxAngle: number | null;
  primaryJoint: string | null;
  algorithmVersion: string;
  angleDefinition: string;
  scoring: Record<string, string>;
  targets: ReportTarget[];
  jointReport: JointReport[];
  reps: ReportRep[];
  faults: ReportFaults;
  /** Latest stored AI summary (null until generated) */
  clinicalSummary: string | null;
  generatedAt: string | null;
  review: ReportReview | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Print the report (or "Save as PDF" in the print dialog). Dark mode is
 * switched off for the printout and restored afterwards; the print styles in
 * globals.css keep only the element marked data-print-root.
 */
function printReport(title: string) {
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  const prevTitle = document.title;
  const restore = () => {
    if (wasDark) html.classList.add('dark');
    document.title = prevTitle;
    window.removeEventListener('afterprint', restore);
  };
  if (wasDark) html.classList.remove('dark');
  document.title = title; // default PDF file name
  window.addEventListener('afterprint', restore);
  window.print();
}

function deviationColor(dev: number): string {
  if (dev <= 5) return 'text-emerald-600 dark:text-emerald-400';
  if (dev <= 15) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function formatThaiDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DoctorReports() {
  const selectedPatientId = useAppStore((s) => s.selectedPatientId);
  const queuedSessionId = useAppStore((s) => s.selectedSessionId);
  const setSelectedSessionIdInStore = useAppStore((s) => s.setSelectedSessionId);
  const setSelectedPatientId = useAppStore((s) => s.setSelectedPatientId);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientId, setActivePatientId] = useState<string>('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Fetch patients ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/patients');
        if (!res.ok) throw new Error();
        const data: Patient[] = await res.json();
        if (cancelled) return;
        setPatients(data);
        // Default to store's selectedPatientId, fallback to first patient
        if (selectedPatientId) {
          setActivePatientId(selectedPatientId);
        } else if (data.length > 0) {
          setActivePatientId(data[0].id);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  /* ---- Fetch sessions when patient changes ---- */
  // Reset per-patient UI state during render when the patient changes
  const [prevPatientId, setPrevPatientId] = useState(activePatientId);
  if (prevPatientId !== activePatientId) {
    setPrevPatientId(activePatientId);
    if (activePatientId) {
      setSessionsLoading(true);
      setReport(null);
      setSelectedSessionId(null);
      setError(null);
    }
  }

  useEffect(() => {
    if (!activePatientId) return;
    let cancelled = false;
    async function fetchSessions() {
      let data: Session[] = [];
      try {
        const res = await fetch(`/api/sessions?patientId=${activePatientId}`);
        if (!res.ok) throw new Error();
        data = await res.json();
      } catch {
        data = [];
      }
      if (cancelled) return;
      setSessions(data);
      setSessionsLoading(false);
    }
    fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  /* ---- Patient selector change handler ---- */
  function handlePatientChange(value: string) {
    setActivePatientId(value);
    setSelectedPatientId(value);
  }

  /* ---- Open a session's report (metrics, formulas, stored AI summary) ---- */
  async function openReport(sessionId: string) {
    setSelectedSessionId(sessionId);
    setLoadingReport(true);
    setReport(null);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${sessionId}`);
      if (!res.ok) throw new Error('ไม่สามารถโหลดรายงานได้');
      setReport(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoadingReport(false);
    }
  }

  /* ---- Deep link from the review queue: open that session once loaded ---- */
  useEffect(() => {
    if (!queuedSessionId || sessionsLoading) return;
    if (!sessions.some((s) => s.id === queuedSessionId)) return;
    const id = setTimeout(() => {
      openReport(queuedSessionId);
      setSelectedSessionIdInStore(null);
    }, 0);
    return () => clearTimeout(id);
  }, [queuedSessionId, sessions, sessionsLoading]);

  /* ---- Generate / regenerate the AI clinical summary ---- */
  async function generateReport(sessionId: string) {
    setSelectedSessionId(sessionId);
    setGenerating(true);
    setReport(null);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${sessionId}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'ไม่สามารถสร้างรายงานได้');
      }
      const data: ReportData = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setGenerating(false);
    }
  }

  /* ---- Derived data ---- */
  const completedSessions = useMemo(
    () => sessions.filter((s) => s.status === 'COMPLETED'),
    [sessions]
  );

  const activePatient = useMemo(
    () => patients.find((p) => p.id === activePatientId),
    [patients, activePatientId]
  );

  /* ================================================================ */
  /*  Loading skeleton                                                 */
  /* ================================================================ */

  if (loading) {
    return <ReportsSkeleton />;
  }

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            รายงานคลินิก
          </h2>
          <p className="text-muted-foreground mt-1">
            สร้างและดูรายงานสรุปผลการฝึกโดย AI สำหรับผู้ป่วยแต่ละราย
          </p>
        </div>
      </div>

      {/* ---- Patient Selector ---- */}
      <Card className="border-emerald-500/20">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <UserSearch className="h-4 w-4 text-emerald-600" />
              <span>ผู้ป่วย:</span>
            </div>
            <Select value={activePatientId} onValueChange={handlePatientChange}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue placeholder="เลือกผู้ป่วย" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.condition ? ` — ${p.condition}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activePatient && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                <span className="flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  {activePatient.totalSessions ?? 0} เซสชัน
                </span>
                {activePatient.latestAccuracy != null && activePatient.latestAccuracy > 0 && (
                  <span className={`font-semibold ${getAccuracyTextColor(activePatient.latestAccuracy)}`}>
                    ความแม่นยำล่าสุด {activePatient.latestAccuracy}%
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Empty state: no patients ---- */}
      {!activePatientId && (
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <UserSearch className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">ไม่มีรายชื่อผู้ป่วย</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              กรุณาเพิ่มผู้ป่วยก่อนเริ่มสร้างรายงาน
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- Report Display Area ---- */}
      <AnimatePresence mode="wait">
        {(report || generating || loadingReport || error) && activePatientId && (
          <motion.div
            key="report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-emerald-500/20 overflow-hidden" data-print-root>
              {/* Official printed document (only visible when printing) */}
              {report && <ReportPrintDocument report={report} />}

              {/* Report header */}
              <div data-print-hide className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 p-2 bg-emerald-500/20 rounded-xl">
                      <FileText className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">
                        {report
                          ? `${report.patient.name}${report.patient.hn ? ` (HN ${report.patient.hn})` : ''} · ${report.exerciseName}`
                          : 'กำลังสร้างรายงาน...'}
                      </h3>
                      <p className="text-xs text-slate-300 truncate">
                        {report
                          ? `หมวด ${categoryLabel(report.category)} · ${report.generatedAt ? `สรุป AI เมื่อ ${formatThaiDate(report.generatedAt)}` : 'ยังไม่มีสรุป AI'}`
                          : generating ? 'AI กำลังวิเคราะห์ข้อมูลเซสชัน...' : 'กำลังโหลดรายงาน...'}
                      </p>
                    </div>
                  </div>
                  {report && selectedSessionId && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-white hover:bg-white/10"
                        disabled={generating || loadingReport}
                        onClick={() =>
                          printReport(
                            `Session report - ${report.patientName} - ${report.exerciseName} - ${report.startedAt.slice(0, 10)}`
                          )
                        }
                      >
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                        พิมพ์ / PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-300 hover:text-white hover:bg-white/10"
                        onClick={() => generateReport(selectedSessionId)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        {report.clinicalSummary ? 'สร้างสรุปใหม่' : 'สร้างสรุป AI'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <CardContent data-print-hide className="p-5 sm:p-6 space-y-6">
                {/* Loading spinner state */}
                {(generating || loadingReport) && !report && (
                  <div className="py-16 flex flex-col items-center">
                    <div className="relative mb-4">
                      <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
                      <Sparkles className="h-5 w-5 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      AI กำลังสร้างรายงานคลินิก...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      กรุณารอสักครู่ ระบบกำลังวิเคราะห์ข้อมูลข้อต่อทั้งหมด
                    </p>
                  </div>
                )}

                {/* Error state */}
                {error && !generating && (
                  <div className="py-10 flex flex-col items-center text-center">
                    <AlertCircle className="h-10 w-10 text-red-400 mb-3" />
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      {error}
                    </p>
                    {selectedSessionId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => generateReport(selectedSessionId)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        ลองอีกครั้ง
                      </Button>
                    )}
                  </div>
                )}

                {/* Report content */}
                {report && !generating && !loadingReport && (
                  <>
                    {/* ---- Stats Row ---- */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50"
                      >
                        <Activity className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {report.totalReps}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">ครั้งที่ทำ</p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50"
                      >
                        <Target className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                        <p className={`text-2xl font-bold ${getAccuracyTextColor(report.avgAccuracy)}`}>
                          {report.avgAccuracy}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">ความแม่นยำ</p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="text-center p-4 rounded-xl bg-muted border"
                      >
                        <TrendingUp className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-2xl font-bold">{report.maxRom}°</p>
                        <p className="text-xs text-muted-foreground mt-0.5">ROM สูงสุด</p>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-center p-4 rounded-xl bg-muted border"
                      >
                        <Stethoscope className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-2xl font-bold">{report.jointReport.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">ข้อต่อที่ตรวจ</p>
                      </motion.div>
                    </div>

                    {/* ---- Session metadata ---- */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground px-1">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        เริ่ม: {formatThaiDate(report.startedAt)}
                      </span>
                      {report.endedAt && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          จบ: {formatThaiDate(report.endedAt)}
                        </span>
                      )}
                    </div>

                    <Separator />

                    {/* ---- Joint Analysis Table ---- */}
                    {report.jointReport.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                      >
                        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                          <Stethoscope className="h-4 w-4 text-emerald-600" />
                          การวิเคราะห์ข้อต่อแต่ละจุด
                        </h4>
                        <div className="rounded-xl border overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[520px]">
                              <thead>
                                <tr className="bg-muted/60 border-b">
                                  <th className="text-left p-3 font-medium">ข้อต่อ</th>
                                  <th className="text-center p-3 font-medium">เฉลี่ย</th>
                                  <th className="text-center p-3 font-medium">ต่ำสุด–สูงสุด</th>
                                  <th className="text-center p-3 font-medium">เบี่ยงเบน</th>
                                  <th className="text-center p-3 font-medium w-40">
                                    ความแม่นยำ
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {report.jointReport.map((j, i) => (
                                  <motion.tr
                                    key={j.joint}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 + i * 0.06 }}
                                    className="border-t last:border-b-0 hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="p-3">
                                      <span className="font-medium">{j.nameTh}</span>
                                      {j.target && (
                                        <div className="text-[11px] text-muted-foreground tabular-nums">
                                          เป้าหมาย {j.target.minAngle}°–{j.target.maxAngle}° · {j.samples} ครั้ง
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 text-center font-bold tabular-nums">
                                      {j.avgAngle}°
                                    </td>
                                    <td className="p-3 text-center text-muted-foreground tabular-nums">
                                      {j.minAngle}° – {j.maxAngle}°
                                    </td>
                                    <td className="p-3 text-center">
                                      <span
                                        className={`font-medium tabular-nums ${deviationColor(j.avgDeviation)}`}
                                      >
                                        {j.avgDeviation}°
                                      </span>
                                    </td>
                                    <td className="p-3">
                                      <div className="flex items-center gap-2.5 justify-center">
                                        <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                                          <motion.div
                                            className={`h-full rounded-full ${getAccuracyBarColor(j.accuracy)}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${j.accuracy}%` }}
                                            transition={{ delay: 0.4 + i * 0.06, duration: 0.6 }}
                                          />
                                        </div>
                                        <span
                                          className={`text-xs font-bold tabular-nums w-9 text-right ${getAccuracyTextColor(j.accuracy)}`}
                                        >
                                          {j.accuracy}%
                                        </span>
                                      </div>
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <Separator />

                    <ReportFormulas
                      angleDefinition={report.angleDefinition}
                      scoring={report.scoring}
                      targets={report.targets}
                      algorithmVersion={report.algorithmVersion}
                      romMinAngle={report.romMinAngle}
                      romMaxAngle={report.romMaxAngle}
                      primaryJoint={report.primaryJoint}
                    />

                    <ReportReps reps={report.reps} />

                    <ReportFaultsPanel faults={report.faults} totalReps={report.totalReps} />

                    <div data-print-hide>
                    <ClinicalSessionReplay
                      key={`replay-${report.sessionId}`}
                      sessionId={report.sessionId}
                      targets={report.targets}
                      faults={report.faults.items}
                      reps={report.reps}
                      primaryJoint={report.primaryJoint}
                    />
                    </div>

                    <Separator />

                    {/* ---- Clinical Summary (Markdown) ---- */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        สรุปคลินิก (AI)
                      </h4>
                      <div className="prose prose-sm max-w-none dark:prose-invert p-5 rounded-xl bg-muted/40 border border-dashed border-muted-foreground/20 prose-headings:text-emerald-700 dark:prose-headings:text-emerald-400 prose-strong:text-foreground prose-li:marker:text-amber-500">
                        {report.clinicalSummary ? (
                          <ClinicalSummaryMarkdown
                            content={report.clinicalSummary}
                            jointNames={Object.fromEntries(report.jointReport.map((j) => [j.joint, j.nameTh]))}
                          />
                        ) : (
                          <div className="not-prose flex flex-col items-center gap-2 py-4 text-center">
                            <p className="text-sm text-muted-foreground">ยังไม่มีสรุปคลินิกสำหรับเซสชันนี้</p>
                            <Button data-print-hide size="sm" variant="outline" onClick={() => generateReport(report.sessionId)}>
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> สร้างสรุปด้วย AI
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-2 px-1 italic">
                        หมายเหตุ: รายงานนี้สร้างโดย AI จากข้อมูลการตรวจจับท่าทาง
                        แพทย์ควรพิจารณาร่วมกับการตรวจแบบตัวต่อตัว
                      </p>
                    </motion.div>

                    {report.status === 'COMPLETED' && (
                      <>
                        <Separator />
                        <ReviewPanel
                          key={report.sessionId}
                          sessionId={report.sessionId}
                          review={report.review}
                          onReviewed={(review) => setReport((r) => (r ? { ...r, review } : r))}
                        />
                      </>
                    )}

                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Empty state: no report, not generating ---- */}
      {!report && !generating && !error && activePatientId && !sessionsLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="py-14 flex flex-col items-center text-center">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 mb-3">
                <ClipboardList className="h-10 w-10 text-emerald-500/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                เลือกเซสชันจากรายการด้านล่างเพื่อดูรายงานคลินิก
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                แสดงสูตรคำนวณ ผลรายข้อต่อ/รายครั้ง สรุป AI และการรับรองผล
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ---- Session List ---- */}
      {activePatientId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              เซสชันที่สำเร็จ
              {!sessionsLoading && (
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {completedSessions.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <SessionListSkeleton />
            ) : completedSessions.length === 0 ? (
              <div className="py-10 text-center">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  ยังไม่มีเซสชันที่สำเร็จสำหรับผู้ป่วยท่านนี้
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="space-y-2">
                  {completedSessions.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => openReport(s.id)}
                      className={`
                        flex items-center justify-between p-3.5 rounded-xl cursor-pointer
                        transition-all duration-150 group
                        ${
                          selectedSessionId === s.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                            : 'bg-muted/40 hover:bg-muted border border-transparent hover:border-border'
                        }
                      `}
                    >
                      {/* Left: exercise info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium truncate">
                            {s.exercise?.name || 'Exercise'}
                          </p>
                          {s.exercise?.category && (
                            <Badge
                              variant="outline"
                              className="text-[10px] shrink-0 font-normal"
                            >
                              {categoryLabel(s.exercise.category)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatShortDate(s.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Activity className="h-3 w-3" />
                            {s.totalReps} ครั้ง
                          </span>
                        </div>
                      </div>

                      {/* Right: accuracy + eye */}
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold tabular-nums ${getAccuracyTextColor(s.avgAccuracy)}`}
                          >
                            {Math.round(s.avgAccuracy)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">ความแม่นยำ</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-muted group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/40 transition-colors">
                          <Eye className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeletons                                                          */
/* ------------------------------------------------------------------ */

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-4 w-80" />

      {/* Patient selector skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-72 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Report area skeleton */}
      <Card>
        <div className="bg-muted/30 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 p-4 rounded-xl bg-muted">
                <Skeleton className="h-4 w-8 mx-auto" />
                <Skeleton className="h-7 w-12 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
          {/* Joint table skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <div className="rounded-xl border overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border-b last:border-b-0">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12 ml-auto" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-10" />
                  <div className="flex items-center gap-2 w-28">
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Clinical summary skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <div className="p-5 rounded-xl bg-muted/40 border border-dashed space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-9/12" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session list skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-6 w-6 rounded-lg" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-6 w-6 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}