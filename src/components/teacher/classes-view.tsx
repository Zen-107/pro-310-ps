'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronRight, Plus, School, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ClassroomPage } from '@/components/teacher/classroom-page';

// Teacher: own classes (create, open). Expert: every class of the school, read-only.

interface ClassSummary {
  id: string;
  name: string;
  gradeLabel: string | null;
  teacherName: string;
  studentCount: number;
  dueToday: number;
  doneToday: number;
}

export function ClassesView({ readOnly = false }: { readOnly?: boolean }) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');

  const load = useCallback(() => {
    fetch('/api/classrooms')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClasses(Array.isArray(d) ? d : []))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/classrooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, gradeLabel: grade || null }),
    });
    if (!res.ok) {
      toast.error('สร้างห้องเรียนไม่สำเร็จ');
      return;
    }
    const c = await res.json();
    toast.success(`สร้างห้อง ${c.name} แล้ว เพิ่มนักเรียนได้เลย`);
    setName('');
    setGrade('');
    setCreating(false);
    load();
    setOpenId(c.id);
  }

  if (openId) {
    return (
      <ClassroomPage
        classroomId={openId}
        readOnly={readOnly}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">ห้องเรียน{readOnly ? 'ในโรงเรียน' : 'ของฉัน'}</h2>
          <p className="text-sm text-muted-foreground">
            {readOnly ? 'ดูความก้าวหน้าของแต่ละห้อง (ภารกิจกำหนดโดยคุณครู)' : 'แตะห้องเพื่อดูวันนี้ ให้ภารกิจ และจัดการบัตรเข้าใช้งานของนักเรียน'}
          </p>
        </div>
        {!readOnly && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> สร้างห้องเรียน
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="class-name" className="text-sm font-medium">ชื่อห้อง</label>
            <Input id="class-name" required maxLength={60} placeholder="เช่น ป.4/1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="class-grade" className="text-sm font-medium">ระดับชั้น (ไม่บังคับ)</label>
            <Input id="class-grade" maxLength={60} placeholder="เช่น ประถมศึกษาปีที่ 4" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              ยกเลิก
            </Button>
            <Button type="submit">สร้าง</Button>
          </div>
        </form>
      )}

      {classes === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center text-muted-foreground">
          <School className="mx-auto mb-2 h-8 w-8" />
          {readOnly ? 'ยังไม่มีห้องเรียนในโรงเรียน' : 'ยังไม่มีห้องเรียน เริ่มจากสร้างห้องแรกได้เลย'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => {
            const pct = c.dueToday ? Math.round((c.doneToday / c.dueToday) * 100) : 0;
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="group rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-2xl font-bold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.gradeLabel ?? 'ห้องเรียน'}
                      {readOnly ? ` · ${c.teacherName}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-0.5" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-[var(--kids-sky-deep)]" />
                  นักเรียน {c.studentCount} คน
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>ทำภารกิจครบวันนี้</span>
                    <span>
                      {c.doneToday}/{c.dueToday} คน
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
