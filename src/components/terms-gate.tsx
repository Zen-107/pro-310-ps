'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Activity, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TERMS_ACCEPT_LABEL, TERMS_TITLE, type TermsSection } from '@/lib/terms';

/**
 * Blocking consent popup shown on entry until the user accepts the current
 * terms. It cannot be dismissed (no close button, Escape or outside click);
 * the only ways out are accepting or signing out. The page renders nothing
 * else meanwhile, and the API refuses requests (TERMS_REQUIRED) as well.
 */
export function TermsGate({
  userName,
  sections,
  version,
}: {
  userName: string;
  sections: TermsSection[];
  version: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Keep keyboard focus inside the dialog
  useEffect(() => {
    const el = dialogRef.current;
    el?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
      if (e.key !== 'Tab' || !el) return;
      const focusable = el.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const accept = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/me/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept: true, version }),
      });
      if (res.status === 409) {
        toast.info('ข้อตกลงมีการปรับปรุง กรุณาอ่านฉบับล่าสุดอีกครั้ง');
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error();
      router.refresh(); // server re-renders the app now that terms are accepted
    } catch {
      toast.error('บันทึกการยอมรับไม่สำเร็จ กรุณาลองใหม่');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        tabIndex={-1}
        className="flex max-h-[min(90dvh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl outline-none"
      >
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 id="terms-title" className="text-base font-bold leading-tight">
              {TERMS_TITLE}
            </h2>
            <p className="text-xs text-muted-foreground">
              สวัสดี {userName} · กรุณาอ่านและยอมรับก่อนเข้าใช้งาน AI Physio
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed">
          {sections.map((s) => (
            <section key={s.heading}>
              <h3 className="mb-1.5 font-semibold">{s.heading}</h3>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-xs text-muted-foreground">ฉบับ {version}</p>
        </div>

        <div className="space-y-3 border-t bg-muted/30 px-5 py-4">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>{TERMS_ACCEPT_LABEL}</span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={saving} onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="h-4 w-4" /> ไม่ยอมรับและออกจากระบบ
            </Button>
            <Button className="bg-teal-600 text-white hover:bg-teal-700" disabled={!checked || saving} onClick={accept}>
              <ShieldCheck className="h-4 w-4" /> {saving ? 'กำลังบันทึก...' : 'ยอมรับและเข้าใช้งาน'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
