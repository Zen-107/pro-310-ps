'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { CATEGORIES, DIFFICULTY_COLORS, DIFFICULTY_LABELS } from '@/lib/exercises-data';
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  UserCircle,
  Loader2,
  Pause,
  Play,
  CheckCircle2,
  StickyNote,
  Target,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  age: number | null;
  condition: string;
}

interface Target {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  isPrimary?: boolean;
  overridden?: boolean;
}

interface Exercise {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  difficulty: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  targetJoints: Target[];
}

interface PrescriptionItem {
  id: string;
  exerciseId: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  daysOfWeek: number[];
  exercise: { id: string; nameTh: string; name: string; category: string; difficulty: string };
  targets: Target[];
}

interface Prescription {
  id: string;
  title: string;
  notes: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  outcome: Outcome | null;
  outcomeNote: string | null;
  startDate: string;
  clinician: { name: string };
  items: PrescriptionItem[];
}

type Outcome = 'GOAL_MET' | 'PARTIAL' | 'NOT_IMPROVED' | 'REINJURY' | 'DROPPED_OUT' | 'REFERRED';

// Recorded when a plan ends: the labels a future outcome model is trained on
const OUTCOME_LABEL: Record<Outcome, string> = {
  GOAL_MET: 'ถึงเป้าหมาย',
  PARTIAL: 'ดีขึ้นบางส่วน',
  NOT_IMPROVED: 'ไม่ดีขึ้น',
  REINJURY: 'บาดเจ็บซ้ำ / บาดเจ็บใหม่',
  DROPPED_OUT: 'หยุดฝึก / ขาดการติดตาม',
  REFERRED: 'ส่งต่อ (ผ่าตัด / ผู้เชี่ยวชาญ)',
};

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const STATUS_LABEL: Record<Prescription['status'], string> = {
  ACTIVE: 'ใช้งาน',
  PAUSED: 'พักไว้',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

// ── Component ──────────────────────────────────────────────────────────

export function DoctorPlans() {
  const { selectedPatientId, setSelectedPatientId } = useAppStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [prescriptions, setPrescriptions] = useState<Prescription[] | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [ending, setEnding] = useState(false);
  const [endOutcome, setEndOutcome] = useState<Outcome | ''>('');
  const [endNote, setEndNote] = useState('');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load care-team patients + exercise library ──────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([api<Patient[]>('/api/patients'), api<Exercise[]>('/api/exercises')])
      .then(([p, e]) => {
        if (cancelled) return;
        setPatients(Array.isArray(p) ? p : []);
        setExercises(Array.isArray(e) ? e : []);
      })
      .catch(() => toast.error('ไม่สามารถโหลดข้อมูลได้'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Load prescriptions for the selected patient ─────────
  const [prevPatientId, setPrevPatientId] = useState(selectedPatientId);
  if (prevPatientId !== selectedPatientId) {
    setPrevPatientId(selectedPatientId);
    setPrescriptions(null);
  }

  useEffect(() => {
    if (!selectedPatientId) return;
    let cancelled = false;
    api<Prescription[]>(`/api/prescriptions?patientId=${selectedPatientId}`)
      .then((list) => {
        if (cancelled) return;
        setPrescriptions(list);
        setNotes(list.find((p) => p.status === 'ACTIVE' || p.status === 'PAUSED')?.notes ?? '');
      })
      .catch(() => !cancelled && toast.error('ไม่สามารถโหลดแผนการรักษาได้'));
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  useEffect(() => () => {
    if (notesTimer.current) clearTimeout(notesTimer.current);
  }, []);

  // The plan being edited: the active (or paused) prescription
  const plan = prescriptions?.find((p) => p.status === 'ACTIVE' || p.status === 'PAUSED') ?? null;
  const replacePlan = (updated: Prescription) =>
    setPrescriptions((list) => (list ? list.map((p) => (p.id === updated.id ? updated : p)) : [updated]));

  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | null> {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast.success(success);
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createPlan() {
    if (!selectedPatientId) return;
    const created = await run(
      () => api<Prescription>('/api/prescriptions', {
        method: 'POST',
        body: JSON.stringify({ patientId: selectedPatientId, title: newTitle.trim() || 'แผนการรักษา' }),
      }),
      'สร้างแผนการรักษาแล้ว'
    );
    if (created) {
      setPrescriptions((list) => [created, ...(list ?? [])]);
      setNewTitle('');
      setNotes('');
    }
  }

  async function setStatus(status: Prescription['status']) {
    if (!plan) return;
    const updated = await run(
      () => api<Prescription>(`/api/prescriptions/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
      `สถานะแผน: ${STATUS_LABEL[status]}`
    );
    if (updated) replacePlan(updated);
  }

  async function endPlan() {
    if (!plan) return;
    const updated = await run(
      () =>
        api<Prescription>(`/api/prescriptions/${plan.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'COMPLETED', outcome: endOutcome || null, outcomeNote: endNote.trim() || null }),
        }),
      'จบแผนการรักษาแล้ว'
    );
    if (updated) {
      replacePlan(updated);
      setEnding(false);
      setEndOutcome('');
      setEndNote('');
    }
  }

  async function setOutcome(planId: string, outcome: Outcome) {
    const updated = await run(
      () => api<Prescription>(`/api/prescriptions/${planId}`, { method: 'PATCH', body: JSON.stringify({ outcome }) }),
      `บันทึกผลการรักษา: ${OUTCOME_LABEL[outcome]}`
    );
    if (updated) replacePlan(updated);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    if (!plan) return;
    const planId = plan.id;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try {
        replacePlan(await api<Prescription>(`/api/prescriptions/${planId}`, { method: 'PATCH', body: JSON.stringify({ notes: value }) }));
        toast.success('บันทึกคำแนะนำเรียบร้อย');
      } catch {
        toast.error('บันทึกคำแนะนำไม่สำเร็จ');
      }
    }, 1000);
  }

  async function addExercise(exerciseId: string) {
    if (!plan) return;
    const updated = await run(
      () => api<Prescription>(`/api/prescriptions/${plan.id}/items`, { method: 'POST', body: JSON.stringify({ exerciseId }) }),
      'เพิ่มท่าในแผนแล้ว'
    );
    if (updated) replacePlan(updated);
  }

  async function removeItem(itemId: string) {
    if (!plan) return;
    const updated = await run(
      () => api<Prescription>(`/api/prescriptions/${plan.id}/items/${itemId}`, { method: 'DELETE' }),
      'นำท่าออกจากแผนแล้ว'
    );
    if (updated) replacePlan(updated);
  }

  async function saveItem(itemId: string, body: Record<string, unknown>) {
    if (!plan) return;
    const updated = await run(
      () => api<Prescription>(`/api/prescriptions/${plan.id}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),
      'บันทึกการตั้งค่าท่าแล้ว'
    );
    if (updated) replacePlan(updated);
  }

  // ── Render ──────────────────────────────────────────────
  if (loading) return <PlansSkeleton />;

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">แผนการรักษา</h2>
        <p className="text-muted-foreground mt-1">
          กำหนดภารกิจรายวัน (ท่า, จำนวนเซ็ต/ครั้ง, วัน และมุมเป้าหมาย) ให้ผู้ป่วยแต่ละคน
        </p>
      </div>
      {patients.length > 0 && (
        <div className="w-full sm:w-72">
          <Select value={selectedPatientId || undefined} onValueChange={setSelectedPatientId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกคนไข้..." />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.age ? ` (${p.age} ปี)` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  if (!selectedPatientId || patients.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <UserCircle className="w-10 h-10 text-amber-600 mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              {patients.length === 0 ? 'ยังไม่มีผู้ป่วยในความดูแล' : 'กรุณาเลือกคนไข้'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {patients.length === 0
                ? 'ผู้ป่วยจะแสดงที่นี่เมื่อคุณอยู่ในทีมดูแล'
                : 'เลือกคนไข้จากเมนูด้านบนเพื่อจัดแผนการรักษา'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (prescriptions === null) return <PlansSkeleton />;

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const inPlan = new Set(plan?.items.map((i) => i.exerciseId));
  const exercisesByCat = CATEGORIES.map((cat) => ({
    ...cat,
    exercises: exercises.filter((e) => e.category === cat.id),
  })).filter((c) => c.exercises.length > 0);

  return (
    <div className="space-y-6">
      {header}

      {!plan ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="font-medium">{selectedPatient?.name} ยังไม่มีแผนการรักษาที่ใช้งานอยู่</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="ชื่อแผน เช่น โปรแกรมฟื้นฟูเข่า ระยะที่ 1"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Button className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={createPlan}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                สร้างแผน
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Plan header */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    <h3 className="text-lg font-semibold">{plan.title}</h3>
                    <Badge variant={plan.status === 'ACTIVE' ? 'default' : 'secondary'}>{STATUS_LABEL[plan.status]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    เริ่ม {new Date(plan.startDate).toLocaleDateString('th-TH', { dateStyle: 'medium' })} · โดย {plan.clinician.name} · {plan.items.length} ท่า
                  </p>
                </div>
                <div className="flex gap-2">
                  {plan.status === 'ACTIVE' ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('PAUSED')}>
                      <Pause className="h-3.5 w-3.5" /> พักแผน
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus('ACTIVE')}>
                      <Play className="h-3.5 w-3.5" /> ใช้งานต่อ
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setEnding((v) => !v)} aria-expanded={ending}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> จบแผน
                  </Button>
                </div>
              </div>
              {ending && (
                <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/50 p-3 dark:border-teal-900 dark:bg-teal-950/20">
                  <p className="text-sm font-medium">ผลการรักษาเมื่อจบแผน</p>
                  <p className="text-xs text-muted-foreground">
                    ใช้เป็นข้อมูลผลลัพธ์สำหรับพัฒนาแบบจำลองพยากรณ์ในอนาคต (ส่งออกแบบไม่ระบุตัวตน) — ข้ามได้ถ้ายังไม่ทราบ และบันทึกภายหลังได้
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                      <Button
                        key={o}
                        size="sm"
                        type="button"
                        variant={endOutcome === o ? 'default' : 'outline'}
                        className={endOutcome === o ? 'bg-teal-600 hover:bg-teal-700' : ''}
                        aria-pressed={endOutcome === o}
                        onClick={() => setEndOutcome(endOutcome === o ? '' : o)}
                      >
                        {OUTCOME_LABEL[o]}
                      </Button>
                    ))}
                  </div>
                  <Textarea value={endNote} onChange={(e) => setEndNote(e.target.value.slice(0, 1000))} placeholder="หมายเหตุ (ไม่บังคับ, ไม่ถูกส่งออก)" className="min-h-14" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEnding(false)}>
                      ยกเลิก
                    </Button>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={endPlan}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} ยืนยันจบแผน
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <StickyNote className="h-4 w-4 text-amber-500" /> คำแนะนำถึงผู้ป่วย (แสดงในภารกิจ)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  placeholder="เช่น หยุดถ้าปวดเกินระดับ 5/10"
                  className="min-h-16"
                />
              </div>
            </CardContent>
          </Card>

          {/* Prescribed exercises */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-600" /> ท่าในแผน (ภารกิจรายวัน)
            </h3>
            {plan.items.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                ยังไม่มีท่าในแผน — เพิ่มจากคลังท่าด้านล่าง
              </p>
            ) : (
              plan.items.map((item) => (
                <PrescriptionItemEditor
                  key={item.id}
                  item={item}
                  defaults={exercises.find((e) => e.id === item.exerciseId)?.targetJoints ?? []}
                  busy={busy}
                  onSave={(body) => saveItem(item.id, body)}
                  onRemove={() => removeItem(item.id)}
                />
              ))
            )}
          </div>

          {/* Exercise library */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">คลังท่ากายภาพ (เผยแพร่แล้ว)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {exercisesByCat.map((cat) => (
                <div key={cat.id}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{cat.name}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cat.exercises.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{ex.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_COLORS[ex.difficulty] || ''}`}>
                              {DIFFICULTY_LABELS[ex.difficulty] || ex.difficulty}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {ex.sets}×{ex.repsPerSet}
                            </span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={inPlan.has(ex.id) ? 'secondary' : 'outline'}
                          disabled={busy || inPlan.has(ex.id)}
                          onClick={() => addExercise(ex.id)}
                        >
                          {inPlan.has(ex.id) ? 'อยู่ในแผน' : <><Plus className="h-3.5 w-3.5" /> เพิ่ม</>}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Ended plans and their recorded outcome */}
      {prescriptions.some((p) => p.status === 'COMPLETED' || p.status === 'CANCELLED') && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">แผนที่จบแล้ว · ผลการรักษา</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {prescriptions
              .filter((p) => p.status === 'COMPLETED' || p.status === 'CANCELLED')
              .map((p) => (
                <div key={p.id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {STATUS_LABEL[p.status]} · เริ่ม {new Date(p.startDate).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <Select value={p.outcome ?? undefined} onValueChange={(v) => setOutcome(p.id, v as Outcome)} disabled={busy}>
                    <SelectTrigger className="h-9 w-full sm:w-56" aria-label={`ผลการรักษาของ ${p.title}`}>
                      <SelectValue placeholder="ยังไม่บันทึกผลการรักษา" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                        <SelectItem key={o} value={o}>
                          {OUTCOME_LABEL[o]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Item editor: dose, schedule and per-joint angle targets ─────────────

function PrescriptionItemEditor({
  item,
  defaults,
  busy,
  onSave,
  onRemove,
}: {
  item: PrescriptionItem;
  defaults: Target[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [sets, setSets] = useState(String(item.sets));
  const [reps, setReps] = useState(String(item.repsPerSet));
  const [rest, setRest] = useState(String(item.restSeconds));
  const [days, setDays] = useState<number[]>(item.daysOfWeek);
  const [targets, setTargets] = useState(item.targets.map((t) => ({ ...t })));
  const [error, setError] = useState<string | null>(null);

  const defaultFor = (joint: string) => defaults.find((d) => d.name === joint);

  function updateTarget(joint: string, field: 'minAngle' | 'idealAngle' | 'maxAngle', value: string) {
    setTargets((list) => list.map((t) => (t.name === joint ? { ...t, [field]: Number(value) } : t)));
  }

  function handleSave() {
    const dose = { sets: Number(sets), repsPerSet: Number(reps), restSeconds: Number(rest) };
    if (!Number.isInteger(dose.sets) || dose.sets < 1 || dose.sets > 20) return setError('เซ็ตต้องเป็น 1–20');
    if (!Number.isInteger(dose.repsPerSet) || dose.repsPerSet < 1 || dose.repsPerSet > 100) return setError('จำนวนครั้งต้องเป็น 1–100');
    if (!Number.isInteger(dose.restSeconds) || dose.restSeconds < 0 || dose.restSeconds > 600) return setError('เวลาพักต้องเป็น 0–600 วินาที');
    for (const t of targets) {
      if (![t.minAngle, t.idealAngle, t.maxAngle].every(Number.isFinite) || !(t.minAngle <= t.idealAngle && t.idealAngle <= t.maxAngle)) {
        return setError(`${t.nameTh}: ต้องเป็น ต่ำสุด ≤ เป้าหมาย ≤ สูงสุด`);
      }
    }
    setError(null);
    // Only joints that differ from the exercise default become overrides
    const targetOverrides = targets
      .filter((t) => {
        const d = defaultFor(t.name);
        return !d || d.minAngle !== t.minAngle || d.idealAngle !== t.idealAngle || d.maxAngle !== t.maxAngle;
      })
      .map(({ name, idealAngle, minAngle, maxAngle }) => ({ joint: name, idealAngle, minAngle, maxAngle }));
    onSave({ ...dose, daysOfWeek: days, targetOverrides });
  }

  function resetTargets() {
    setTargets((list) => list.map((t) => ({ ...t, ...(defaultFor(t.name) ?? {}) })));
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{item.exercise.name}</p>
            </div>
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 max-w-md">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">เซ็ต</span>
              <Input type="number" min={1} max={20} value={sets} onChange={(e) => setSets(e.target.value)} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">ครั้ง/เซ็ต</span>
              <Input type="number" min={1} max={100} value={reps} onChange={(e) => setReps(e.target.value)} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">พัก (วินาที)</span>
              <Input type="number" min={0} max={600} value={rest} onChange={(e) => setRest(e.target.value)} />
            </label>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">วันที่ต้องทำ {days.length === 0 && '(ทุกวัน)'}</p>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDays((list) => (on ? list.filter((x) => x !== d) : [...list, d].sort()))}
                    className={`h-8 w-9 rounded-md border text-xs font-medium transition-colors ${
                      on ? 'bg-teal-600 text-white border-teal-600' : 'hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">มุมเป้าหมาย (องศา)</p>
            {targets.map((t) => {
              const d = defaultFor(t.name);
              const changed = d && (d.minAngle !== t.minAngle || d.idealAngle !== t.idealAngle || d.maxAngle !== t.maxAngle);
              return (
                <div key={t.name} className="grid grid-cols-[1fr_repeat(3,4.5rem)] items-center gap-2">
                  <span className="text-sm truncate">
                    {t.nameTh}
                    {t.isPrimary && <Badge variant="secondary" className="ml-1.5 text-[10px]">นับครั้ง</Badge>}
                    {changed && <Badge className="ml-1.5 text-[10px] bg-amber-500">ปรับแล้ว</Badge>}
                  </span>
                  <Input aria-label="ต่ำสุด" type="number" value={t.minAngle} onChange={(e) => updateTarget(t.name, 'minAngle', e.target.value)} />
                  <Input aria-label="เป้าหมาย" type="number" value={t.idealAngle} onChange={(e) => updateTarget(t.name, 'idealAngle', e.target.value)} />
                  <Input aria-label="สูงสุด" type="number" value={t.maxAngle} onChange={(e) => updateTarget(t.name, 'maxAngle', e.target.value)} />
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground text-right">ต่ำสุด · เป้าหมาย · สูงสุด</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" /> บันทึก
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={resetTargets}>
              <RotateCcw className="h-3.5 w-3.5" /> มุมค่าเริ่มต้น
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
