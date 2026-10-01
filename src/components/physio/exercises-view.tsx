'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Footprints,
  MoveUp,
  Circle,
  AlignCenterVertical,
  ArrowUpDown,
  MoveHorizontal,
  RefreshCw,
  Mountain,
  ArrowUpFromLine,
  RotateCcw,
  Copy,
  Minimize2 as Compress,
  PersonStanding,
  StretchHorizontal,
  ChevronRight,
  Search,
  Filter,
  Activity,
  Dumbbell,
  Clock,
  Zap,
} from 'lucide-react';
import {
  CATEGORIES,
  EXERCISES,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  exerciseIdFromName,
  type ExerciseData,
  type TargetJoint,
} from '@/lib/exercises-data';
import { useAppStore } from '@/lib/store';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints,
  MoveUp,
  Circle,
  AlignCenterVertical,
  ArrowUpDown,
  MoveHorizontal,
  RefreshCw,
  Mountain,
  ArrowUpFromLine,
  RotateCcw,
  Copy,
  Compress,
  PersonStanding,
  StretchHorizontal,
};

interface ExerciseWithId extends ExerciseData {
  id: string;
}

export function ExercisesView() {
  const [exercises, setExercises] = useState<ExerciseWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const setSelectedExerciseId = useAppStore((s) => s.setSelectedExerciseId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    let cancelled = false;
    // Fallback to local data when the API is unavailable
    const localExercises = () =>
      EXERCISES.map((e) => ({ ...e, id: exerciseIdFromName(e.name) }));

    async function fetchExercises() {
      let data: ExerciseWithId[];
      try {
        const res = await fetch('/api/exercises');
        data = res.ok ? await res.json() : localExercises();
      } catch {
        data = localExercises();
      }
      if (cancelled) return;
      setExercises(data);
      setLoading(false);
    }
    fetchExercises();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredExercises = exercises.filter((ex) => {
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      ex.nameTh.includes(searchQuery) ||
      ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ex.description.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return exercises.length;
    return exercises.filter((e) => e.category === catId).length;
  };

  function handleStartExercise(ex: ExerciseWithId) {
    setSelectedExerciseId(ex.id);
    setActiveTab('camera');
  }

  if (selectedExercise) {
    return (
      <ExerciseDetail
        exercise={selectedExercise}
        onBack={() => setSelectedExercise(null)}
        onStart={() => handleStartExercise(selectedExercise)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">คลังท่ากายภาพบำบัด</h2>
        <p className="text-muted-foreground mt-1">
          เลือกท่าทางที่ต้องการฝึก พร้อมคำแนะนำจาก AI
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ค้นหาท่ากายภาพ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
      </div>

      {/* Categories */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className={
              selectedCategory === 'all'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                : 'shrink-0'
            }
          >
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            ทั้งหมด ({getCategoryCount('all')})
          </Button>
          {CATEGORIES.map((cat) => {
            const CatIcon = iconMap[cat.icon] || Activity;
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className={
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                    : 'shrink-0'
                }
              >
                <CatIcon className="h-3.5 w-3.5 mr-1.5" />
                {cat.name}
                <span className="ml-1 text-xs opacity-70">({getCategoryCount(cat.id)})</span>
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Exercise Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredExercises.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg">ไม่พบท่ากายภาพที่ค้นหา</p>
          <p className="text-muted-foreground/70 text-sm mt-1">ลองค้นหาด้วยคำอื่น หรือเลือกหมวดหมู่อื่น</p>
        </motion.div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.06 } },
          }}
        >
          <AnimatePresence>
            {filteredExercises.map((exercise) => (
              <motion.div
                key={exercise.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
                layout
              >
                <Card
                  className="overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 group border-border/50 hover:border-emerald-500/30"
                  onClick={() => setSelectedExercise(exercise)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {(() => {
                            const Icon = iconMap[exercise.icon] || Activity;
                            return <Icon className="h-4 w-4 text-emerald-600 shrink-0" />;
                          })()}
                          <CardTitle className="text-base font-semibold truncate">
                            {exercise.nameTh}
                          </CardTitle>
                        </div>
                        <p className="text-xs text-muted-foreground">{exercise.name}</p>
                      </div>
                      <Badge variant="secondary" className={DIFFICULTY_COLORS[exercise.difficulty]}>
                        {DIFFICULTY_LABELS[exercise.difficulty]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {exercise.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Dumbbell className="h-3 w-3" />
                        {exercise.sets} × {exercise.repsPerSet}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {exercise.restSeconds}s พัก
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {exercise.targetJoints.length} ข้อต่อ
                      </span>
                    </div>
                    <div className="flex justify-end mt-3">
                      <span className="text-emerald-600 text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                        ดูรายละเอียด <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function ExerciseDetail({
  exercise,
  onBack,
  onStart,
}: {
  exercise: ExerciseWithId;
  onBack: () => void;
  onStart: () => void;
}) {
  const ExerciseIcon = iconMap[exercise.icon] || Activity;
  const categoryInfo = CATEGORIES.find((c) => c.id === exercise.category);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
        กลับ
      </Button>

      {/* Header */}
      <Card className="overflow-hidden border-emerald-500/20">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <ExerciseIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{exercise.nameTh}</h2>
              <p className="text-emerald-100 text-sm">{exercise.name}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Badge className="bg-white/20 text-white border-0">
              {categoryInfo?.name || exercise.category}
            </Badge>
            <Badge className="bg-white/20 text-white border-0">
              {DIFFICULTY_LABELS[exercise.difficulty]}
            </Badge>
          </div>
        </div>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {exercise.description}
          </p>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            วิธีทำ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exercise.instructions.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {i + 1}
                </span>
              </div>
              <p className="text-sm pt-0.5">{step}</p>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Target Joints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500" />
            มุมข้อต่อเป้าหมาย
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exercise.targetJoints.map((joint: TargetJoint) => (
              <div
                key={joint.name}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">{joint.nameTh}</p>
                  <p className="text-xs text-muted-foreground">{joint.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-600">{joint.idealAngle}°</p>
                  <p className="text-xs text-muted-foreground">
                    ช่วง: {joint.minAngle}° - {joint.maxAngle}°
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-emerald-600" />
            โปรแกรมการฝึก
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-2xl font-bold text-emerald-600">{exercise.sets}</p>
              <p className="text-xs text-muted-foreground mt-1">เซ็ต</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <p className="text-2xl font-bold text-amber-600">{exercise.repsPerSet}</p>
              <p className="text-xs text-muted-foreground mt-1">ครั้ง/เซ็ต</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-muted">
              <p className="text-2xl font-bold">{exercise.restSeconds}s</p>
              <p className="text-xs text-muted-foreground mt-1">พักเซ็ต</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Start Button */}
      <Button
        onClick={onStart}
        className="w-full h-14 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/20"
      >
        <Activity className="h-5 w-5 mr-2" />
        เริ่มฝึกท่านี้
      </Button>
    </motion.div>
  );
}

function Target({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}