'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  ArrowLeft, Activity, Target, Flame, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Calendar, Clock, User, Phone, Stethoscope, AlertTriangle, Info, CheckCircle2,
  BarChart3, Save, Loader2, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { AiInsightsPanel } from '@/components/physio/ai-insights-panel';
import { categoryLabel } from '@/lib/exercises-data';
import { getAccuracyTextColor, getAccuracyBarColor } from '@/lib/angle-utils';

/* ─────────── Types ─────────── */

interface PatientListItem {
  id: string;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  phone: string;
  assignedExerciseIds: string[];
  therapistNotes: string;
  streak: number;
  totalSessions: number;
  totalMinutes: number;
  recentSessions7d: number;
  latestAccuracy: number;
}

interface SessionDetail {
  id: string;
  exerciseName: string;
  exerciseCategory: string;
  startedAt: string;
  endedAt: string | null;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  logCount: number;
}

interface RomEntry {
  exercise: string;
  exerciseTh: string;
  rom: number;
  accuracy: number;
  date: string;
}

interface PatientAlert {
  type: 'warning' | 'info' | 'success';
  message: string;
}

interface DetailedPatient {
  id: string;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  phone: string;
  assignedExerciseIds: string[];
  therapistNotes: string;
  streak: number;
  totalSessions: number;
  totalMinutes: number;
  totalReps: number;
  avgAccuracy: number;
  exercisesCompleted: number;
  recentSessions7d: number;
  improvementTrend: number;
  lastActiveAt: string | null;
  alerts: PatientAlert[];
}

interface FullData {
  patient: DetailedPatient;
  sessionDetails: SessionDetail[];
  latestRomPerExercise: RomEntry[];
  jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]>;
}

/* ─────────── Constants ─────────── */

const GENDER_LABELS: Record<string, string> = {
  ชาย: 'ชาย',
  หญิง: 'หญิง',
  ไม่ระบุ: 'ไม่ระบุ',
};

const FADE_UP = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const STAGGER_CONTAINER = {
  animate: { transition: { staggerChildren: 0.08 } },
};

/* ─────────── Helpers ─────────── */

function getAccBgColor(acc: number) {
  if (acc >= 80) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
  if (acc >= 60) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
}

function AlertIcon({ type }: { type: PatientAlert['type'] }) {
  switch (type) {
    case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'info': return <Info className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
}

function AlertStyle({ type }: { type: PatientAlert['type'] }) {
  switch (type) {
    case 'warning': return 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20';
    case 'info': return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20';
    case 'success': return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30';
  }
}

/* ─────────── Tooltip ─────────── */

const ChartTooltipStyle = {
  borderRadius: '8px',
  border: '1px solid hsl(var(--border))',
  fontSize: '12px',
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
};

/* ─────────── Main Component ─────────── */

export function DoctorPatients() {
  const { selectedPatientId, setSelectedPatientId } = useAppStore();

  // Patient list state
  const [patientList, setPatientList] = useState<PatientListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Detailed data state
  const [data, setData] = useState<FullData | null>(null);
  const [detailPatientId, setDetailPatientId] = useState<string | null>(null);

  // detailLoading is derived — true when we have a selected patient but haven't fetched yet
  const detailLoading = selectedPatientId !== null && detailPatientId !== selectedPatientId;

  // UI state
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [selectedJoint, setSelectedJoint] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [savingNotes, setSavingNotes] = useState(false);

  /* ── Fetch patient list ── */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/patients')
      .then((r) => r.json())
      .then((d: PatientListItem[]) => {
        if (!cancelled) {
          setPatientList(Array.isArray(d) ? d : []);
          setListLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  /* ── Auto-select first patient if none selected ── */
  useEffect(() => {
    if (!selectedPatientId && patientList.length > 0) {
      setSelectedPatientId(patientList[0].id);
    }
  }, [patientList, selectedPatientId, setSelectedPatientId]);

  /* ── Fetch detailed data when selectedPatientId changes ── */
  useEffect(() => {
    if (!selectedPatientId) return;
    let cancelled = false;
    fetch(`/api/patients/${selectedPatientId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          if (d && d.patient) {
            setData(d as FullData);
            setNotes(d.patient.therapistNotes || '');
            setNotesSaved(true);
          }
          setExpandedSession(null);
          setSelectedJoint('');
          setDetailPatientId(selectedPatientId);
        }
      })
      .catch(() => {
        if (!cancelled) setDetailPatientId(selectedPatientId);
      });
    return () => { cancelled = true; };
  }, [selectedPatientId]);

  /* ── Save therapist notes ── */
  const handleSaveNotes = async () => {
    if (!selectedPatientId || savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/patients/${selectedPatientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ therapistNotes: notes }),
      });
      if (res.ok) {
        toast.success('บันทึกบันทึกของแพทย์สำเร็จ');
        setNotesSaved(true);
      } else {
        toast.error('ไม่สามารถบันทึกได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
    setSavingNotes(false);
  };

  /* ── Handle back ── */
  const handleBack = () => {
    setSelectedPatientId(null);
    setData(null);
  };

  /* ── Loading state ── */
  if (listLoading) return <PatientsSkeleton />;

  if (patientList.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ข้อมูลผู้ป่วย</h2>
          <p className="text-muted-foreground mt-1">ดูข้อมูลเชิงลึกและกราฟพัฒนาการ</p>
        </div>
        <Card className="p-8 text-center">
          <Stethoscope className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">ยังไม่มีข้อมูลผู้ป่วย</p>
        </Card>
      </div>
    );
  }

  /* ── Derived data ── */
  const patient = data?.patient;
  const sessionDetails = data?.sessionDetails || [];
  const jointTrends = data?.jointTrends || {};
  const jointNames = Object.keys(jointTrends);
  const effectiveJoint =
    selectedJoint && jointNames.includes(selectedJoint) ? selectedJoint : jointNames[0] || '';

  // Accuracy trend (chronological order, last 15)
  const accuracyTrend = [...sessionDetails]
    .reverse()
    .slice(0, 15)
    .map((s, i) => ({
      name: `#${i + 1}`,
      accuracy: s.avgAccuracy,
    }));

  // Joint trend data
  const jointData =
    (jointTrends[effectiveJoint] || [])
      .slice(-20)
      .map((p, i) => ({
        name: `#${i + 1}`,
        angle: Math.round(p.angle),
        ideal: Math.round(p.idealAngle),
      })) || [];

  // Category stats
  const catStats: Record<string, { count: number; totalAcc: number }> = {};
  sessionDetails.forEach((s) => {
    if (!catStats[s.exerciseCategory]) catStats[s.exerciseCategory] = { count: 0, totalAcc: 0 };
    catStats[s.exerciseCategory].count++;
    catStats[s.exerciseCategory].totalAcc += s.avgAccuracy;
  });

  const idealAngleForJoint = jointData.length > 0 ? jointData[0].ideal : 0;

  return (
    <motion.div
      className="space-y-6"
      variants={STAGGER_CONTAINER}
      initial="initial"
      animate="animate"
    >
      {/* ── 1. Header ── */}
      <motion.div variants={FADE_UP} className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
          aria-label="กลับ"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ข้อมูลผู้ป่วย</h2>
          <p className="text-muted-foreground text-sm mt-0.5">ดูข้อมูลเชิงลึกและกราฟพัฒนาการ</p>
        </div>
      </motion.div>

      {/* ── 2. Patient Selector ── */}
      <motion.div variants={FADE_UP}>
        <Select
          value={selectedPatientId || ''}
          onValueChange={(val) => setSelectedPatientId(val)}
        >
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="เลือกผู้ป่วย..." />
          </SelectTrigger>
          <SelectContent>
            {patientList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {p.condition ? `— ${p.condition}` : ''}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* ── Detail Content ── */}
      {detailLoading && <PatientsDetailSkeleton />}

      {!detailLoading && patient && (
        <>
          {/* ── 3. Patient Profile Card ── */}
          <motion.div variants={FADE_UP}>
            <Card className="border-slate-200 dark:border-slate-700">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Avatar */}
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0">
                    <User className="h-7 w-7 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold">{patient.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> อายุ {patient.age ?? '-'} ปี
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5" /> {GENDER_LABELS[patient.gender] || patient.gender}
                        </span>
                        {patient.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" /> {patient.phone}
                          </span>
                        )}
                      </div>
                      {patient.condition && (
                        <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                          <Activity className="h-3 w-3 mr-1" />
                          {patient.condition}
                        </Badge>
                      )}
                    </div>

                    {/* Therapist Notes */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        บันทึกของแพทย์
                      </label>
                      <Textarea
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          setNotesSaved(false);
                        }}
                        placeholder="บันทึกหมายเหตุสำหรับผู้ป่วย..."
                        className="min-h-[80px] resize-y text-sm"
                      />
                      <div className="flex items-center justify-end gap-2">
                        {!notesSaved && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">ยังไม่ได้บันทึก</span>
                        )}
                        <Button
                          size="sm"
                          onClick={handleSaveNotes}
                          disabled={notesSaved || savingNotes}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {savingNotes ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          บันทึก
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── 4. Stats Row (4 cards) ── */}
          <motion.div variants={FADE_UP} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Calendar className="h-5 w-5 text-emerald-600" />}
              label="เซสชันทั้งหมด"
              value={String(patient.totalSessions)}
              sub={`${patient.recentSessions7d} เซสชันใน 7 วัน`}
              delay={0}
            />
            <StatCard
              icon={<Target className="h-5 w-5 text-emerald-600" />}
              label="ความแม่นยำเฉลี่ย"
              value={`${patient.avgAccuracy}%`}
              valueClass={getAccuracyTextColor(patient.avgAccuracy)}
              sub={`${patient.totalReps} ครั้งทั้งหมด`}
              delay={0.05}
            />
            <StatCard
              icon={<Flame className="h-5 w-5 text-amber-500" />}
              label="Streak"
              value={`${patient.streak} วัน`}
              valueClass={patient.streak > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}
              sub={patient.totalMinutes > 0 ? `${patient.totalMinutes} นาทีรวม` : '-'}
              delay={0.1}
            />
            <StatCard
              icon={
                patient.improvementTrend >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )
              }
              label="แนวโน้ม"
              value={`${patient.improvementTrend >= 0 ? '+' : ''}${patient.improvementTrend}%`}
              valueClass={
                patient.improvementTrend > 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : patient.improvementTrend < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
              }
              sub={patient.improvementTrend > 0 ? 'กำลังดีขึ้น' : patient.improvementTrend < 0 ? 'ลดลง' : 'คงที่'}
              delay={0.15}
            />
          </motion.div>

          {/* ── 5. Alerts Section ── */}
          <AnimatePresence>
            {patient.alerts.length > 0 && (
              <motion.div
                variants={FADE_UP}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2"
              >
                {patient.alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${AlertStyle({ type: alert.type })}`}
                  >
                    <AlertIcon type={alert.type} />
                    <p className="text-sm">{alert.message}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── AI agent: fault trends & recommendations ── */}
          <motion.div variants={FADE_UP}>
            <AiInsightsPanel key={patient.id} patientId={patient.id} />
          </motion.div>

          {/* ── 6. Category Breakdown ── */}
          {Object.keys(catStats).length > 0 && (
            <motion.div variants={FADE_UP}>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-amber-500" />
                    สถิติตามหมวดหมู่
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {Object.entries(catStats).map(([cat, stats]) => {
                      const avg = Math.round(stats.totalAcc / stats.count);
                      return (
                        <motion.div
                          key={cat}
                          whileHover={{ scale: 1.03 }}
                          className={`p-3 rounded-xl border ${getAccBgColor(avg)} transition-shadow hover:shadow-sm`}
                        >
                          <p className="text-xs text-muted-foreground font-medium">
                            {categoryLabel(cat)}
                          </p>
                          <p className="text-xl font-bold mt-1">
                            {stats.count}
                            <span className="text-xs font-normal text-muted-foreground ml-1">เซสชัน</span>
                          </p>
                          <p className={`text-xs mt-0.5 font-semibold ${getAccuracyTextColor(avg)}`}>
                            เฉลี่ย {avg}%
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── 7 & 8. Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Accuracy Trend Chart */}
            {accuracyTrend.length > 0 && (
              <motion.div variants={FADE_UP}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      แนวโน้มความแม่นยำ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={accuracyTrend}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={ChartTooltipStyle}
                          formatter={(value: number) => [`${value}%`, 'ความแม่นยำ']}
                        />
                        <ReferenceLine
                          y={80}
                          stroke="#10b981"
                          strokeDasharray="4 4"
                          label={{ value: 'เป้า 80%', fontSize: 10, fill: '#10b981', position: 'insideTopRight' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ fill: '#10b981', r: 3 }}
                          activeDot={{ r: 5, fill: '#059669' }}
                          name="ความแม่นยำ"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Joint ROM Trend Chart */}
            {jointData.length > 0 && (
              <motion.div variants={FADE_UP}>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4 text-amber-500" />
                        มุมข้อต่อ (ROM)
                      </CardTitle>
                      {jointNames.length > 1 && (
                        <div className="flex gap-1 flex-wrap">
                          {jointNames.map((j) => (
                            <button
                              key={j}
                              onClick={() => setSelectedJoint(j)}
                              className={`text-xs px-2.5 py-1 rounded-full transition-colors font-medium ${
                                effectiveJoint === j
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                            >
                              {j}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={jointData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}°`}
                        />
                        <Tooltip
                          contentStyle={ChartTooltipStyle}
                          formatter={(value: number, name: string) => [
                            `${value}°`,
                            name === 'angle' ? 'มุมปัจจุบัน' : 'เป้าหมาย',
                          ]}
                        />
                        <ReferenceLine
                          y={idealAngleForJoint}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{
                            value: `เป้า ${idealAngleForJoint}°`,
                            fontSize: 10,
                            fill: '#f59e0b',
                            position: 'insideTopRight',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="angle"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={{ fill: '#f59e0b', r: 2.5 }}
                          activeDot={{ r: 5, fill: '#d97706' }}
                          name="angle"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* ── 9. Session Detail Table ── */}
          <motion.div variants={FADE_UP}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  รายละเอียดเซสชัน
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {sessionDetails.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sessionDetails.length === 0 ? (
                  <div className="text-center py-10">
                    <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลเซสชัน</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[480px]">
                    <div className="space-y-2 pr-3">
                      {sessionDetails.map((s, index) => {
                        const isExpanded = expandedSession === s.id;
                        return (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <button
                              className="w-full flex items-center justify-between p-3 sm:p-4 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-left border border-transparent hover:border-border"
                              onClick={() => setExpandedSession(isExpanded ? null : s.id)}
                              aria-expanded={isExpanded}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{s.exerciseName}</p>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] shrink-0"
                                  >
                                    {categoryLabel(s.exerciseCategory)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {new Date(s.startedAt).toLocaleDateString('th-TH', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 sm:gap-4 ml-3">
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ครั้ง</p>
                                  <p className="text-sm font-bold">{s.totalReps}</p>
                                </div>
                                <div className="text-right hidden sm:block">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ROM</p>
                                  <p className="text-sm font-bold">{s.maxRom}°</p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-bold leading-tight ${getAccuracyTextColor(s.avgAccuracy)}`}>
                                    {s.avgAccuracy}%
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">แม่นยำ</p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 pt-2 space-y-3">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className={`p-3 rounded-lg border text-center ${getAccBgColor(s.avgAccuracy)}`}>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ความแม่นยำ</p>
                                        <p className={`text-xl font-bold mt-0.5 ${getAccuracyTextColor(s.avgAccuracy)}`}>
                                          {s.avgAccuracy}%
                                        </p>
                                      </div>
                                      <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ROM สูงสุด</p>
                                        <p className="text-xl font-bold mt-0.5 text-amber-700 dark:text-amber-300">
                                          {s.maxRom}°
                                        </p>
                                      </div>
                                      <div className="p-3 rounded-lg border bg-muted/50 text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">ข้อมูลมุม</p>
                                        <p className="text-xl font-bold mt-0.5">{s.logCount}</p>
                                      </div>
                                    </div>

                                    {/* Accuracy bar */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>ระดับความแม่นยำ</span>
                                        <span className={`font-semibold ${getAccuracyTextColor(s.avgAccuracy)}`}>
                                          {s.avgAccuracy}%
                                        </span>
                                      </div>
                                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${s.avgAccuracy}%` }}
                                          transition={{ duration: 0.6, ease: 'easeOut' }}
                                          className={`h-full rounded-full ${getAccuracyBarColor(s.avgAccuracy)}`}
                                        />
                                      </div>
                                      <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>0%</span>
                                        <span>50%</span>
                                        <span>100%</span>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {!detailLoading && !data && selectedPatientId && (
        <motion.div variants={FADE_UP}>
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">ไม่พบข้อมูลผู้ป่วย</p>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ─────────── Stat Card Sub-component ─────────── */

function StatCard({
  icon,
  label,
  value,
  valueClass,
  sub,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
    >
      <Card className="h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
          </div>
          <p className={`text-2xl font-bold leading-tight ${valueClass || ''}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ─────────── Skeletons ─────────── */

function PatientsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Selector */}
      <Skeleton className="h-10 w-full sm:w-80" />

      {/* Profile card */}
      <Skeleton className="h-48 rounded-xl" />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      {/* Table */}
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function PatientsDetailSkeleton() {
  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Profile card */}
      <Skeleton className="h-48 rounded-xl" />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>

      {/* Category */}
      <Skeleton className="h-32 rounded-xl" />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>

      {/* Table */}
      <Skeleton className="h-72 rounded-xl" />
    </motion.div>
  );
}