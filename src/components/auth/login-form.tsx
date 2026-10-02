'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Activity, Loader2, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEMO_ACCOUNTS = [
  { email: 'doctor@demo.aiphysio.local', label: 'แพทย์' },
  { email: 'pt@demo.aiphysio.local', label: 'นักกายภาพบำบัด' },
  { email: 'patient1@demo.aiphysio.local', label: 'ผู้ป่วย' },
];

export function LoginForm({ callbackUrl, showDemoAccounts }: { callbackUrl: string; showDemoAccounts: boolean }) {
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center mx-auto mb-4">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">AI Physio</h1>
          <p className="text-sm text-muted-foreground mt-1">เข้าสู่ระบบเพื่อเริ่มต้นใช้งาน</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                เข้าสู่ระบบ
              </Button>
            </form>
          </CardContent>
        </Card>

        {showDemoAccounts && (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">บัญชีทดลอง (เฉพาะ development)</p>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className="flex w-full justify-between hover:text-foreground"
              >
                <span>{a.label}</span>
                <span className="font-mono">{a.email}</span>
              </button>
            ))}
            <p>รหัสผ่าน: ค่า SEED_DEMO_PASSWORD ใน .env</p>
          </div>
        )}
      </div>
    </div>
  );
}
