'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Dumbbell, Clock, Target, Save, ChevronDown, ChevronRight, Activity, Zap, StickyNote, Layers,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/exercises-data';

interface Exercise {
  id: string; name: string; nameTh: string; category: string; description: string;
  instructions: string[]; targetJoints: { name: string; nameTh: string; idealAngle: number }[];
  difficulty: string; sets: number; repsPerSet: number; restSeconds: number; icon: string; bodyPart: string;
}

const diffColors: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  intermediate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  advanced: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const diffLabels: Record<string, string> = { beginner: 'เริ่มต้น', intermediate: 'ปานกลาง', advanced: 'ขั้นสูง' };

export function DoctorPlans() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['knee', 'shoulder']));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/exercises').then(r => r.json()).then(d => {
      setExercises(d);
      setEnabledIds(new Set(d.map((e: Exercise) => e.id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function toggleExercise(id: string) {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCat(catId: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  async function saveNotes() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast.success('บันทึกคำแนะนำเรียบร้อย');
  }

  if (loading) return <PlansSkeleton />;

  const enabledExercises = exercises.filter(e => enabledIds.has(e.id));
  const totalTime = enabledExercises.reduce((sum, e) => sum + (e.sets * e.repsPerSet * 4 + e.sets * e.restSeconds), 0);
  const enabledCats = new Set(enabledExercises.map(e => e.category));
  const diffCount = { beginner: 0, intermediate: 0, advanced: 0 };
  enabledExercises.forEach(e => { diffCount[e.difficulty as keyof typeof diffCount]++; });

  const exercisesByCat = CATEGORIES.map(cat => ({
    ...cat,
    exercises: exercises.filter(e => e.category === cat.id),
  })).filter(c => c.exercises.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">แผนการรักษา</h2>
        <p className="text-muted-foreground mt-1">จัดการท่ากายภาพบำบัดที่กำหนดให้ผู้ป่วย</p>
      </div>

      {/* Plan Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Layers className="h-4 w-4 text-emerald-600" /> สรุปแผนการรักษา</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-2xl font-bold text-emerald-600">{enabledExercises.length}</p>
                <p className="text-xs text-muted-foreground">ท่าที่กำหนด</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                <p className="text-2xl font-bold">{Math.round(totalTime / 60)}<span className="text-sm font-normal"> นาที</span></p>
                <p className="text-xs text-muted-foreground">เวลาโดยประมาณ</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted">
                <p className="text-2xl font-bold">{enabledCats.size}</p>
                <p className="text-xs text-muted-foreground">หมวดหมู่</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted">
                <p className="text-2xl font-bold text-emerald-600">{diffCount.beginner}</p>
                <p className="text-xs text-muted-foreground">เริ่มต้น</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted">
                <p className="text-2xl font-bold text-amber-600">{diffCount.intermediate + diffCount.advanced}</p>
                <p className="text-xs text-muted-foreground">กลาง-สูง</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Exercise List by Category */}
      <div className="space-y-3">
        {exercisesByCat.map(cat => (
          <motion.div key={cat.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <button className="w-full p-4 flex items-center justify-between" onClick={() => toggleCat(cat.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                    <Activity className="h-4 w-4" style={{ color: cat.color }} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{cat.name} <span className="font-normal text-muted-foreground">({cat.nameEn})</span></p>
                    <p className="text-xs text-muted-foreground">{cat.exercises.length} ท่า · {cat.exercises.filter(e => enabledIds.has(e.id)).length} เปิดใช้</p>
                  </div>
                </div>
                {expandedCats.has(cat.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {expandedCats.has(cat.id) && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-4 space-y-2">
                      {cat.exercises.map(ex => (
                        <div key={ex.id} className={`flex items-center justify-between p-3 rounded-xl transition-colors ${enabledIds.has(ex.id) ? 'bg-background border' : 'bg-muted/30 opacity-60'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ex.nameTh}</p>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" />{ex.sets}×{ex.repsPerSet}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ex.restSeconds}s</span>
                              <span className="flex items-center gap-1"><Target className="h-3 w-3" />{ex.targetJoints.length} ข้อต่อ</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className={diffColors[ex.difficulty]}>{diffLabels[ex.difficulty]}</Badge>
                            <Switch checked={enabledIds.has(ex.id)} onCheckedChange={() => toggleExercise(ex.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Doctor Notes */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><StickyNote className="h-4 w-4 text-amber-500" /> บันทึกคำแนะนำสำหรับคนไข้</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="บันทึกคำแนะนำเพิ่มเติมสำหรับคนไข้ เช่น ข้อควรระวัง, ข้อจำกัด, เป้าหมายระยะสั้น..." className="min-h-[120px] resize-y" />
            <Button onClick={saveNotes} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              บันทึก
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}

function PlansSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-28 rounded-xl" />{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}<Skeleton className="h-40 rounded-xl" /></div>;
}
