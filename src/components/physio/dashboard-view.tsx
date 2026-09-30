'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { format, subDays, isToday, isYesterday } from 'date-fns';
import { th } from 'date-fns/locale/th';
import {
  Activity,
  Flame,
  Clock,
  Target,
  Award,
  Star,
  Trophy,
  Medal,
  Crown,
  CheckCircle,
  LayoutGrid,
  TrendingUp,
  Calendar,
  Lock,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BADGES } from '@/lib/exercises-data';
import { useAppStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileData {
  id: string;
  name: string;
  streak: number;
  totalSessions: number;
  totalMinutes: number;
  lastActiveAt: string | null;
}

interface DailyDataPoint {
  date: string;
  sessions: number;
  accuracy: number;
  reps: number;
  minutes: number;
}

interface StatsData {
  dailyData: DailyDataPoint[];
  totalSessions: number;
  avgAccuracy: number;
  totalReps: number;
  categoryData: Record<string, number>;
  romData: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Badge icon mapping (string name → Lucide component)
// ---------------------------------------------------------------------------

const badgeIconMap: Record<string, React.ElementType> = {
  Star,
  Flame,
  Trophy,
  Medal,
  Award,
  Crown,
  CheckCircle,
  LayoutGrid,
};

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    // `as const` makes the literal 'spring' survive type inference so
    // framer-motion's AnimationGeneratorType check passes under strict mode.
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

// ---------------------------------------------------------------------------
// Thai day helpers
// ---------------------------------------------------------------------------

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function getThaiDayLabel(date: Date): string {
  const today = new Date();
  if (isToday(date)) return 'วันนี้';
  if (isYesterday(date)) return 'เมื่อวาน';
  return THAI_DAYS[date.getDay()];
}

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'วันนี้';
  if (isYesterday(d)) return 'เมื่อวาน';
  return format(d, 'EEE ที่ d MMM', { locale: th });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'สวัสดีตอนเช้า';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

// ---------------------------------------------------------------------------
// Custom tooltip for charts
// ---------------------------------------------------------------------------

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-52 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function BadgesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Determine if a badge is earned
// ---------------------------------------------------------------------------

function isBadgeEarned(
  badge: (typeof BADGES)[number],
  streak: number,
  totalSessions: number
): boolean {
  switch (badge.id) {
    case 'first_session':
      return totalSessions >= 1;
    case 'streak_3':
    case 'streak_7':
    case 'streak_30':
      return streak >= badge.requirement;
    case 'sessions_10':
    case 'sessions_50':
      return totalSessions >= badge.requirement;
    case 'perfect_score':
    case 'all_categories':
      // These require more complex logic; default to locked for now
      return false;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardView({ onStartSession }: { onStartSession: () => void }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const currentPatientId = useAppStore((s) => s.currentPatientId);

  const fetchData = useCallback(async () => {
    if (!currentPatientId) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, statsRes] = await Promise.all([
        fetch(`/api/profile?patientId=${currentPatientId}`),
        fetch(`/api/stats?days=30&patientId=${currentPatientId}`),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch {
      // Silently handle — skeletons will remain shown
    } finally {
      setLoading(false);
    }
  }, [currentPatientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Last 7 days for weekly chart
  const weeklyData = (() => {
    const days: Array<{ dayLabel: string; sessions: number; accuracy: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const found = stats?.dailyData?.find((d) => d.date === dateStr);
      days.push({
        dayLabel: getThaiDayLabel(date),
        sessions: found?.sessions ?? 0,
        accuracy: found?.accuracy ?? 0,
      });
    }
    return days;
  })();

  // Accuracy trend data (last 14 days or whatever is available)
  const accuracyData = (() => {
    if (!stats?.dailyData?.length) return [];
    // Take the most recent 14 days with data
    const sorted = [...stats.dailyData].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const recent = sorted.slice(-14);
    return recent.map((d) => ({
      dateLabel: formatRelativeDate(d.date),
      accuracy: Math.round(d.accuracy * 10) / 10,
    }));
  })();

  const earnedCount = BADGES.filter((b) =>
    isBadgeEarned(b, profile?.streak ?? 0, profile?.totalSessions ?? 0)
  ).length;

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Welcome Section ── */}
      <motion.div variants={itemVariants}>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-background">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                {getGreeting()} 🎉
              </p>
              <h1 className="text-2xl font-bold text-foreground mt-1">
                {profile?.name ?? '...'} ยินดีต้อนรับ
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {profile?.lastActiveAt
                  ? `ใช้งานล่าสุด: ${format(new Date(profile.lastActiveAt), 'd MMMM yyyy', { locale: th })}`
                  : 'เริ่มต้นการฝึกกายภาพบำบัดของคุณวันนี้'}
              </p>
            </div>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 text-base px-6"
              onClick={onStartSession}
            >
              <Play className="size-5" />
              เริ่มฝึกกายภาพ
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Stats Cards ── */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <StatsSkeleton />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sessions */}
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Activity className="size-5" />
                  <span className="text-xs font-medium text-muted-foreground">เซสชันทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {stats?.totalSessions ?? profile?.totalSessions ?? 0}
                </p>
              </CardContent>
            </Card>

            {/* Current Streak */}
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <Flame className="size-5" />
                  <span className="text-xs font-medium text-muted-foreground">Streak ติดต่อกัน</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {profile?.streak ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">วัน</span>
                </p>
              </CardContent>
            </Card>

            {/* Total Minutes */}
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Clock className="size-5" />
                  <span className="text-xs font-medium text-muted-foreground">เวลาฝึกทั้งหมด</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {profile?.totalMinutes ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">นาที</span>
                </p>
              </CardContent>
            </Card>

            {/* Average Accuracy */}
            <Card className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-500">
                  <Target className="size-5" />
                  <span className="text-xs font-medium text-muted-foreground">ความแม่นยำเฉลี่ย</span>
                </div>
                <p className="text-2xl font-bold mt-2">
                  {stats?.avgAccuracy != null
                    ? `${Math.round(stats.avgAccuracy)}%`
                    : '--'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Activity Bar Chart */}
        <motion.div variants={itemVariants}>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="size-5 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-base">กิจกรรมรายสัปดาห์</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="dayLabel"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="sessions"
                        name="เซสชัน"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Accuracy Trend Line Chart */}
        <motion.div variants={itemVariants}>
          {loading ? (
            <ChartSkeleton />
          ) : (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-5 text-amber-500" />
                  <CardTitle className="text-base">แนวโน้มความแม่นยำ</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {accuracyData.length > 0 ? (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={accuracyData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="dateLabel"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v}%`}
                        />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          name="ความแม่นยำ (%)"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={{ fill: '#f59e0b', r: 3 }}
                          activeDot={{ r: 5, fill: '#f59e0b' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                    ยังไม่มีข้อมูลความแม่นยำ
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* ── Badges Section ── */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <BadgesSkeleton />
        ) : (
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-amber-500" />
                <CardTitle className="text-base">เหรียญรางวัล</CardTitle>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {earnedCount}/{BADGES.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {BADGES.map((badge) => {
                  const earned = isBadgeEarned(
                    badge,
                    profile?.streak ?? 0,
                    profile?.totalSessions ?? 0
                  );
                  const IconComponent = badgeIconMap[badge.icon] ?? Star;

                  return (
                    <motion.div
                      key={badge.id}
                      className="flex flex-col items-center gap-1.5"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        className={`
                          relative flex items-center justify-center w-12 h-12 rounded-full
                          transition-colors
                          ${
                            earned
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground/40'
                          }
                        `}
                        title={badge.description}
                      >
                        {earned ? (
                          <IconComponent className="size-5" />
                        ) : (
                          <Lock className="size-4" />
                        )}
                      </div>
                      <span
                        className={`text-[11px] leading-tight text-center ${
                          earned ? 'text-foreground font-medium' : 'text-muted-foreground'
                        }`}
                      >
                        {badge.name}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}