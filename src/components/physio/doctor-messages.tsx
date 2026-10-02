'use client';

import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { CareChat } from '@/components/physio/care-chat';

// Clinician inbox: one thread per care-team patient, most recent first.

interface Thread {
  patientId: string;
  patientName: string;
  unread: number;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
}

const REFRESH_MS = 15000;

export function DoctorMessages() {
  const { selectedPatientId, setSelectedPatientId } = useAppStore();
  const [threads, setThreads] = useState<Thread[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/messages/threads')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && d && setThreads(d.threads))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const active = selectedPatientId ?? threads?.[0]?.patientId ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ข้อความ</h2>
        <p className="text-muted-foreground mt-1">สนทนากับผู้ป่วยในความดูแล (ทีมผู้ดูแลทุกคนเห็นข้อความเดียวกัน)</p>
      </div>

      {threads === null ? (
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีผู้ป่วยในความดูแล</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <div className="space-y-1">
            {threads.map((t) => (
              <button
                key={t.patientId}
                type="button"
                onClick={() => {
                  setSelectedPatientId(t.patientId);
                  setThreads((list) => list?.map((x) => (x.patientId === t.patientId ? { ...x, unread: 0 } : x)) ?? list);
                }}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  t.patientId === active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{t.patientName}</span>
                  {t.unread > 0 && <Badge className="bg-emerald-600 text-white">{t.unread}</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {t.lastMessage ? `${t.lastMessage.mine ? 'คุณ: ' : ''}${t.lastMessage.body}` : 'ยังไม่มีข้อความ'}
                </p>
              </button>
            ))}
          </div>
          {active ? (
            <CareChat key={active} patientId={active} viewer="CLINICIAN" />
          ) : (
            <div className="flex items-center justify-center rounded-xl border text-sm text-muted-foreground">
              <MessageCircle className="mr-2 h-4 w-4" /> เลือกผู้ป่วยเพื่อเริ่มสนทนา
            </div>
          )}
        </div>
      )}
    </div>
  );
}
