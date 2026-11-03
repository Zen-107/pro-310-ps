'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Play, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseDemo } from '@/components/physio/exercise-demo';
import { Mascot, MascotSays } from '@/components/kids/mascot';
import { useAppStore } from '@/lib/store';
import { unlockAudio } from '@/lib/speech';
import type { Side } from '@/lib/exercises-data';

// Kids missions: today's exercises as big cards with the animated demo,
// at most three short steps and one start button. No angles or citations here.

interface Target {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
}

interface Exercise {
  id: string;
  slug: string;
  name: string;
  nameTh?: string;
  kidName?: string;
  kidSteps?: string[];
  instructions: string[];
  targetJoints: Target[];
}

interface QuestToday {
  id: string;
  status: string;
  sidesDone: Side[];
  exercise: { id: string; sets: number; repsPerSet: number; targetJoints: Target[]; unilateral?: boolean; bodyPart?: string };
}

const CARD_TINTS = ['#e3f2fd', '#fff4d6', '#e8f8ef', '#f1ebff'];

export function KidsMissions() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setPendingQuestStart = useAppStore((s) => s.setPendingQuestStart);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [quests, setQuests] = useState<QuestToday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch('/api/exercises'), fetch('/api/quests/today')])
      .then(async ([exRes, qRes]) => {
        if (!exRes.ok || !qRes.ok) throw new Error();
        const [ex, q] = await Promise.all([exRes.json(), qRes.json()]);
        if (cancelled) return;
        setExercises(Array.isArray(ex) ? ex : []);
        setQuests(Array.isArray(q?.quests) ? q.quests : []);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function start(questId: string, side?: Side) {
    unlockAudio(); // inside the click: lets the coach speak once the session starts
    setPendingQuestStart({ questId, side });
    setActiveTab('camera');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-full" />
        <Skeleton className="h-96 rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MascotSays mood="stretch">ดูน้องยืดทำก่อน แล้วทำตามนะ!</MascotSays>

      {error && (
        <div className="kids-card flex items-center gap-3 p-5">
          <Mascot mood="think" size={64} />
          <p className="text-lg">โหลดไม่สำเร็จ ลองกดเข้ามาใหม่อีกทีนะ</p>
        </div>
      )}

      {!error && exercises.length === 0 && (
        <div className="kids-card flex flex-col items-center gap-2 p-8 text-center">
          <Mascot mood="sleepy" size={96} />
          <p className="text-lg text-[var(--kids-ink-soft)]">ยังไม่มีภารกิจ รอคุณครูหรือผู้ปกครองเพิ่มให้นะ</p>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {exercises.map((ex, idx) => {
          const quest = quests.find((q) => q.exercise.id === ex.id);
          const targets = quest?.exercise.targetJoints ?? ex.targetJoints;
          const primary = targets.find((t) => t.isPrimary) ?? targets[0];
          const done = quest?.status === 'COMPLETED';
          return (
            <motion.article
              key={ex.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="kids-card overflow-hidden"
            >
              <div className="p-4" style={{ background: CARD_TINTS[idx % CARD_TINTS.length] }}>
                <div className="rounded-[20px] bg-white/80 p-2">
                  <ExerciseDemo slug={ex.slug} target={primary} compact />
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-2xl font-bold leading-tight">{ex.kidName || ex.nameTh || ex.name}</h3>
                  {done && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--kids-grass)] px-3 py-1 text-base font-bold text-white">
                      <Check className="h-4 w-4" strokeWidth={3} /> เสร็จแล้ว
                    </span>
                  )}
                </div>

                <ol className="space-y-2">
                  {(ex.kidSteps ?? ex.instructions.slice(0, 3)).map((step, i) => (
                    <li key={i} className="flex gap-3 text-lg leading-snug">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--kids-sun)] font-bold">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                {!quest ? (
                  <p className="rounded-[20px] border-2 border-dashed border-[var(--border)] p-3 text-center text-[var(--kids-ink-soft)]">
                    ท่านี้ไม่มีในภารกิจวันนี้
                  </p>
                ) : quest.exercise.unilateral ? (
                  // One side at a time: each side is its own session
                  <div className="grid grid-cols-2 gap-3">
                    {(['left', 'right'] as const).map((side) => {
                      const sideDone = quest.sidesDone?.includes(side);
                      const limb = quest.exercise.bodyPart === 'upper' ? 'แขน' : 'ขา';
                      return (
                        <button
                          key={side}
                          className={`kids-btn ${sideDone ? 'kids-btn-grass' : 'kids-btn-sky'} px-3 text-lg`}
                          onClick={() => start(quest.id, side)}
                        >
                          {sideDone ? <Check className="h-5 w-5" strokeWidth={3} /> : <Play className="h-5 w-5 fill-current" />}
                          {limb}{side === 'left' ? 'ซ้าย' : 'ขวา'}
                        </button>
                      );
                    })}
                  </div>
                ) : done ? (
                  <button className="kids-btn kids-btn-sun w-full" onClick={() => start(quest.id)}>
                    <RotateCcw className="h-5 w-5" /> เล่นอีกรอบ
                  </button>
                ) : (
                  <button className="kids-btn w-full" onClick={() => start(quest.id)}>
                    <Play className="h-6 w-6 fill-current" /> เริ่มเลย! ({quest.exercise.sets} × {quest.exercise.repsPerSet})
                  </button>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}
