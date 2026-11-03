'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseDemo } from '@/components/physio/exercise-demo';
import { DIFFICULTY_LABELS } from '@/lib/exercises-data';
import { useKidLibrary } from '@/components/teacher/assign-form';

// The expert-curated library a teacher picks missions from: what the kids
// see (name, steps, demo) next to the exercise's proper name and purpose.
export function ExerciseLibrary() {
  const library = useKidLibrary();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">คลังท่า</h2>
        <p className="text-sm text-muted-foreground">
          ท่าที่ผู้เชี่ยวชาญตรวจแล้ว เลือกท่าเหล่านี้ได้ตอนให้ภารกิจในห้องเรียน (ชื่อและขั้นตอนสีเขียวคือสิ่งที่เด็กเห็น)
        </p>
      </div>
      {library === null ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {library.map((ex) => {
            const primary = ex.targetJoints.find((t) => t.isPrimary) ?? ex.targetJoints[0];
            return (
              <article key={ex.id} className="overflow-hidden rounded-2xl border bg-card">
                <div className="bg-[#f2f9ff] p-3">
                  <ExerciseDemo slug={ex.slug} target={primary} compact />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-bold">{ex.kidName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {ex.nameTh} · {DIFFICULTY_LABELS[ex.difficulty] ?? ex.difficulty}
                        {ex.unilateral ? ' · ทีละข้าง' : ''}
                      </p>
                    </div>
                  </div>
                  <ol className="space-y-1 rounded-xl bg-[#e8f8ef] p-3 text-sm">
                    {ex.kidSteps.map((s, i) => (
                      <li key={i}>
                        {i + 1}. {s}
                      </li>
                    ))}
                  </ol>
                  <p className="text-sm text-muted-foreground">{ex.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
