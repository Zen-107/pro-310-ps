'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SessionUser } from '@/lib/auth-guard';
import { ROLE_LABELS } from '@/lib/roles';

// Adult account: who is signed in and the 4-digit PIN for leaving kid mode.
export function AccountSettings({ user }: { user: SessionUser }) {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/me/pin')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHasPin(!!d?.hasPin))
      .catch(() => setHasPin(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/me/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, password }),
      });
      if (res.status === 403) {
        toast.error('รหัสผ่านไม่ถูกต้อง');
        return;
      }
      if (!res.ok) {
        toast.error('PIN ต้องเป็นตัวเลข 4 หลัก');
        return;
      }
      setHasPin(true);
      setPin('');
      setPassword('');
      toast.success('บันทึก PIN แล้ว');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5" id="pin">
      <div>
        <h2 className="text-2xl font-bold">บัญชีของฉัน</h2>
        <p className="text-sm text-muted-foreground">
          {user.name} · {user.email} · {ROLE_LABELS[user.role]}
        </p>
      </div>

      <form onSubmit={save} className="space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <p className="flex items-center gap-1.5 font-semibold">
            <KeyRound className="h-4 w-4" /> PIN ผู้ใหญ่ (4 หลัก)
          </p>
          <p className="text-sm text-muted-foreground">
            ใช้ตอนกด &quot;ออก&quot; จากโหมดเด็ก หลังจากให้เด็กเล่นด้วยบัญชีนี้ เด็กจะออกไปหน้าผู้ใหญ่เองไม่ได้
            {hasPin === null ? '' : hasPin ? ' · ตั้งแล้ว' : ' · ยังไม่ได้ตั้ง'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="pin" className="text-sm font-medium">PIN ใหม่</label>
            <Input
              id="pin"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              required
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="font-mono text-lg tracking-[0.5em]"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="pin-password" className="text-sm font-medium">รหัสผ่านบัญชี (ยืนยัน)</label>
            <Input id="pin-password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saving || pin.length !== 4 || !password}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {hasPin ? 'เปลี่ยน PIN' : 'ตั้ง PIN'}
        </Button>
      </form>
    </div>
  );
}
