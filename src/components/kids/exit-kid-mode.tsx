'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Delete, Loader2, LogOut, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

// "ออก" in the kid header. A child who signed in with their own code just
// signs out; a child an adult switched to needs that adult's 4-digit PIN.
export function ExitKidMode({ returnName }: { returnName: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!returnName) {
    return (
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-[var(--kids-ink-soft)] hover:bg-[var(--muted)]"
        aria-label="ออกจากระบบ"
      >
        <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">ออก</span>
      </button>
    );
  }

  async function submit(full: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/me/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: full }),
      });
      if (!res.ok) {
        setError(res.status === 429 ? 'ลองหลายครั้งเกินไป รอสักครู่' : 'PIN ไม่ถูกต้อง');
        setPin('');
        return;
      }
      const { ticket } = await res.json();
      const login = await signIn('ticket', { ticket, redirect: false });
      if (!login || login.error) {
        setError('กลับไม่สำเร็จ ลองใหม่');
        return;
      }
      // Back on the adult's first tab (each adult shell falls back to its own)
      useAppStore.getState().setActiveTab('classes');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-[var(--kids-ink-soft)] hover:bg-[var(--muted)]"
        aria-label={`ออกจากโหมดเด็ก (กลับไปบัญชี ${returnName})`}
      >
        <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">ออก</span>
      </button>
      {/* Portal: the header's backdrop blur would otherwise trap this fixed overlay inside it */}
      {open && createPortal(
        <div className="theme-kids fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(59,42,74,0.5)' }} role="dialog" aria-modal="true" aria-label="ใส่ PIN ผู้ใหญ่">
          <div className="w-full max-w-xs space-y-4 rounded-[28px] bg-white p-5 text-center">
            <div className="flex items-start justify-between">
              <div className="text-left">
                <p className="text-lg font-bold">สำหรับผู้ใหญ่</p>
                <p className="text-sm text-[var(--kids-ink-soft)]">ใส่ PIN ของ {returnName}</p>
              </div>
              <button onClick={() => { setOpen(false); setPin(''); setError(null); }} aria-label="ปิด" className="rounded-full p-2 hover:bg-[var(--muted)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-center gap-3" aria-live="polite">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-[var(--kids-ink)]' : 'bg-[var(--border)]'}`} />
              ))}
            </div>
            {error && <p className="text-sm text-[var(--kids-coral-deep)]">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button key={d} onClick={() => press(d)} className="h-14 rounded-2xl bg-[var(--muted)] text-2xl font-bold active:scale-95">
                  {d}
                </button>
              ))}
              <span />
              <button onClick={() => press('0')} className="h-14 rounded-2xl bg-[var(--muted)] text-2xl font-bold active:scale-95">
                0
              </button>
              <button onClick={() => setPin(pin.slice(0, -1))} className="flex h-14 items-center justify-center rounded-2xl" aria-label="ลบ">
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Delete className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
