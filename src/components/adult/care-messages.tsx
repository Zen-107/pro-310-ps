'use client';

import { useEffect, useState } from 'react';
import { differenceInYears } from 'date-fns';
import { MessageCircle, School, ShieldCheck, ShieldOff, UserRound, Users, Video, VideoOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { CareChat } from '@/components/physio/care-chat';
import { Mascot } from '@/components/kids/mascot';

// Chat about one child between the expert and the parents who registered for
// that child (adults only; teachers and kids have no chat). Each thread opens
// with a card saying who the child is and who is in the conversation.

interface Person {
  id: string;
  name: string;
  email: string;
  since: string;
  me: boolean;
}

interface Thread {
  patientId: string;
  patientName: string;
  nickname: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  classroom: { name: string; teacher: string } | null;
  parents: Person[];
  experts: Person[];
  consent: { canPlay: boolean; video: boolean };
  unread: number;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
}

const REFRESH_MS = 15000;
const dateTh = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export function CareMessages({ viewer }: { viewer: 'EXPERT' | 'PARENT' }) {
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

  const activeId = threads?.some((t) => t.patientId === selectedPatientId) ? selectedPatientId : (threads?.[0]?.patientId ?? null);
  const active = threads?.find((t) => t.patientId === activeId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ข้อความ</h2>
        <p className="mt-1 text-muted-foreground">
          {viewer === 'EXPERT'
            ? 'คุยกับผู้ปกครองของเด็กแต่ละคน ผู้ปกครองทุกคนที่ลงทะเบียนกับเด็กคนนั้นเห็นข้อความเดียวกัน'
            : 'คุยกับผู้เชี่ยวชาญเรื่องลูกของคุณ'}
        </p>
      </div>

      {threads === null ? (
        <Skeleton className="h-[60vh] w-full rounded-xl" />
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{viewer === 'EXPERT' ? 'ยังไม่มีเด็กในความดูแล' : 'ยังไม่ได้เชื่อมกับบุตรหลาน'}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[17rem_1fr]">
          <div className="space-y-1.5">
            {threads.map((t) => (
              <button
                key={t.patientId}
                type="button"
                onClick={() => {
                  setSelectedPatientId(t.patientId);
                  setThreads((list) => list?.map((x) => (x.patientId === t.patientId ? { ...x, unread: 0 } : x)) ?? list);
                }}
                className={`flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-colors ${
                  t.patientId === activeId ? 'border-[var(--kids-sky)] bg-sky-50' : 'bg-card hover:bg-muted'
                }`}
              >
                <Mascot avatar={t.avatar} size={44} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {t.nickname ? `น้อง${t.nickname}` : t.patientName}
                    </span>
                    {t.unread > 0 && <Badge className="bg-[var(--kids-coral)] text-white">{t.unread}</Badge>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.lastMessage
                      ? `${t.lastMessage.mine ? 'คุณ: ' : ''}${t.lastMessage.body}`
                      : viewer === 'EXPERT'
                        ? t.parents.length
                          ? `ผู้ปกครอง: ${t.parents.map((p) => p.name).join(', ')}`
                          : 'ยังไม่มีผู้ปกครองลงทะเบียน'
                        : 'ยังไม่มีข้อความ'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {active ? (
            <div className="space-y-3">
              <ThreadInfo t={active} viewer={viewer} />
              <CareChat key={active.patientId} patientId={active.patientId} viewer="CLINICIAN" />
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border text-sm text-muted-foreground">
              <MessageCircle className="mr-2 h-4 w-4" /> เลือกเด็กเพื่อเริ่มสนทนา
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Who the child is and who is in this conversation */
function ThreadInfo({ t, viewer }: { t: Thread; viewer: 'EXPERT' | 'PARENT' }) {
  const age = t.dateOfBirth ? differenceInYears(new Date(), new Date(t.dateOfBirth)) : null;
  const others = viewer === 'EXPERT' ? t.parents : t.experts;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Mascot avatar={t.avatar} size={64} className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-bold leading-tight">
            {t.nickname ? `น้อง${t.nickname}` : t.patientName}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {t.patientName}
              {age !== null && ` · ${age} ขวบ`}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {t.classroom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <School className="h-3.5 w-3.5" /> {t.classroom.name} · ครู{t.classroom.teacher}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${t.consent.canPlay ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {t.consent.canPlay ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
              {t.consent.canPlay ? 'ยินยอมแล้ว' : 'ยังไม่ยินยอม'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
              {t.consent.video ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
              {t.consent.video ? 'บันทึกวิดีโอได้' : 'ไม่บันทึกวิดีโอ'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t pt-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
          <Users className="h-4 w-4" /> {viewer === 'EXPERT' ? 'ผู้ปกครองที่ลงทะเบียน' : 'ผู้เชี่ยวชาญที่ดูแล'}
        </p>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {viewer === 'EXPERT'
              ? 'ยังไม่มีผู้ปกครองลงทะเบียนกับเด็กคนนี้ — ข้อความที่ส่งจะรอให้ผู้ปกครองเห็นเมื่อลงทะเบียนด้วยรหัสจากคุณครู'
              : 'ยังไม่มีผู้เชี่ยวชาญดูแล'}
          </p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {others.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.email} · {viewer === 'EXPERT' ? 'ลงทะเบียน' : 'ดูแลตั้งแต่'} {dateTh(p.since)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
