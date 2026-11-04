'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { format, subDays } from 'date-fns';
import { Check, Flame, Play, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayfulMascot } from '@/components/kids/playful-mascot';
import { useAppStore } from '@/lib/store';
import { unlockAudio } from '@/lib/speech';
import { kidsGreeting, nickname } from '@/lib/kids';

// Kids home: mascot greeting, 7-day fire row, today's missions, one big play button.

interface Quest {
  id: string;
  status: string;
  exercise: { name: string; nameTh?: string; kidName?: string; sets: number; repsPerSet: number; unilateral?: boolean };
}

interface Profile {
  name: string;
  nickname: string | null;
  avatar: string | null;
  streak: number;
}

const DAY_LETTERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function KidsHome({ onPlay }: { onPlay: () => void }) {
  const currentPatientId = useAppStore((s) => s.currentPatientId);
  const setSelectedQuestId = useAppStore((s) => s.setSelectedQuestId);
  const setPendingQuestStart = useAppStore((s) => s.setPendingQuestStart);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    if (!currentPatientId) return;
    let cancelled = false;
    Promise.all([fetch('/api/stats?days=7'), fetch('/api/quests/today')])
      .then(async ([sRes, qRes]) => {
        const [s, q] = await Promise.all([sRes.ok ? sRes.json() : null, qRes.ok ? qRes.json() : null]);
        if (cancelled) return;
        if (s) {
          setProfile(s.profile ?? null);
          const days = (s.dailyData ?? []) as Array<{ date: string; sessions: number }>;
          setActiveDays(new Set(days.filter((d) => d.sessions > 0).map((d) => d.date)));
        }
        if (q) setQuests(Array.isArray(q.quests) ? q.quests : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [currentPatientId]);

  const done = quests.filter((q) => q.status === 'COMPLETED').length;
  const allDone = quests.length > 0 && done === quests.length;
  const next = quests.find((q) => q.status !== 'COMPLETED');

  // Straight into the session; one-side-at-a-time exercises let the camera tab ask which side
  function play(q: Quest) {
    unlockAudio();
    if (q.exercise.unilateral) setSelectedQuestId(q.id);
    else setPendingQuestStart({ questId: q.id });
    onPlay();
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    return { key: format(d, 'yyyy-MM-dd'), label: i === 6 ? 'วันนี้' : DAY_LETTERS[d.getDay()] };
  });

  const name = profile?.nickname || nickname(profile?.name);
  const bubble = loading
    ? 'รอแป๊บนึงนะ...'
    : quests.length === 0
      ? `${kidsGreeting()} ${name}! วันนี้พักผ่อนได้เลย`
      : allDone
        ? `เก่งมาก ${name}! ภารกิจวันนี้ครบแล้ว`
        : `${kidsGreeting()} ${name}! มายืดตัวกัน`;

  return (
    <div className="space-y-6">
      {/* The child's own น้องยืด (dressed in the wardrobe tab); tap it for a reaction */}
      <div className="flex items-end gap-3">
        <PlayfulMascot
          avatar={profile?.avatar}
          size={124}
          bubbleSide="none"
          onReact={setSaid}
          mood={loading ? 'think' : quests.length === 0 ? 'sleepy' : allDone ? 'cheer' : 'wave'}
          className="shrink-0"
        />
        <div className="relative mb-6 rounded-[24px] border-2 border-[var(--border)] bg-white px-4 py-3 text-lg font-bold leading-snug shadow-[0_4px_0_rgba(59,42,74,0.08)]">
          <span aria-hidden className="absolute -left-2.5 bottom-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-[var(--border)] bg-white" />
          {said ?? bubble}
        </div>
      </div>

      {/* Fire streak */}
      <section className="kids-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-7 w-7 fill-[var(--kids-sun)] text-[var(--kids-coral)]" />
          <h2 className="text-xl font-bold">
            ไฟติดกัน {profile?.streak ?? 0} วัน
          </h2>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {week.map((d) => {
            const lit = activeDays.has(d.key);
            return (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                    lit ? 'border-[var(--kids-sun-deep)] bg-[var(--kids-sun)]' : 'border-dashed border-[var(--border)] bg-[var(--muted)]'
                  }`}
                >
                  {lit && <Flame className="h-5 w-5 text-[var(--kids-coral-deep)]" />}
                </div>
                <span className="text-sm text-[var(--kids-ink-soft)]">{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Today's missions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">ภารกิจวันนี้</h2>
          {quests.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--kids-sun)] px-3 py-1 text-base font-bold">
              <Star className="h-4 w-4 fill-current" /> {done}/{quests.length}
            </span>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-24 w-full rounded-[28px]" />
        ) : quests.length === 0 ? (
          <div className="kids-card p-6 text-center text-lg text-[var(--kids-ink-soft)]">
            วันนี้ยังไม่มีภารกิจ ไปวิ่งเล่นได้เลย!
          </div>
        ) : (
          <ul className="space-y-3">
            {quests.map((q, i) => {
              const complete = q.status === 'COMPLETED';
              return (
                <motion.li
                  key={q.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <button
                    onClick={() => play(q)}
                    className={`kids-card flex w-full items-center gap-4 p-4 text-left transition-transform active:scale-[0.98] ${
                      complete ? 'border-[var(--kids-grass)] bg-[#effaf4]' : ''
                    }`}
                  >
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white ${
                        complete ? 'bg-[var(--kids-grass)]' : 'bg-[var(--kids-sky)]'
                      }`}
                    >
                      {complete ? <Check className="h-8 w-8" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xl font-bold">{q.exercise.kidName || q.exercise.nameTh || q.exercise.name}</span>
                      <span className="block text-base text-[var(--kids-ink-soft)]">
                        {complete ? 'เสร็จแล้ว เก่งมาก!' : `${q.exercise.sets} รอบ รอบละ ${q.exercise.repsPerSet} ครั้ง`}
                      </span>
                    </span>
                    {!complete && <Play className="h-8 w-8 shrink-0 fill-[var(--kids-coral)] text-[var(--kids-coral)]" />}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {next && (
        <div className="flex justify-center pt-2">
          <button className="kids-btn w-full max-w-sm text-2xl" onClick={() => play(next)}>
            <Play className="h-7 w-7 fill-current" /> เล่นเลย!
          </button>
        </div>
      )}
    </div>
  );
}
