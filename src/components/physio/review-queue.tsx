'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardCheck, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import { getAccuracyTextColor } from '@/lib/angle-utils';

// Completed sessions from care-team patients that no clinician has reviewed yet.
// Refreshes periodically so newly finished sessions appear without reloading.

interface QueueItem {
  id: string;
  patientId: string;
  patientName: string;
  endedAt: string | null;
  totalReps: number;
  avgAccuracy: number;
  faultCount: number | null;
  exercise?: { name: string };
}

const REFRESH_MS = 30000;

export function ReviewQueue() {
  const setSelectedPatientId = useAppStore((s) => s.setSelectedPatientId);
  const setSelectedSessionId = useAppStore((s) => s.setSelectedSessionId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const [items, setItems] = useState<QueueItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/sessions?awaitingReview=true&limit=20')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && Array.isArray(d) && setItems(d))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  function open(item: QueueItem) {
    setSelectedPatientId(item.patientId);
    setSelectedSessionId(item.id);
    setActiveTab('reports');
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            เซสชันรอตรวจสอบ
          </span>
          {items && items.length > 0 && <Badge className="bg-amber-500 text-white">{items.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items === null ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีเซสชันที่รอตรวจสอบ</p>
        ) : (
          <div className="divide-y">
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => open(s)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.patientName} · {s.exercise?.name ?? 'Exercise'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.endedAt ? new Date(s.endedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'} · {s.totalReps} ครั้ง
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!!s.faultCount && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" /> {s.faultCount}
                    </span>
                  )}
                  <span className={`text-sm font-semibold tabular-nums ${getAccuracyTextColor(s.avgAccuracy)}`}>{s.avgAccuracy}%</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
