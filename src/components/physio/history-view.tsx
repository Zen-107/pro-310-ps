'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  History,
  Calendar,
  TrendingUp,
  Target,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  BarChart3,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getAccuracyTextColor, getAccuracyBarColor } from '@/lib/angle-utils';

interface SessionRecord {
  id: string;
  exerciseId: string;
  startedAt: string;
  endedAt: string | null;
  totalReps: number;
  avgAccuracy: number;
  maxRom: number;
  status: string;
  notes: string | null;
  exercise?: {
    name: string;
    nameTh: string;
    category: string;
    icon: string;
  };
}

export function HistoryView() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'accuracy'>('date');
  const currentPatientId = useAppStore((s) => s.currentPatientId);

  useEffect(() => {
    let cancelled = false;
    async function fetchSessions() {
      try {
        if (!currentPatientId) return;
        const res = await fetch(`/api/sessions?patientId=${currentPatientId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setSessions(data);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [currentPatientId]);

  const sortedSessions = [...sessions].sort((a, b) => {
    if (sortBy === 'accuracy') return b.avgAccuracy - a.avgAccuracy;
    return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
  });

  // Stats calculations
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
  const avgAccuracy =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, s) => sum + s.avgAccuracy, 0) / completedSessions.length
        )
      : 0;
  const totalReps = completedSessions.reduce((sum, s) => sum + s.totalReps, 0);
  const bestAccuracy =
    completedSessions.length > 0
      ? Math.round(Math.max(...completedSessions.map((s) => s.avgAccuracy)))
      : 0;

  // Accuracy trend data (last 10 sessions)
  const accuracyTrend = completedSessions
    .slice(0, 10)
    .reverse()
    .map((s, i) => ({
      name: `#${i + 1}`,
      accuracy: Math.round(s.avgAccuracy),
      reps: s.totalReps,
    }));

  // Daily activity (last 7 days)
  const dailyActivity: Record<string, number> = {};
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('th-TH', { weekday: 'short' });
    dailyActivity[key] = 0;
  }
  completedSessions.forEach((s) => {
    const d = new Date(s.startedAt);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 6) {
      const key = d.toLocaleDateString('th-TH', { weekday: 'short' });
      if (dailyActivity[key] !== undefined) {
        dailyActivity[key]++;
      }
    }
  });
  const dailyData = Object.entries(dailyActivity).map(([day, count]) => ({ day, count }));

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(start: string, end: string | null) {
    if (!end) return '-';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">ประวัติการฝึก</h2>
          <p className="text-muted-foreground mt-1">ติดตามพัฒนาการและผลการฝึกของคุณ</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortBy(sortBy === 'date' ? 'accuracy' : 'date')}
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          {sortBy === 'date' ? 'ล่าสุด' : 'ความแม่นยำ'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <History className="h-3.5 w-3.5" />
                เซสชันทั้งหมด
              </div>
              <p className="text-2xl font-bold text-emerald-600">{completedSessions.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Target className="h-3.5 w-3.5" />
                ความแม่นยำเฉลี่ย
              </div>
              <p className={`text-2xl font-bold ${getAccuracyTextColor(avgAccuracy)}`}>
                {avgAccuracy}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Activity className="h-3.5 w-3.5" />
                ทั้งหมด
              </div>
              <p className="text-2xl font-bold">{totalReps} ครั้ง</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <TrendingUp className="h-3.5 w-3.5" />
                แม่นยำสูงสุด
              </div>
              <p className={`text-2xl font-bold ${getAccuracyTextColor(bestAccuracy)}`}>
                {bestAccuracy}%
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      {completedSessions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  กิจกรรม 7 วันล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  แนวโน้มความแม่นยำ
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={accuracyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => [`${value}%`, 'ความแม่นยำ']}
                    />
                    <Line
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Session List */}
      <div>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          รายการเซสชัน
          <span className="text-xs text-muted-foreground font-normal">
            ({sessions.length} เซสชัน)
          </span>
        </h3>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-lg">ยังไม่มีประวัติการฝึก</p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              เริ่มฝึกกายภาพบำบัดเพื่อเก็บข้อมูลพัฒนาการ
            </p>
          </motion.div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3">
              <AnimatePresence>
                {sortedSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                      onClick={() =>
                        setExpandedId(expandedId === session.id ? null : session.id)
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {session.exercise?.nameTh || 'ท่ากายภาพบำบัด'}
                              </p>
                              <Badge
                                variant="secondary"
                                className={
                                  session.status === 'COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                }
                              >
                                {session.status === 'COMPLETED' ? 'สำเร็จ' : 'ไม่สำเร็จ'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDateTime(session.startedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(session.startedAt, session.endedAt)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <div className="text-right">
                              <p className={`text-lg font-bold ${getAccuracyTextColor(session.avgAccuracy)}`}>
                                {Math.round(session.avgAccuracy)}%
                              </p>
                              <p className="text-xs text-muted-foreground">ความแม่นยำ</p>
                            </div>
                            {expandedId === session.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedId === session.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <Separator className="my-3" />
                              <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                  <p className="text-sm font-bold">{session.totalReps}</p>
                                  <p className="text-xs text-muted-foreground">ครั้ง</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                  <p className="text-sm font-bold">{Math.round(session.maxRom)}°</p>
                                  <p className="text-xs text-muted-foreground">ROM สูงสุด</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted/50">
                                  <div className="flex items-center justify-center gap-1">
                                    {session.avgAccuracy >= 70 ? (
                                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                                    )}
                                    <p className="text-sm font-bold">
                                      {session.avgAccuracy >= 70 ? 'ดี' : 'ต้องปรับปรุง'}
                                    </p>
                                  </div>
                                  <p className="text-xs text-muted-foreground">ผลรวม</p>
                                </div>
                              </div>
                              {/* Accuracy bar */}
                              <div className="mt-3">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                  <span>ระดับความแม่นยำ</span>
                                  <span>{Math.round(session.avgAccuracy)}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                  <motion.div
                                    className={`h-full rounded-full ${getAccuracyBarColor(session.avgAccuracy)}`}
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${session.avgAccuracy}%`,
                                    }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}