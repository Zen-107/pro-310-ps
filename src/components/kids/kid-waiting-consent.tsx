'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Mascot } from '@/components/kids/mascot';

// Shown instead of the terms popup to a child whose parent has not consented
// yet: no legal text for kids, just who to ask.
export function KidWaitingConsent({ name }: { name: string }) {
  return (
    <div className="theme-kids flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm space-y-4 text-center">
        <Mascot mood="sleepy" size={140} className="kids-bob mx-auto" />
        <h1 className="text-2xl font-bold">สวัสดี {name}!</h1>
        <p className="text-lg leading-relaxed">
          ก่อนเล่น ต้องให้คุณพ่อคุณแม่ (หรือผู้ปกครอง) กด &quot;ยินยอม&quot; ในบัญชีผู้ปกครองก่อนนะ
        </p>
        <p className="text-base text-[var(--kids-ink-soft)]">บอกคุณครูหรือผู้ปกครองได้เลย แล้วกลับมาเล่นกันใหม่</p>
        <button className="kids-btn kids-btn-sky" onClick={() => signOut({ callbackUrl: '/login' })}>
          <LogOut className="h-5 w-5" /> กลับหน้าแรก
        </button>
      </div>
    </div>
  );
}
