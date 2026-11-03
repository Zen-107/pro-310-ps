'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  Check,
  Flame,
  Gamepad2,
  KeyRound,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Mascot } from '@/components/kids/mascot';
import { ChildProgress } from '@/components/adult/child-progress';
import { playAsChild } from '@/components/adult/play-as';
import { AssignForm, DAY_LABELS } from '@/components/teacher/assign-form';
import { KidCards, type KidCard } from '@/components/teacher/kid-cards';
import { KID_EXERCISES } from '@/lib/kids';

interface Student {
  id: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  kidCode: string | null;
  parentLinkCode: string | null;
  parents: string[];
  hasConsent: boolean;
  schoolConsent: boolean;
  videoConsent: boolean;
  today: { total: number; done: number };
  streak: number;
  sessions7d: number;
  stars7d: number | null;
  accuracy7d: number | null;
  lastPlayedAt: string | null;
}

interface Plan {
  title: string;
  notes: string | null;
  startDate: string;
  kids: number;
  items: { exerciseId: string; slug: string; nameTh: string; sets: number; repsPerSet: number; daysOfWeek: number[] }[];
}

interface Detail {
  id: string;
  name: string;
  gradeLabel: string | null;
  teacherName: string;
  students: Student[];
  plans: Plan[];
}

type Section = 'today' | 'missions' | 'students' | 'play';

export function ClassroomPage({ classroomId, readOnly, onBack }: { classroomId: string; readOnly: boolean; onBack: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [section, setSection] = useState<Section>('today');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [cards, setCards] = useState<KidCard[] | null>(null);

  const load = useCallback(() => {
    fetch(`/api/classrooms/${classroomId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [classroomId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) return <Skeleton className="h-96 rounded-2xl" />;

  const student = detail.students.find((s) => s.id === studentId);
  if (student) {
    return (
      <StudentDetail
        student={student}
        readOnly={readOnly}
        onBack={() => setStudentId(null)}
        onChanged={load}
        onCards={(c) => {
          setCards(c);
          setStudentId(null);
          setSection('students');
        }}
      />
    );
  }

  const sections: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'today', label: 'วันนี้', icon: CalendarCheck },
    { id: 'missions', label: 'ภารกิจ', icon: ListChecks },
    { id: 'students', label: 'นักเรียน', icon: Users },
    ...(readOnly ? [] : [{ id: 'play' as const, label: 'เล่นในห้อง', icon: Gamepad2 }]),
  ];
  const waiting = detail.students.filter((s) => !s.hasConsent).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> ห้องเรียน
        </Button>
        <div>
          <h2 className="text-2xl font-bold">{detail.name}</h2>
          <p className="text-sm text-muted-foreground">
            {detail.gradeLabel ?? 'ห้องเรียน'} · {detail.teacherName} · นักเรียน {detail.students.length} คน
          </p>
        </div>
      </div>

      {waiting > 0 && (
        <p className="flex items-center gap-2 rounded-xl bg-[#fff4d6] px-4 py-2.5 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-[var(--kids-sun-deep)]" />
          นักเรียน {waiting} คนยังเล่นไม่ได้ เพราะรอผู้ปกครองให้ความยินยอม (หรือบันทึกว่าได้รับหนังสือยินยอมกระดาษแล้ว)
        </p>
      )}

      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${
              section === s.id ? 'bg-[var(--kids-sky)] text-white' : 'bg-white text-muted-foreground hover:text-foreground'
            }`}
          >
            <s.icon className="h-4 w-4" /> {s.label}
          </button>
        ))}
      </div>

      {section === 'today' && <TodayGrid students={detail.students} onOpen={setStudentId} />}
      {section === 'missions' && <Missions classroomId={classroomId} plans={detail.plans} readOnly={readOnly} onChanged={load} />}
      {section === 'students' && (
        <Students
          classroomId={classroomId}
          students={detail.students}
          readOnly={readOnly}
          cards={cards}
          setCards={setCards}
          onOpen={setStudentId}
          onChanged={load}
        />
      )}
      {section === 'play' && <PlayMode students={detail.students} />}
    </div>
  );
}

// ─── Today: who has finished ────────────────────────────────────────
function TodayGrid({ students, onOpen }: { students: Student[]; onOpen: (id: string) => void }) {
  if (students.length === 0) return <Empty text="ยังไม่มีนักเรียนในห้องนี้" />;
  const sorted = [...students].sort((a, b) => Number(a.today.done >= a.today.total) - Number(b.today.done >= b.today.total));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((s) => {
        const done = s.today.total > 0 && s.today.done >= s.today.total;
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className={`relative rounded-2xl border-2 bg-card p-3 text-left transition hover:-translate-y-0.5 ${done ? 'border-[var(--kids-grass)]' : 'border-transparent'}`}
          >
            {done && (
              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--kids-grass)] text-white">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            )}
            <Mascot size={56} avatar={s.avatar} mood={done ? 'cheer' : s.hasConsent ? 'happy' : 'sleepy'} />
            <p className="mt-1 truncate font-semibold">{s.nickname || s.name}</p>
            <p className="text-xs text-muted-foreground">
              {!s.hasConsent ? 'รอความยินยอม' : s.today.total === 0 ? 'วันนี้ไม่มีภารกิจ' : `วันนี้ ${s.today.done}/${s.today.total}`}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Flame className="h-3.5 w-3.5 text-[var(--kids-coral)]" /> {s.streak}
              </span>
              {s.stars7d !== null && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3.5 w-3.5 fill-[var(--kids-sun)] text-[var(--kids-sun-deep)]" /> {s.stars7d}
                </span>
              )}
              {s.accuracy7d !== null && s.accuracy7d < 60 && <span className="rounded-full bg-[#ffe6e3] px-1.5 text-[var(--kids-coral-deep)]">ควรดูท่า</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Missions: class sets ───────────────────────────────────────────
function Missions({ classroomId, plans, readOnly, onChanged }: { classroomId: string; plans: Plan[]; readOnly: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);

  async function end(title: string) {
    if (!confirm(`ปิดชุดภารกิจ "${title}" สำหรับทั้งห้อง?`)) return;
    const res = await fetch(`/api/classrooms/${classroomId}/plans`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, status: 'COMPLETED' }),
    });
    if (res.ok) {
      toast.success('ปิดชุดภารกิจแล้ว');
      onChanged();
    } else toast.error('ปิดไม่สำเร็จ');
  }

  if (adding) {
    return (
      <AssignForm
        classroomId={classroomId}
        onDone={() => {
          setAdding(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {!readOnly && (
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> ให้ภารกิจชุดใหม่
        </Button>
      )}
      {plans.length === 0 ? (
        <Empty text={readOnly ? 'ห้องนี้ยังไม่มีภารกิจ' : 'ยังไม่มีภารกิจ กด "ให้ภารกิจชุดใหม่" เพื่อเลือกท่าจากคลัง'} />
      ) : (
        plans.map((p) => (
          <div key={p.title} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  เริ่ม {p.startDate} · นักเรียน {p.kids} คน{p.notes ? ` · ${p.notes}` : ''}
                </p>
              </div>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => end(p.title)}>
                  ปิดชุดนี้
                </Button>
              )}
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {p.items.map((i) => (
                <li key={i.exerciseId} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-semibold">{KID_EXERCISES[i.slug]?.name ?? i.nameTh}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {i.sets}×{i.repsPerSet} · {i.daysOfWeek.length === 0 ? 'ทุกวัน' : i.daysOfWeek.map((d) => DAY_LABELS[d]).join(' ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Students: add, cards, consent ──────────────────────────────────
function Students({
  classroomId,
  students,
  readOnly,
  cards,
  setCards,
  onOpen,
  onChanged,
}: {
  classroomId: string;
  students: Student[];
  readOnly: boolean;
  cards: KidCard[] | null;
  setCards: (c: KidCard[] | null) => void;
  onOpen: (id: string) => void;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // One student per line: "ชื่อ-นามสกุล, ชื่อเล่น"
  async function add() {
    const list = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [name, nickname] = l.split(/[,，]/).map((x) => x.trim());
        return { name, nickname: nickname || null };
      });
    if (list.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: list }),
      });
      if (!res.ok) {
        toast.error('เพิ่มนักเรียนไม่สำเร็จ');
        return;
      }
      const body = await res.json();
      setCards(body.cards);
      setText('');
      setAdding(false);
      toast.success(`เพิ่มนักเรียน ${body.cards.length} คนแล้ว พิมพ์บัตรให้เด็ก ๆ ได้เลย`);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {cards && <KidCards cards={cards} onClose={() => setCards(null)} />}

      {!readOnly &&
        (adding ? (
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            <label htmlFor="student-list" className="text-sm font-medium">
              พิมพ์รายชื่อ 1 คนต่อบรรทัด: ชื่อ-นามสกุล, ชื่อเล่น
            </label>
            <Textarea
              id="student-list"
              rows={6}
              placeholder={'ด.ญ.มะลิ ใจสดใส, มะลิ\nด.ช.ภูผา แข็งแรง, ภูผา'}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdding(false)}>
                ยกเลิก
              </Button>
              <Button onClick={add} disabled={saving || !text.trim()}>
                <UserPlus className="h-4 w-4" /> เพิ่มและสร้างบัตร
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> เพิ่มนักเรียน
          </Button>
        ))}

      {students.length === 0 ? (
        <Empty text="ยังไม่มีนักเรียน" />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">นักเรียน</th>
                {!readOnly && <th className="hidden px-4 py-2.5 font-medium sm:table-cell">รหัสเด็ก</th>}
                <th className="px-4 py-2.5 font-medium">ผู้ปกครอง / ยินยอม</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(s.id)}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Mascot size={32} avatar={s.avatar} />
                      <div>
                        <p className="font-medium">{s.nickname || s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.name}</p>
                      </div>
                    </div>
                  </td>
                  {!readOnly && <td className="hidden px-4 py-2.5 font-mono sm:table-cell">{s.kidCode}</td>}
                  <td className="px-4 py-2.5">
                    <p className="text-xs">{s.parents.length ? s.parents.join(', ') : <span className="text-muted-foreground">ยังไม่เชื่อมบัญชี</span>}</p>
                    <ConsentBadge s={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConsentBadge({ s }: { s: Student }) {
  if (!s.hasConsent) return <span className="mt-0.5 inline-block rounded-full bg-[#fff4d6] px-2 text-xs text-[#8a6100]">รอความยินยอม</span>;
  return (
    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#e8f8ef] px-2 text-xs text-[var(--kids-grass-deep)]">
      <ShieldCheck className="h-3 w-3" /> {s.schoolConsent && !s.parents.length ? 'หนังสือยินยอม (กระดาษ)' : 'ยินยอมแล้ว'}
      {s.videoConsent ? ' · วิดีโอ' : ''}
    </span>
  );
}

// ─── Classroom play mode ────────────────────────────────────────────
function PlayMode({ students }: { students: Student[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        ใช้คอมพิวเตอร์เครื่องนี้ให้นักเรียนเล่นทีละคน แตะชื่อเพื่อเปลี่ยนเป็นโหมดเด็ก เมื่อเล่นจบกด &quot;ออก&quot; แล้วใส่ PIN ของคุณครูเพื่อกลับมาหน้านี้
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {students.map((s) => (
          <button
            key={s.id}
            disabled={!s.hasConsent || busy !== null}
            onClick={async () => {
              setBusy(s.id);
              if (!(await playAsChild(s.id, router))) setBusy(null);
            }}
            className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 shadow-sm transition hover:-translate-y-0.5 disabled:opacity-40"
          >
            <Mascot size={64} avatar={s.avatar} mood={busy === s.id ? 'cheer' : 'happy'} />
            <span className="font-display font-bold">{s.nickname || s.name}</span>
            {!s.hasConsent && <span className="text-[11px] text-muted-foreground">รอความยินยอม</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── One student ────────────────────────────────────────────────────
function StudentDetail({
  student: s,
  readOnly,
  onBack,
  onChanged,
  onCards,
}: {
  student: Student;
  readOnly: boolean;
  onBack: () => void;
  onChanged: () => void;
  onCards: (cards: KidCard[]) => void;
}) {
  async function reset(kind: 'pictures' | 'kidCode' | 'parentLinkCode') {
    const res = await fetch(`/api/kids/${s.id}/codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: kind }),
    });
    if (!res.ok) {
      toast.error('รีเซ็ตไม่สำเร็จ');
      return;
    }
    const body = await res.json();
    onChanged();
    onCards([
      {
        name: s.name,
        nickname: s.nickname,
        avatar: s.avatar,
        kidCode: body.kidCode ?? s.kidCode,
        pictures: body.pictures ?? null,
        parentLinkCode: body.parentLinkCode ?? s.parentLinkCode,
      },
    ]);
  }

  async function schoolConsent(value: boolean) {
    const res = await fetch(`/api/kids/${s.id}/consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolConsent: value }),
    });
    if (res.ok) {
      toast.success(value ? 'บันทึกหนังสือยินยอมแล้ว' : 'ยกเลิกแล้ว');
      onChanged();
    } else toast.error('บันทึกไม่สำเร็จ');
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> กลับ
        </Button>
        <Mascot size={56} avatar={s.avatar} />
        <div>
          <h2 className="text-2xl font-bold">{s.nickname || s.name}</h2>
          <p className="text-sm text-muted-foreground">
            {s.name} · ผู้ปกครอง: {s.parents.length ? s.parents.join(', ') : 'ยังไม่เชื่อมบัญชี'}
          </p>
        </div>
      </div>

      {!readOnly && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-1.5 font-semibold">
              <KeyRound className="h-4 w-4" /> การเข้าใช้งาน
            </p>
            <p className="text-sm">
              รหัสเด็ก <span className="font-mono font-bold">{s.kidCode}</span> · รหัสผู้ปกครอง{' '}
              <span className="font-mono font-bold">{s.parentLinkCode}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => reset('pictures')}>
                <RefreshCw className="h-3.5 w-3.5" /> รูปภาพใหม่ + พิมพ์บัตร
              </Button>
              <Button size="sm" variant="outline" onClick={() => reset('kidCode')}>
                รหัสเด็กใหม่
              </Button>
              <Button size="sm" variant="outline" onClick={() => reset('parentLinkCode')}>
                รหัสผู้ปกครองใหม่
              </Button>
            </div>
          </div>
          <div className="space-y-2 rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4" /> ความยินยอม
            </p>
            <ConsentBadge s={s} />
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={s.schoolConsent} onChange={(e) => schoolConsent(e.target.checked)} />
              <span>โรงเรียนได้รับหนังสือยินยอมเป็นกระดาษจากผู้ปกครองแล้ว (เด็กเล่นได้แม้ผู้ปกครองยังไม่สมัคร)</span>
            </label>
            <p className="text-xs text-muted-foreground">การบันทึกวิดีโอต้องให้ผู้ปกครองยินยอมเองในบัญชีผู้ปกครองเท่านั้น</p>
          </div>
        </div>
      )}

      <ChildProgress patientId={s.id} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">
      <Mascot mood="sleepy" size={72} />
      {text}
    </div>
  );
}
