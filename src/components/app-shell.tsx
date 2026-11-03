'use client';

import { useSyncExternalStore } from 'react';
import { signOut } from 'next-auth/react';
import { LogOut, ShieldAlert } from 'lucide-react';
import type { SessionUser } from '@/lib/auth-guard';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/components/kids/mascot';
import { KidsShell } from '@/components/kids/kids-shell';
import { TeacherShell } from '@/components/teacher/teacher-shell';
import { ParentShell } from '@/components/parent/parent-shell';
import { ExpertShell } from '@/components/expert/expert-shell';

// Role router: every role has its own shell (docs/FLOWS.md).
//   PATIENT → kid screens · TEACHER → classes · PARENT → my children · CLINICIAN → expert
export function AppShell({ user }: { user: SessionUser }) {
  // Client-only rendering (the shells read browser APIs and the store)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div className="theme-kids flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Mascot mood="happy" size={96} className="kids-bob mx-auto" />
          <p className="mt-2 text-lg font-bold">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  switch (user.role) {
    case 'PATIENT':
      return <KidsShell user={user} />;
    case 'TEACHER':
      return <TeacherShell user={user} />;
    case 'PARENT':
      return <ParentShell user={user} />;
    case 'CLINICIAN':
      return <ExpertShell user={user} />;
    default:
      // Admin accounts have no screens yet
      return (
        <div className="theme-adult flex min-h-screen items-center justify-center px-4">
          <div className="max-w-sm space-y-4 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              บัญชีผู้ดูแลระบบยังไม่มีหน้าจัดการ กรุณาเข้าสู่ระบบด้วยบัญชีคุณครู ผู้ปกครอง หรือผู้เชี่ยวชาญ
            </p>
            <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="h-4 w-4" /> ออกจากระบบ
            </Button>
          </div>
        </div>
      );
  }
}
