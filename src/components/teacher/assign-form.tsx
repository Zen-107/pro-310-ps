'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseDemo } from '@/components/physio/exercise-demo';

// Build a mission set from the expert's library and give it to the whole class.

export interface LibraryExercise {
  id: string;
  slug: string;
  nameTh: string;
  kidName: string;
  kidSteps: string[];
  forKids: boolean;
  difficulty: string;
  sets: number;
  repsPerSet: number;
  unilateral?: boolean;
  description: string;
  targetJoints: { name: string; nameTh: string; idealAngle: number; minAngle: number; maxAngle: number; isPrimary?: boolean }[];
}

export const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function useKidLibrary() {
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null);
  useEffect(() => {
    fetch('/api/exercises')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: LibraryExercise[]) => setLibrary(Array.isArray(d) ? d.filter((e) => e.forKids) : []))
      .catch(() => setLibrary([]));
  }, []);
  return library;
}

interface Pick {
  sets: number;
  repsPerSet: number;
}

export function AssignForm({ classroomId, onDone }: { classroomId: string; onDone: () => void }) {
  const library = useKidLibrary();
  const [title, setTitle] = useState('');
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  const toggle = (ex: LibraryExercise) =>
    setPicks((p) => {
      const next = { ...p };
      if (next[ex.id]) delete next[ex.id];
      else next[ex.id] = { sets: Math.min(ex.sets, 2), repsPerSet: Math.min(ex.repsPerSet, 8) };
      return next;
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ids = Object.keys(picks);
    if (ids.length === 0) {
      toast.error('เลือกท่าอย่างน้อย 1 ท่า');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          items: ids.map((exerciseId, i) => ({ exerciseId, ...picks[exerciseId], daysOfWeek: days.length === 7 ? [] : days, sortOrder: i })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 409) {
        toast.error('มีชุดภารกิจชื่อนี้อยู่แล้ว ตั้งชื่อใหม่ หรือปิดชุดเดิมก่อน');
        return;
      }
      if (!res.ok) {
        toast.error(`ให้ภารกิจไม่สำเร็จ ${body?.error ?? ''}`);
        return;
      }
      toast.success(`ให้ภารกิจ "${title}" กับนักเรียน ${body.kids} คนแล้ว`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border bg-card p-5">
      <div className="space-y-1">
        <label htmlFor="set-title" className="text-sm font-medium">ชื่อชุดภารกิจ</label>
        <Input id="set-title" required maxLength={200} placeholder="เช่น ยืดเหยียดก่อนเข้าเรียน" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">วันที่ทำ</p>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((d, i) => {
            const on = days.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())}
                className={`h-10 w-12 rounded-full border text-sm font-semibold ${on ? 'border-transparent bg-[var(--kids-sky)] text-white' : 'bg-white text-muted-foreground'}`}
              >
                {d}
              </button>
            );
          })}
        </div>
        {days.length === 0 && <p className="text-xs text-red-600">เลือกอย่างน้อย 1 วัน</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">เลือกท่าจากคลังของผู้เชี่ยวชาญ ({Object.keys(picks).length} ท่า)</p>
        {library === null ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {library.map((ex) => {
              const p = picks[ex.id];
              const primary = ex.targetJoints.find((t) => t.isPrimary) ?? ex.targetJoints[0];
              return (
                <div key={ex.id} className={`rounded-2xl border-2 p-3 transition ${p ? 'border-[var(--kids-sky)] bg-[#f2f9ff]' : 'border-transparent bg-muted/40'}`}>
                  <button type="button" onClick={() => toggle(ex)} className="flex w-full items-start gap-3 text-left">
                    <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-white">
                      <ExerciseDemo slug={ex.slug} target={primary} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{ex.kidName}</p>
                      <p className="text-xs text-muted-foreground">{ex.nameTh}{ex.unilateral ? ' · ทีละข้าง' : ''}</p>
                    </div>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${p ? 'border-[var(--kids-sky)] bg-[var(--kids-sky)] text-white' : 'bg-white'}`}>
                      {p && <Check className="h-4 w-4" />}
                    </span>
                  </button>
                  {p && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <NumberField label="รอบ" value={p.sets} min={1} max={5} onChange={(v) => setPicks({ ...picks, [ex.id]: { ...p, sets: v } })} />
                      <NumberField label="ครั้ง/รอบ" value={p.repsPerSet} min={1} max={30} onChange={(v) => setPicks({ ...picks, [ex.id]: { ...p, repsPerSet: v } })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={saving || days.length === 0}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ให้ภารกิจทั้งห้อง
        </Button>
      </div>
    </form>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="h-9 w-16"
      />
    </label>
  );
}
