'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, School, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AssignForm, DAY_LABELS } from '@/components/teacher/assign-form';
import { KID_EXERCISES } from '@/lib/kids';

// The child's current missions on the expert's child page, with a button to
// give this child more (decision 0005). Class mission sets show who owns them
// and stay read-only here: the teacher changes those for the whole class.

interface Plan {
  id: string;
  title: string;
  status: string;
  classroomId: string | null;
  clinician: { name: string };
  items: { id: string; sets: number; repsPerSet: number; daysOfWeek: number[]; exercise: { slug: string; nameTh: string } }[];
}

const days = (d: number[]) => (d.length === 0 || d.length === 7 ? 'ทุกวัน' : d.map((i) => DAY_LABELS[i]).join(' '));

export function KidMissionsCard({ patientId, kidName }: { patientId: string; kidName: string }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/prescriptions?patientId=${encodeURIComponent(patientId)}&status=ACTIVE`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Plan[]) => setPlans(Array.isArray(d) ? d : []))
      .catch(() => setPlans([]));
  }, [patientId]);

  // The parent keys this card by child, so a new child starts fresh
  useEffect(load, [load]);

  async function cancel(plan: Plan) {
    if (!window.confirm(`เลิกภารกิจ "${plan.title}" ของ${kidName}? ประวัติที่เล่นไปแล้วยังอยู่`)) return;
    setCancelling(plan.id);
    try {
      const res = await fetch(`/api/prescriptions/${plan.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('เลิกภารกิจไม่สำเร็จ');
        return;
      }
      toast.success(`เลิกภารกิจ "${plan.title}" แล้ว`);
      load();
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">ภารกิจของ{kidName}</CardTitle>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} className="bg-teal-600 text-white hover:bg-teal-700">
            <Plus className="mr-1 h-4 w-4" /> ให้ภารกิจ
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <AssignForm
            patientId={patientId}
            kidName={kidName}
            onDone={() => {
              setAdding(false);
              load();
            }}
          />
        )}

        {plans === null ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีภารกิจ กด &quot;ให้ภารกิจ&quot; เพื่อเลือกท่าให้{kidName}</p>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{plan.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {plan.classroomId ? (
                      <>
                        <School className="h-3 w-3" /> ชุดของห้อง โดย {plan.clinician.name} (ครูเป็นคนแก้)
                      </>
                    ) : (
                      <>ให้รายคน โดย {plan.clinician.name}</>
                    )}
                  </p>
                </div>
                {!plan.classroomId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancel(plan)}
                    disabled={cancelling === plan.id}
                    aria-label={`เลิกภารกิจ ${plan.title}`}
                    className="text-muted-foreground"
                  >
                    {cancelling === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {plan.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-x-3">
                    <span>{KID_EXERCISES[item.exercise.slug]?.name ?? item.exercise.nameTh}</span>
                    <span className="text-muted-foreground">
                      {item.sets} × {item.repsPerSet} · {days(item.daysOfWeek)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
