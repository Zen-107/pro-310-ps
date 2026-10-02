'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, ExternalLink, Play, RotateCcw, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/lib/exercises-data';
import { useAppStore } from '@/lib/store';
import { ExerciseDemo } from '@/components/physio/exercise-demo';

// Patient's prescribed exercises: demo, steps, targets and sources.
// There is no free practice — sessions start from today's quests only.

interface Target {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
  overridden?: boolean;
}

interface Reference {
  title: string;
  url: string;
  institution: string;
  relevance: string;
  verifiedByName: string | null;
}

interface Exercise {
  id: string;
  slug: string;
  name: string;
  description: string;
  difficulty: string;
  instructions: string[];
  targetJoints: Target[];
  references: Reference[];
}

interface QuestToday {
  id: string;
  status: string;
  exercise: { id: string; sets: number; repsPerSet: number; targetJoints: Target[] };
}

export function ExercisesView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const setSelectedQuestId = useAppStore((s) => s.setSelectedQuestId);
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

  function startQuest(questId: string) {
    setSelectedQuestId(questId);
    setActiveTab('camera');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ท่ากายภาพของฉัน</h2>
        <p className="text-muted-foreground mt-1">
          ท่าที่ผู้ดูแลกำหนดให้คุณ — ดูท่าตัวอย่างและขั้นตอนก่อนเริ่มภารกิจวันนี้
        </p>
      </div>

      {error && <p className="text-sm text-red-600">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>}

      {!error && exercises.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            ยังไม่มีท่าที่ได้รับมอบหมาย — ผู้ดูแลของคุณจะเพิ่มแผนการรักษาให้
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {exercises.map((ex, idx) => {
          const quest = quests.find((q) => q.exercise.id === ex.id);
          // Today's quest carries the clinician's overrides; otherwise show defaults
          const targets = quest?.exercise.targetJoints ?? ex.targetJoints;
          const primary = targets.find((t) => t.isPrimary) ?? targets[0];
          return (
            <motion.div key={ex.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{ex.name}</CardTitle>
                    <Badge variant="secondary" className={DIFFICULTY_COLORS[ex.difficulty] || ''}>
                      {DIFFICULTY_LABELS[ex.difficulty] || ex.difficulty}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{ex.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ExerciseDemo slug={ex.slug} target={primary} />

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                      <BookOpen className="h-4 w-4 text-teal-600" /> ขั้นตอน
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                      {ex.instructions.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                      <Target className="h-4 w-4 text-teal-600" /> มุมเป้าหมาย
                    </p>
                    <div className="space-y-1">
                      {targets.map((t) => (
                        <div key={t.name} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t.nameTh}
                            {t.overridden && <span className="ml-1 text-xs text-amber-600">(ปรับโดยผู้ดูแล)</span>}
                          </span>
                          <span className="tabular-nums">
                            {t.minAngle}°–{t.maxAngle}°
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {ex.references.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="mb-1 font-medium text-foreground">แหล่งอ้างอิง</p>
                      {ex.references.map((r) => (
                        <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {r.institution} — {r.title}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {quest ? (
                    quest.status === 'COMPLETED' ? (
                      <div className="flex items-center justify-between rounded-lg bg-teal-50 p-3 text-sm text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4" /> ภารกิจวันนี้สำเร็จแล้ว
                        </span>
                        <Button size="sm" variant="outline" onClick={() => startQuest(quest.id)}>
                          <RotateCcw className="h-3.5 w-3.5" /> ฝึกซ้ำ
                        </Button>
                      </div>
                    ) : (
                      <Button className="w-full bg-teal-600 hover:bg-teal-700" onClick={() => startQuest(quest.id)}>
                        <Play className="h-4 w-4" /> เริ่มภารกิจวันนี้ ({quest.exercise.sets} × {quest.exercise.repsPerSet})
                      </Button>
                    )
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                      ไม่มีภารกิจของท่านี้ในวันนี้
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
