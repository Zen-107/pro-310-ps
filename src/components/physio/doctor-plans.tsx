'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { CATEGORIES } from '@/lib/exercises-data';
import {
  Dumbbell,
  Clock,
  Target,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Layers,
  UserCircle,
  Loader2,
  FileText,
  Timer,
  BarChart3,
  Zap,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  name: string;
  age: number | null;
  condition: string;
  assignedExerciseIds: string[];
  therapistNotes: string | null;
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
  targetJoints: unknown[];
  icon: string;
  bodyPart: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const DIFF_LABELS: Record<string, string> = {
  beginner: 'เริ่มต้น',
  intermediate: 'ปานกลาง',
  advanced: 'ขั้นสูง',
};

// ── Component ──────────────────────────────────────────────────────────

export function DoctorPlans() {
  const { selectedPatientId, setSelectedPatientId } = useAppStore();

  // Data
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(true);

  // Local state for the selected patient
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Saving states
  const [savingExercises, setSavingExercises] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Debounce refs
  const saveExerciseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch patients ──────────────────────────────────────
  useEffect(() => {
    fetch('/api/patients')
      .then((r) => r.json())
      .then((d: Patient[]) => {
        setPatients(d);
        setLoadingPatients(false);
      })
      .catch(() => {
        toast.error('ไม่สามารถโหลดรายชื่อคนไข้ได้');
        setLoadingPatients(false);
      });
  }, []);

  // ── Fetch exercises ────────────────────────────────────
  useEffect(() => {
    fetch('/api/exercises')
      .then((r) => r.json())
      .then((d: Exercise[]) => {
        setExercises(d);
        setLoadingExercises(false);
      })
      .catch(() => {
        toast.error('ไม่สามารถโหลดท่าบำบัดได้');
        setLoadingExercises(false);
      });
  }, []);

  // ── Sync state when selected patient changes ───────────
  useEffect(() => {
    if (!selectedPatientId) {
      setEnabledIds(new Set());
      setNotes('');
      return;
    }
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (patient) {
      setEnabledIds(new Set(patient.assignedExerciseIds || []));
      setNotes(patient.therapistNotes || '');
      // Expand all categories by default
      setExpandedCats(new Set(CATEGORIES.map((c) => c.id)));
    }
  }, [selectedPatientId, patients]);

  // ── Cleanup debounce timers on unmount ─────────────────
  useEffect(() => {
    return () => {
      if (saveExerciseTimer.current) clearTimeout(saveExerciseTimer.current);
      if (saveNotesTimer.current) clearTimeout(saveNotesTimer.current);
    };
  }, []);

  // ── Save exercise assignments (debounced) ──────────────
  const saveExerciseAssignments = useCallback(
    async (ids: string[]) => {
      if (!selectedPatientId) return;
      setSavingExercises(true);
      try {
        const res = await fetch(`/api/patients/${selectedPatientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedExerciseIds: ids }),
        });
        if (!res.ok) throw new Error('Save failed');
        setLastSavedAt(new Date());
      } catch {
        toast.error('บันทึกท่าบำบัดไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally {
        setSavingExercises(false);
      }
    },
    [selectedPatientId],
  );

  // ── Save therapist notes (debounced) ───────────────────
  const saveTherapistNotes = useCallback(
    async (text: string) => {
      if (!selectedPatientId) return;
      setSavingNotes(true);
      try {
        const res = await fetch(`/api/patients/${selectedPatientId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ therapistNotes: text }),
        });
        if (!res.ok) throw new Error('Save failed');
      } catch {
        toast.error('บันทึกคำแนะนำไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally {
        setSavingNotes(false);
      }
    },
    [selectedPatientId],
  );

  // ── Toggle exercise ────────────────────────────────────
  function handleToggleExercise(id: string) {
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      // Debounce auto-save (800ms)
      const newIds = Array.from(next);
      if (saveExerciseTimer.current) clearTimeout(saveExerciseTimer.current);
      saveExerciseTimer.current = setTimeout(() => {
        saveExerciseAssignments(newIds).then(() => {
          toast.success('บันทึกแผนการรักษาเรียบร้อย', {
            description: `${newIds.length} ท่าบำบัด`,
          });
        });
      }, 800);

      return next;
    });
  }

  // ── Notes change ───────────────────────────────────────
  function handleNotesChange(value: string) {
    setNotes(value);
    if (saveNotesTimer.current) clearTimeout(saveNotesTimer.current);
    saveNotesTimer.current = setTimeout(() => {
      saveTherapistNotes(value).then(() => {
        toast.success('บันทึกคำแนะนำเรียบร้อย');
      });
    }, 1200);
  }

  // ── Toggle category expand ─────────────────────────────
  function toggleCat(catId: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  // ── Computed ───────────────────────────────────────────
  const enabledExercises = exercises.filter((e) => enabledIds.has(e.id));
  const totalTime = enabledExercises.reduce(
    (sum, e) => sum + e.sets * e.repsPerSet * 4 + e.sets * e.restSeconds,
    0,
  );
  const enabledCats = new Set(enabledExercises.map((e) => e.category));
  const diffCount = { beginner: 0, intermediate: 0, advanced: 0 };
  enabledExercises.forEach((e) => {
    const d = e.difficulty as 'beginner' | 'intermediate' | 'advanced';
    if (d in diffCount) diffCount[d]++;
  });

  const exercisesByCat = CATEGORIES.map((cat) => ({
    ...cat,
    exercises: exercises.filter((e) => e.category === cat.id),
  })).filter((c) => c.exercises.length > 0);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // ── Render: No patient selected ────────────────────────
  const isLoading = loadingPatients || loadingExercises;
  if (isLoading) return <PlansSkeleton />;

  if (!selectedPatientId || patients.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">แผนการรักษา</h2>
          <p className="text-muted-foreground mt-1">
            จัดการท่ากายภาพบำบัดที่กำหนดให้ผู้ป่วยแต่ละคน
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/10">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                <UserCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {patients.length === 0
                  ? 'ยังไม่มีรายชื่อคนไข้'
                  : 'กรุณาเลือกคนไข้'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {patients.length === 0
                  ? 'เพิ่มคนไข้จากแท็บ "รายชื่อคนไข้" ก่อนจึงจะสามารถกำหนดแผนการรักษาได้'
                  : 'เลือกคนไข้จากเมนูด้านล่างเพื่อเริ่มจัดท่ากายภาพบำบัด'}
              </p>
              {patients.length > 0 && (
                <div className="mt-6 w-full max-w-xs">
                  <Select
                    value={selectedPatientId || undefined}
                    onValueChange={setSelectedPatientId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="เลือกคนไข้..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.condition ? ` — ${p.condition}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── Render: Main view ──────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">แผนการรักษา</h2>
          <p className="text-muted-foreground mt-1">
            จัดการท่ากายภาพบำบัดที่กำหนดให้ผู้ป่วยแต่ละคน
          </p>
        </div>
        {lastSavedAt && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            บันทึกล่าสุดเมื่อ{' '}
            {lastSavedAt.toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </motion.p>
        )}
      </div>

      {/* Patient Selector */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  คนไข้:
                </span>
              </div>
              <Select
                value={selectedPatientId || undefined}
                onValueChange={(val) => {
                  setSelectedPatientId(val);
                }}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="เลือกคนไข้..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.name}
                        {p.age && (
                          <span className="text-xs text-muted-foreground">
                            ({p.age} ปี)
                          </span>
                        )}
                        {p.condition && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-4"
                          >
                            {p.condition}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plan Summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-600" />
              สรุปแผนการรักษา
              {selectedPatient && (
                <span className="text-muted-foreground font-normal">
                  — {selectedPatient.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <StatPill
                icon={<Dumbbell className="h-4 w-4" />}
                value={String(enabledExercises.length)}
                label="ท่าที่กำหนด"
                color="emerald"
              />
              <StatPill
                icon={<Timer className="h-4 w-4" />}
                value={`${Math.round(totalTime / 60)}`}
                unit="นาที"
                label="เวลาโดยประมาณ"
                color="amber"
              />
              <StatPill
                icon={<BarChart3 className="h-4 w-4" />}
                value={String(enabledCats.size)}
                label="หมวดหมู่"
                color="muted"
              />
              <StatPill
                icon={<Zap className="h-4 w-4" />}
                value={String(diffCount.beginner)}
                label="เริ่มต้น"
                color="emerald"
              />
              <StatPill
                icon={<AlertCircle className="h-4 w-4" />}
                value={String(diffCount.intermediate + diffCount.advanced)}
                label="กลาง-สูง"
                color="amber"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Saving Indicator */}
      <AnimatePresence>
        {(savingExercises || savingNotes) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
              <span>กำลังบันทึก...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise List by Category */}
      <div className="space-y-3">
        {exercisesByCat.map((cat, idx) => {
          const catEnabled = cat.exercises.filter((e) =>
            enabledIds.has(e.id),
          ).length;
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + idx * 0.04 }}
            >
              <Card className="overflow-hidden">
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                  onClick={() => toggleCat(cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: cat.color + '18' }}
                    >
                      <span
                        className="text-base font-bold"
                        style={{ color: cat.color }}
                      >
                        {cat.name.charAt(0)}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">
                        {cat.name}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({cat.nameEn})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cat.exercises.length} ท่า · {catEnabled} เปิดใช้
                      </p>
                    </div>
                  </div>
                  {catEnabled > 0 && (
                    <Badge
                      variant="secondary"
                      className="mr-2 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    >
                      {catEnabled}
                    </Badge>
                  )}
                  {expandedCats.has(cat.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {expandedCats.has(cat.id) && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2">
                        {cat.exercises.map((ex) => {
                          const isEnabled = enabledIds.has(ex.id);
                          return (
                            <motion.div
                              key={ex.id}
                              layout
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                                isEnabled
                                  ? 'bg-background border-emerald-500/20 shadow-sm'
                                  : 'bg-muted/20 border-transparent opacity-50'
                              }`}
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <p className="text-sm font-medium truncate">
                                  {ex.nameTh}
                                </p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Dumbbell className="h-3 w-3" />
                                    {ex.sets}×{ex.repsPerSet}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {ex.restSeconds}s
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    {Array.isArray(ex.targetJoints)
                                      ? ex.targetJoints.length
                                      : 0}{' '}
                                    ข้อต่อ
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2.5 shrink-0">
                                <Badge
                                  variant="secondary"
                                  className={`text-[11px] px-2 py-0.5 ${DIFF_COLORS[ex.difficulty] || ''}`}
                                >
                                  {DIFF_LABELS[ex.difficulty] || ex.difficulty}
                                </Badge>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={() =>
                                    handleToggleExercise(ex.id)
                                  }
                                  className="data-[state=checked]:bg-emerald-600"
                                />
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Therapist Notes */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-500" />
              บันทึกคำแนะนำของนักกายภาพบำบัด
              {savingNotes && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="บันทึกคำแนะนำเพิ่มเติมสำหรับคนไข้ เช่น ข้อควรระวัง, ข้อจำกัด, เป้าหมายระยะสั้น..."
              className="min-h-[120px] resize-y"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                บันทึกอัตโนมัติเมื่อหยุดพิมพ์
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (saveNotesTimer.current) clearTimeout(saveNotesTimer.current);
                  saveTherapistNotes(notes).then(() => {
                    toast.success('บันทึกคำแนะนำเรียบร้อย');
                  });
                }}
                disabled={savingNotes}
                className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                บันทึกเลย
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ── Stat Pill Sub-component ────────────────────────────────────────────

function StatPill({
  icon,
  value,
  unit,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  unit?: string;
  label: string;
  color: 'emerald' | 'amber' | 'muted';
}) {
  const bgMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30',
    amber: 'bg-amber-50 dark:bg-amber-950/30',
    muted: 'bg-muted',
  };
  const textMap = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    muted: '',
  };

  return (
    <div
      className={`text-center p-3 rounded-xl ${bgMap[color]} transition-colors`}
    >
      <div
        className={`flex items-center justify-center gap-1.5 mb-1 ${textMap[color]}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold">
        {value}
        {unit && (
          <span className="text-sm font-normal text-muted-foreground ml-0.5">
            {unit}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────────

function PlansSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Patient selector */}
      <Skeleton className="h-16 rounded-xl" />

      {/* Summary stats */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Exercise categories */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ))}

      {/* Notes */}
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}