'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  Users, Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Clock,
  Stethoscope, Calendar, Target, Flame, BarChart3, ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface PatientData {
  id: string; name: string; streak: number; totalSessions: number; totalMinutes: number;
  totalReps: number; avgAccuracy: number; exercisesCompleted: number;
  recentSessions7d: number; improvementTrend: number; lastActiveAt: string | null;
  alerts: { type: 'warning' | 'info' | 'success'; message: string; date: string }[];
}

interface SessionDetail {
  id: string; exerciseName: string; exerciseCategory: string; startedAt: string;
  endedAt: string | null; totalReps: number; avgAccuracy: number; maxRom: number; logCount: number;
}

export function DoctorOverview({ onViewPatient }: { onViewPatient: () => void }) {
  const [data, setData] = useState<{
    patient: PatientData; sessionDetails: SessionDetail[];
    latestRomPerExercise: { exercise: string; exerciseTh: string; rom: number; accuracy: number; date: string }[];
    jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/patients').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <DoctorOverviewSkeleton />;
  if (!data) return <p className="text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</p>;

  const { patient, sessionDetails, latestRomPerExercise, jointTrends } = data;

  // Prepare joint trend chart data (take last 20 points per joint)
  const chartData: Record<string, { name: string; value: number; ideal: number }[]> = {};
  let chartIndex = 0;
  for (const [joint, points] of Object.entries(jointTrends)) {
    const trimmed = points.slice(-20);
    chartData[joint] = trimmed.map((p, i) => ({
      name: `#${chartIndex + i + 1}`,
      value: Math.round(p.angle),
      ideal: Math.round(p.idealAngle),
    }));
    chartIndex += trimmed.length;
  }

  const alertIcon = (type: string) => {
    if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (type === 'success') return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    return <Info className="h-4 w-4" />;
  };

  const alertBg = (type: string) => {
    if (type === 'warning') return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30';
    if (type === 'success') return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30';
    return 'border-muted bg-muted/50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ภาพรวมผู้ป่วย</h2>
        <p className="text-muted-foreground mt-1">ติดตามความคืบหน้าและสถานะของผู้ป่วย</p>
      </div>

      {/* Patient Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-emerald-500/20 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <Stethoscope className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{patient.name}</h3>
                  <p className="text-sm text-slate-300">รหัส: {patient.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {patient.lastActiveAt
                      ? `กิจกรรมล่าสุด: ${new Date(patient.lastActiveAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'ยังไม่มีกิจกรรม'}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-0">
                {patient.recentSessions7d > 0 ? 'กำลังฝึกอยู่' : 'ไม่มีกิจกรรม'}
              </Badge>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <p className="text-2xl font-bold text-emerald-600">{patient.totalSessions}</p>
                <p className="text-xs text-muted-foreground">เซสชันทั้งหมด</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <p className="text-2xl font-bold">{patient.avgAccuracy}%</p>
                <p className="text-xs text-muted-foreground">ความแม่นยำเฉลี่ย</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <p className="text-2xl font-bold">{patient.streak}</p>
                <p className="text-xs text-muted-foreground">Streak (วัน)</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <p className={`text-2xl font-bold ${patient.improvementTrend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {patient.improvementTrend >= 0 ? '+' : ''}{patient.improvementTrend}%
                </p>
                <p className="text-xs text-muted-foreground">แนวโน้ม</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Activity className="h-4 w-4 text-emerald-600" />} label="ท่าที่ฝึกแล้ว" value={`${patient.exercisesCompleted} ท่า`} delay={0} />
        <StatCard icon={<Target className="h-4 w-4 text-amber-500" />} label="ทั้งหมด (ครั้ง)" value={`${patient.totalReps}`} delay={0.1} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="เวลารวม" value={`${patient.totalMinutes} นาที`} delay={0.2} />
        <StatCard icon={<Flame className="h-4 w-4 text-amber-500" />} label="เซสชัน 7 วัน" value={`${patient.recentSessions7d}`} delay={0.3} />
      </div>

      {/* Alerts */}
      {patient.alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                การแจ้งเตือน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {patient.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${alertBg(alert.type)}`}>
                  {alertIcon(alert.type)}
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Joint Trend Charts */}
      {Object.keys(chartData).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                แนวโน้มมุมข้อต่อ (ROM)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                {Object.entries(chartData).map(([joint, points]) => (
                  <div key={joint}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{joint}</p>
                    <ResponsiveContainer width="100%" height={100}>
                      <LineChart data={points}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                        <ReferenceLine y={points[0]?.ideal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `เป้า ${points[0]?.ideal}°`, fontSize: 10, fill: '#f59e0b' }} />
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Latest Session Performance */}
      {latestRomPerExercise.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                ผลลัพธ์ล่าสุดตามท่า
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={latestRomPerExercise} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="exerciseTh" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                  <Bar dataKey="accuracy" fill="#10b981" radius={[0, 4, 4, 0]} name="ความแม่นยำ (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Sessions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                เซสชันล่าสุด
              </span>
              <button onClick={onViewPatient} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                ดูทั้งหมด <ArrowRight className="h-3 w-3" />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionDetails.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูลเซสชัน</p>
            ) : (
              <div className="space-y-2">
                {sessionDetails.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.exerciseName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="flex items-center gap-4 ml-3">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${s.avgAccuracy >= 80 ? 'text-emerald-600' : s.avgAccuracy >= 60 ? 'text-amber-600' : 'text-red-600'}`}>{s.avgAccuracy}%</p>
                        <p className="text-[10px] text-muted-foreground">{s.totalReps} ครั้ง</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, label, value, delay }: { icon: React.ReactNode; label: string; value: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{icon} {label}</div>
          <p className="text-xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DoctorOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card><CardContent className="p-6"><div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></CardContent></Card>
      <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-12" /></CardContent></Card>)}</div>
      <Card><CardHeader><Skeleton className="h-5 w-40" /></CardHeader><CardContent><Skeleton className="h-48" /></CardContent></Card>
    </div>
  );
}