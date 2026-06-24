'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  ArrowLeft, Stethoscope, Activity, Target, Clock, Calendar, TrendingUp, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Flame, BarChart3,
} from 'lucide-react';

interface SessionLog {
  id: string; exerciseName: string; exerciseCategory: string; startedAt: string;
  endedAt: string | null; totalReps: number; avgAccuracy: number; maxRom: number; logCount: number;
}

interface PatientInfo {
  id: string; name: string; streak: number; totalSessions: number; totalMinutes: number;
  totalReps: number; avgAccuracy: number; exercisesCompleted: number;
  recentSessions7d: number; improvementTrend: number; lastActiveAt: string | null;
}

interface FullData {
  patient: PatientInfo;
  sessionDetails: SessionLog[];
  latestRomPerExercise: { exercise: string; exerciseTh: string; rom: number; accuracy: number; date: string }[];
  jointTrends: Record<string, { date: string; angle: number; idealAngle: number }[]>;
}

export function DoctorPatients() {
  const [data, setData] = useState<FullData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/patients').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <PatientsSkeleton />;
  if (!data) return <p className="text-muted-foreground">ไม่สามารถโหลดข้อมูลได้</p>;

  const { patient, sessionDetails, jointTrends } = data;

  // Accuracy trend
  const accuracyTrend = sessionDetails.slice(0, 15).reverse().map((s, i) => ({
    name: `#${i + 1}`, accuracy: s.avgAccuracy, rom: s.maxRom,
  }));

  // Joint trend for selected joint
  const jointNames = Object.keys(jointTrends);
  const [selectedJoint, setSelectedJoint] = useState<string>(jointNames[0] || '');
  const jointData = jointTrends[selectedJoint]?.slice(-20).map((p, i) => ({
    name: `#${i + 1}`, angle: Math.round(p.angle), ideal: Math.round(p.idealAngle),
  })) || [];

  // Category stats
  const catStats: Record<string, { count: number; totalAcc: number }> = {};
  sessionDetails.forEach(s => {
    if (!catStats[s.exerciseCategory]) catStats[s.exerciseCategory] = { count: 0, totalAcc: 0 };
    catStats[s.exerciseCategory].count++;
    catStats[s.exerciseCategory].totalAcc += s.avgAccuracy;
  });

  const categoryNames: Record<string, string> = { knee: 'เข่า', shoulder: 'ไหล่', hip: 'สะโพก', back: 'หลัง', neck: 'คอ', ankle: 'ข้อเท้า' };

  function getAccColor(acc: number) {
    if (acc >= 80) return 'text-emerald-600';
    if (acc >= 60) return 'text-amber-600';
    return 'text-red-600';
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ข้อมูลผู้ป่วย</h2>
        <p className="text-muted-foreground mt-1">ดูข้อมูลเชิงลึกและกราฟพัฒนาการ</p>
      </div>

      {/* Patient Profile Bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Stethoscope className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{patient.name}</h3>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> เซสชัน: {patient.totalSessions}</span>
                  <span className="flex items-center gap-1"><Flame className="h-3 w-3" /> Streak: {patient.streak} วัน</span>
                  <span className="flex items-center gap-1"><Target className="h-3 w-3" /> เฉลี่ย: <span className={getAccColor(patient.avgAccuracy)}>{patient.avgAccuracy}%</span></span>
                  <span className="flex items-center gap-1"><TrendingUp className={`h-3 w-3 ${patient.improvementTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                    {patient.improvementTrend >= 0 ? '+' : ''}{patient.improvementTrend}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Breakdown */}
      {Object.keys(catStats).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4 text-amber-500" /> สถิติตามหมวดหมู่</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(catStats).map(([cat, stats]) => (
                  <div key={cat} className="p-3 rounded-xl bg-muted/50">
                    <p className="text-xs text-muted-foreground">{categoryNames[cat] || cat}</p>
                    <p className="text-lg font-bold">{stats.count} <span className="text-sm font-normal text-muted-foreground">เซสชัน</span></p>
                    <p className={`text-xs ${getAccColor(Math.round(stats.totalAcc / stats.count))}`}>เฉลี่ย {Math.round(stats.totalAcc / stats.count)}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Accuracy + ROM Trend */}
      {accuracyTrend.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-600" /> แนวโน้มความแม่นยำ</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={accuracyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                    <ReferenceLine y={80} stroke="#10b981" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} name="ความแม่นยำ" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-amber-500" /> มุมข้อต่อ (ROM)</CardTitle>
                  {jointNames.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {jointNames.map(j => (
                        <button key={j} onClick={() => setSelectedJoint(j)} className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${selectedJoint === j ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{j}</button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={jointData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px' }} />
                    <ReferenceLine y={jointData[0]?.ideal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `เป้า ${jointData[0]?.ideal}°`, fontSize: 10, fill: '#f59e0b' }} />
                    <Line type="monotone" dataKey="angle" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 2 }} name="มุมปัจจุบัน" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Session Detail Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> รายละเอียดเซสชัน ({sessionDetails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionDetails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีข้อมูลเซสชัน</p>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {sessionDetails.map((s) => (
                  <div key={s.id}>
                    <button
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                      onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{s.exerciseName}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{categoryNames[s.exerciseCategory] || s.exerciseCategory}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(s.startedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-3">
                        <div className="text-right hidden sm:block"><p className="text-xs text-muted-foreground">ครั้ง</p><p className="text-sm font-bold">{s.totalReps}</p></div>
                        <div className="text-right hidden sm:block"><p className="text-xs text-muted-foreground">ROM</p><p className="text-sm font-bold">{s.maxRom}°</p></div>
                        <div className="text-right"><p className={`text-lg font-bold ${getAccColor(s.avgAccuracy)}`}>{s.avgAccuracy}%</p><p className="text-[10px] text-muted-foreground">แม่นยำ</p></div>
                        {expandedSession === s.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {expandedSession === s.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pl-4 pr-2 pb-2">
                        <div className="flex gap-3 mt-1">
                          <div className="flex-1 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                            <p className="text-xs text-muted-foreground">ความแม่นยำ</p><p className={`text-lg font-bold ${getAccColor(s.avgAccuracy)}`}>{s.avgAccuracy}%</p>
                          </div>
                          <div className="flex-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-center">
                            <p className="text-xs text-muted-foreground">ROM สูงสุด</p><p className="text-lg font-bold">{s.maxRom}°</p>
                          </div>
                          <div className="flex-1 p-2 rounded-lg bg-muted text-center">
                            <p className="text-xs text-muted-foreground">ข้อมูลมุม</p><p className="text-lg font-bold">{s.logCount}</p>
                          </div>
                        </div>
                        {/* Accuracy bar */}
                        <div className="mt-2">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${s.avgAccuracy >= 80 ? 'bg-emerald-500' : s.avgAccuracy >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${s.avgAccuracy}%` }} />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </motion.div>
    </div>
  );
}

function PatientsSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-16 rounded-xl" /><div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}</div><Skeleton className="h-64 rounded-xl" /></div>;
}