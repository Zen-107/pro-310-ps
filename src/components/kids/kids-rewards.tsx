'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { th } from 'date-fns/locale/th';
import { Award, CheckCircle, Crown, Flame, LayoutGrid, Lock, Medal, Star, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Mascot } from '@/components/kids/mascot';
import { BADGES, isBadgeEarned } from '@/lib/exercises-data';
import { KIDS_STICKERS, starsFor } from '@/lib/kids';
import { useAppStore } from '@/lib/store';

// Sticker book (BADGES) + recent rounds shown as stars. No percentages for kids.

interface Profile {
  streak: number;
  totalSessions: number;
}

interface SessionRecord {
  id: string;
  startedAt: string;
  avgAccuracy: number;
  status: string;
  exercise?: { name: string; nameTh: string };
}

const stickerIcons: Record<string, React.ElementType> = {
  Star, Flame, Trophy, Medal, Award, Crown, CheckCircle, LayoutGrid,
};
const STICKER_COLORS = ['#FFC93C', '#FF7A6B', '#3BA7F5', '#4CC38A', '#9B7BEA'];

export function KidsRewards() {
  const currentPatientId = useAppStore((s) => s.currentPatientId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentPatientId) return;
    let cancelled = false;
    Promise.all([fetch('/api/stats?days=7'), fetch(`/api/sessions?patientId=${currentPatientId}&status=COMPLETED&limit=10`)])
      .then(async ([sRes, hRes]) => {
        const [s, h] = await Promise.all([sRes.ok ? sRes.json() : null, hRes.ok ? hRes.json() : null]);
        if (cancelled) return;
        if (s) setProfile(s.profile ?? null);
        if (Array.isArray(h)) setSessions(h);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentPatientId]);

  const earned = BADGES.filter((b) => isBadgeEarned(b, profile?.streak ?? 0, profile?.totalSessions ?? 0));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold">สมุดสติกเกอร์</h2>
          <span className="rounded-full bg-[var(--kids-grape)] px-3 py-1 text-base font-bold text-white">
            {earned.length}/{BADGES.length}
          </span>
        </div>

        {loading ? (
          <Skeleton className="h-64 rounded-[28px]" />
        ) : (
          <div className="kids-card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {BADGES.map((badge, i) => {
              const got = earned.includes(badge);
              const Icon = stickerIcons[badge.icon] ?? Star;
              const label = KIDS_STICKERS[badge.id] ?? { name: badge.name, hint: badge.description };
              const color = STICKER_COLORS[i % STICKER_COLORS.length];
              return (
                <motion.div
                  key={badge.id}
                  className="flex flex-col items-center gap-2 text-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 18 }}
                  whileHover={got ? { rotate: -6, scale: 1.06 } : undefined}
                >
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
                      got ? 'border-white shadow-[0_4px_0_rgba(59,42,74,0.15)]' : 'border-dashed border-[var(--border)] bg-[var(--muted)]'
                    }`}
                    style={got ? { background: color } : undefined}
                  >
                    {got ? (
                      <Icon className="h-10 w-10 text-white" strokeWidth={2.5} />
                    ) : (
                      <Lock className="h-7 w-7 text-[var(--kids-ink-soft)] opacity-50" />
                    )}
                  </div>
                  <span className={`text-base font-bold leading-tight ${got ? '' : 'text-[var(--kids-ink-soft)]'}`}>
                    {label.name}
                  </span>
                  {!got && <span className="text-sm leading-tight text-[var(--kids-ink-soft)]">{label.hint}</span>}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-bold">รอบที่เล่นล่าสุด</h2>
        {loading ? (
          <Skeleton className="h-40 rounded-[28px]" />
        ) : sessions.length === 0 ? (
          <div className="kids-card flex flex-col items-center gap-2 p-8 text-center">
            <Mascot mood="sleepy" size={96} />
            <p className="text-lg text-[var(--kids-ink-soft)]">ยังไม่มีรอบที่เล่น ไปเล่นรอบแรกกันเลย!</p>
          </div>
        ) : (
          <ul className="kids-card divide-y-2 divide-[var(--border)] overflow-hidden">
            {sessions.map((s) => {
              const stars = starsFor(s.avgAccuracy);
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold">{s.exercise?.nameTh || s.exercise?.name || 'ภารกิจ'}</p>
                    <p className="text-base text-[var(--kids-ink-soft)]">
                      {format(new Date(s.startedAt), 'EEEE d MMM', { locale: th })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5" aria-label={`${stars} ดาว`}>
                    {[1, 2, 3].map((n) => (
                      <Star
                        key={n}
                        className={`h-7 w-7 ${n <= stars ? 'fill-[var(--kids-sun)] text-[var(--kids-sun-deep)]' : 'text-[var(--border)]'}`}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
