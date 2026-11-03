'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KidLogin } from '@/components/auth/kid-login';
import { Mascot } from '@/components/kids/mascot';
import { DEMO_ADULTS, DEMO_KIDS } from '@/lib/demo-accounts';
import { PICTURES } from '@/lib/kid-codes';

type Tab = 'kid' | 'adult';

// Sign-in: kids (code + pictures) and adults (email + password) on one page.
export function LoginForm({ callbackUrl, showDemoAccounts }: { callbackUrl: string; showDemoAccounts: boolean }) {
  const [tab, setTab] = useState<Tab>('kid');

  return (
    <div className={`min-h-screen px-4 py-8 ${tab === 'kid' ? 'theme-kids' : 'theme-adult'}`}>
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Mascot mood="happy" size={56} />
          <div>
            <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: 'var(--font-mali)' }}>
              AI Physio Kids
            </h1>
            <p className="text-sm text-[var(--kids-ink-soft)]">ยืด ขยับ แข็งแรง ทุกวัน</p>
          </div>
        </div>

        <div role="tablist" aria-label="เลือกผู้ใช้" className="grid grid-cols-2 gap-2 rounded-full bg-white p-1.5 shadow-[0_4px_0_rgba(59,42,74,0.06)]">
          {([
            ['kid', 'ฉันเป็นเด็ก'],
            ['adult', 'ผู้ปกครอง / คุณครู'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`min-h-12 rounded-full px-3 font-bold transition-colors ${
                tab === id ? 'bg-[var(--kids-sky)] text-white' : 'text-[var(--kids-ink-soft)] hover:bg-[var(--muted)]'
              }`}
              style={{ fontFamily: 'var(--font-mali)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'kid' ? <KidLogin callbackUrl={callbackUrl} /> : <AdultLogin callbackUrl={callbackUrl} />}

        {showDemoAccounts && <DemoAccounts tab={tab} />}
      </div>
    </div>
  );
}

function AdultLogin({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (!res || res.error) {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">อีเมล</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            data-demo-email
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">รหัสผ่าน</label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          เข้าสู่ระบบ
        </Button>
      </form>
      <Link
        href="/register"
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed bg-white/60 p-4 text-sm hover:bg-white"
      >
        <UserPlus className="h-4 w-4" />
        ผู้ปกครองใหม่? <span className="font-semibold text-primary">สมัครด้วยรหัสจากคุณครู</span>
      </Link>
    </div>
  );
}

function DemoAccounts({ tab }: { tab: Tab }) {
  const emoji = (id: string) => PICTURES.find((p) => p.id === id)?.emoji ?? id;
  return (
    <div className="space-y-1.5 rounded-2xl border border-dashed bg-white/70 p-3 text-xs text-[var(--kids-ink-soft)]">
      <p className="font-semibold text-[var(--kids-ink)]">บัญชีทดลอง (เฉพาะ development)</p>
      {tab === 'kid' ? (
        DEMO_KIDS.map((k) => (
          <div key={k.kidCode} className="flex justify-between gap-2">
            <span>
              {k.nickname} (ป.{k.classroom === 1 ? '3/1' : '5/2'})
            </span>
            <span className="font-mono">
              {k.kidCode} · {k.pictures.map(emoji).join(' ')}
            </span>
          </div>
        ))
      ) : (
        <>
          {DEMO_ADULTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('[data-demo-email]');
                if (!input) return;
                // Fill the controlled input the way typing would
                Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, a.email);
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }}
              className="flex w-full justify-between gap-2 hover:text-[var(--kids-ink)]"
            >
              <span>{a.label}</span>
              <span className="font-mono">{a.email}</span>
            </button>
          ))}
          <p>รหัสผ่าน: ค่า SEED_DEMO_PASSWORD ใน .env · PIN ผู้ใหญ่: 1234</p>
        </>
      )}
      <p>ปุยฝ้าย (PUNCH2) ยังไม่มีผู้ปกครองยินยอม: ใช้ทดสอบหน้ารอความยินยอม</p>
    </div>
  );
}
