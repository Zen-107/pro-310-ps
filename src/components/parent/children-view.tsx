'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, Check, Flame, Gamepad2, Link2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Mascot } from '@/components/kids/mascot';
import { ChildProgress } from '@/components/adult/child-progress';
import { playAsChild } from '@/components/adult/play-as';
import { ChildConsent, type ConsentState } from '@/components/parent/child-consent';
import { useAppStore } from '@/lib/store';

interface Child {
  id: string;
  name: string;
  nickname: string | null;
  avatar: string | null;
  className: string | null;
  teacherName: string | null;
  today: { total: number; done: number };
  streak: number;
  totalSessions: number;
  sessions7d: number;
  accuracy7d: number | null;
  stars7d: number | null;
  lastPlayedAt: string | null;
  consent: ConsentState;
}

// Parent home: my children at a glance → one child's consent, play and progress.
export function ChildrenView() {
  const [children, setChildren] = useState<Child[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/parent/children')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setChildren(Array.isArray(d) ? d : []))
      .catch(() => setChildren([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (children === null) return <Skeleton className="h-64 rounded-2xl" />;

  const open = children.find((c) => c.id === openId);
  if (open) return <ChildPage child={open} onBack={() => setOpenId(null)} onChanged={load} />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">ลูกของฉัน</h2>
        <p className="text-sm text-muted-foreground">ดูว่าวันนี้น้องยืดเหยียดครบหรือยัง ให้ความยินยอม และให้น้องเล่นที่บ้าน</p>
      </div>

      {children.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-8 text-center">
          <Mascot mood="wave" size={88} />
          <p className="font-semibold">ยังไม่ได้เชื่อมบัญชีกับบุตรหลาน</p>
          <p className="text-sm text-muted-foreground">ใส่รหัสผู้ปกครองจากบัตรที่คุณครูให้</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => {
            const name = c.nickname || c.name;
            const done = c.today.total > 0 && c.today.done >= c.today.total;
            return (
              <button
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className="rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <Mascot size={64} avatar={c.avatar} mood={done ? 'cheer' : c.consent.canPlay ? 'happy' : 'sleepy'} />
                  <div className="min-w-0">
                    <p className="font-display text-xl font-bold">{name}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.className ? `${c.className} · ${c.teacherName}` : 'ยังไม่มีห้องเรียน'}
                    </p>
                  </div>
                </div>
                {!c.consent.canPlay ? (
                  <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#fff4d6] px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-[var(--kids-sun-deep)]" /> แตะเพื่อให้ความยินยอม น้องจึงจะเล่นได้
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${done ? 'bg-[#e8f8ef] text-[var(--kids-grass-deep)]' : 'bg-muted'}`}>
                      {done && <Check className="h-4 w-4" />}
                      วันนี้ {c.today.done}/{c.today.total}
                    </span>
                    <span className="flex items-center gap-1">
                      <Flame className="h-4 w-4 text-[var(--kids-coral)]" /> {c.streak} วัน
                    </span>
                    {c.stars7d !== null && (
                      <span className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-[var(--kids-sun)] text-[var(--kids-sun-deep)]" /> {c.stars7d} ดาว (7 วัน)
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <LinkChild onLinked={load} />
    </div>
  );
}

function LinkChild({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  async function link(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/parent/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkCode: code }),
      });
      if (!res.ok) {
        toast.error('ไม่พบรหัสนี้ กรุณาตรวจอีกครั้ง');
        return;
      }
      const d = await res.json();
      toast.success(`เชื่อมกับ ${d.name} แล้ว`);
      setCode('');
      onLinked();
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={link} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label htmlFor="link-code" className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4" /> เพิ่มบุตรหลานด้วยรหัสผู้ปกครอง
        </label>
        <Input id="link-code" required maxLength={10} className="font-mono uppercase tracking-[0.25em]" placeholder="8 ตัว" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <Button type="submit" disabled={saving || code.trim().length < 8}>
        เชื่อมบัญชี
      </Button>
    </form>
  );
}

function ChildPage({ child: c, onBack, onChanged }: { child: Child; onBack: () => void; onChanged: () => void }) {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const name = c.nickname || c.name;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> ลูกของฉัน
        </Button>
        <Mascot size={64} avatar={c.avatar} mood="happy" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{name}</h2>
          <p className="text-sm text-muted-foreground">
            {c.name}
            {c.className ? ` · ${c.className} · ${c.teacherName}` : ''}
          </p>
        </div>
        <Button
          size="lg"
          className="bg-[var(--kids-coral)] hover:bg-[var(--kids-coral-deep)]"
          disabled={!c.consent.canPlay || busy}
          onClick={async () => {
            setBusy(true);
            if (!(await playAsChild(c.id, router, () => setActiveTab('account')))) setBusy(false);
          }}
        >
          <Gamepad2 className="h-5 w-5" /> ให้{name}เล่นตอนนี้
        </Button>
      </div>

      <ChildConsent childId={c.id} childName={name} consent={c.consent} onChanged={onChanged} />
      <ChildProgress patientId={c.id} />
    </div>
  );
}
