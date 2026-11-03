'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mascot } from '@/components/kids/mascot';
import { normalizeCode, PARENT_CODE_LENGTH } from '@/lib/kid-codes';

const ERRORS: Record<number, string> = {
  404: 'ไม่พบรหัสนี้ กรุณาตรวจรหัสในบัตรจากคุณครูอีกครั้ง',
  409: 'อีเมลนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบแล้วเพิ่มบุตรหลานได้ในหน้าผู้ปกครอง',
};

// Parent sign-up: the 8-character link code on the child's card proves the
// parent knows the child; the account is linked and signed in right away.
export function ParentRegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ linkCode: '', name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, linkCode: normalizeCode(form.linkCode) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(ERRORS[res.status] ?? (res.status === 400 ? `ข้อมูลไม่ครบ: ${body?.error ?? ''}` : 'สมัครไม่สำเร็จ กรุณาลองใหม่'));
        return;
      }
      const login = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      router.replace(login?.error ? '/login' : '/');
      router.refresh();
    } catch {
      setError('เชื่อมต่อไม่ได้ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="theme-adult min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <Mascot mood="wave" size={72} />
          <div>
            <h1 className="text-2xl font-bold">สมัครบัญชีผู้ปกครอง</h1>
            <p className="text-sm text-muted-foreground">ใช้รหัสผู้ปกครอง 8 ตัวในบัตรที่ได้จากคุณครู</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <label htmlFor="linkCode" className="text-sm font-medium">รหัสผู้ปกครอง</label>
            <Input
              id="linkCode"
              required
              autoComplete="off"
              maxLength={PARENT_CODE_LENGTH + 2}
              className="font-mono text-lg tracking-[0.3em] uppercase"
              value={form.linkCode}
              onChange={set('linkCode')}
              placeholder="เช่น MEWHAPPY"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">ชื่อของท่าน</label>
            <Input id="name" required autoComplete="name" value={form.name} onChange={set('name')} placeholder="เช่น คุณแม่น้ำฝน" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">อีเมล</label>
            <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">รหัสผ่าน (อย่างน้อย 8 ตัว)</label>
            <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            สมัครและเข้าสู่ระบบ
          </Button>
          <p className="text-xs text-muted-foreground">
            หลังสมัคร ระบบจะให้ท่านอ่านข้อตกลงและให้ความยินยอมแทนบุตรหลาน เด็กจึงจะเริ่มเล่นได้
          </p>
        </form>

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
