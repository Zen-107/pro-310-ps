'use client';

import { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { th } from 'date-fns/locale/th';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Clock, Flame, Star, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { starsFor } from '@/lib/kids';

// A child's progress for adults (teacher, parent): tiles, the last 14 days
// and recent rounds with stars *and* accuracy (adults see the numbers).

interface Stats {
  profile: { streak: number; totalSessions: number; totalMinutes: number; lastActiveAt: string | null } | null;
  dailyData: { date: string; sessions: number; accuracy: number }[];
  avgAccuracy: number;
}

interface SessionRow {
  id: string;
  startedAt: string;
  avgAccuracy: number;
  totalReps: number;
  faultCount: number | null;
  exercise?: { nameTh: string; kidName?: string };
}

const SKY = '#3BA7F5';

export function ChildProgress({ patientId, onOpenSession }: { patientId: string; onOpenSession?: (sessionId: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/stats?patientId=${patientId}&days=30`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/sessions?patientId=${patientId}&status=COMPLETED&limit=15`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([s, list]) => {
        if (cancelled) return;
        setStats(s);
        setSessions(Array.isArray(list) ? list : []);
      })
      .catch(() => !cancelled && setSessions([]));
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (!stats || !sessions) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    const key = format(d, 'yyyy-MM-dd');
    const found = stats.dailyData.find((x) => x.date === key);
    return { label: format(d, 'd/M'), sessions: found?.sessions ?? 0 };
  });

  const tiles = [
    { icon: Flame, label: 'เล่นติดกัน', value: `${stats.profile?.streak ?? 0} วัน`, color: 'text-[var(--kids-coral)]' },
    { icon: Activity, label: 'เล่นทั้งหมด', value: `${stats.profile?.totalSessions ?? 0} รอบ`, color: 'text-[var(--kids-sky-deep)]' },
    { icon: Target, label: 'ความถูกต้อง 30 วัน', value: stats.avgAccuracy ? `${Math.round(stats.avgAccuracy)}%` : '—', color: 'text-[var(--kids-grass-deep)]' },
    { icon: Clock, label: 'เวลารวม', value: `${stats.profile?.totalMinutes ?? 0} นาที`, color: 'text-[var(--kids-grape)]' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card p-3">
            <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>
              <t.icon className={`h-4 w-4 ${t.color}`} /> {t.label}
            </div>
            <p className="mt-1 text-xl font-bold">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm font-semibold">จำนวนรอบที่เล่น 14 วันล่าสุด</p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={days} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#eadcc6" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b5a78' }} axisLine={false} tickLine={false} interval={1} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b5a78' }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v} รอบ`, 'เล่น']} />
              <Bar dataKey="sessions" fill={SKY} radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">รอบล่าสุด</p>
        {sessions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">ยังไม่มีรอบที่เล่นเสร็จ</p>
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => {
              const stars = starsFor(s.avgAccuracy);
              const row = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.exercise?.kidName ?? s.exercise?.nameTh ?? 'ภารกิจ'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.startedAt), 'EEE d MMM HH:mm', { locale: th })} · {s.totalReps} ครั้ง
                      {s.faultCount ? ` · ท่าคลาด ${s.faultCount}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="flex" aria-label={`${stars} ดาว`}>
                      {[1, 2, 3].map((n) => (
                        <Star key={n} className={`h-4 w-4 ${n <= stars ? 'fill-[var(--kids-sun)] text-[var(--kids-sun-deep)]' : 'text-[var(--border)]'}`} />
                      ))}
                    </span>
                    <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">{s.avgAccuracy}%</span>
                  </div>
                </>
              );
              return (
                <li key={s.id}>
                  {onOpenSession ? (
                    <button onClick={() => onOpenSession(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                      {row}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
