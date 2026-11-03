'use client';

import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Mascot } from '@/components/kids/mascot';
import { PICTURES } from '@/lib/kid-codes';

// Printable login cards: the child's code + 3 pictures (cut along the line),
// and the parent's link code for signing up. Shown right after creating
// students or resetting pictures — the pictures are not stored readable.

export interface KidCard {
  name: string;
  nickname?: string | null;
  avatar?: string | null;
  kidCode: string | null;
  pictures?: string[] | null;
  parentLinkCode?: string | null;
}

const pic = (id: string) => PICTURES.find((p) => p.id === id);

export function KidCards({ cards, onClose }: { cards: KidCard[]; onClose: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border-2 border-[var(--kids-sun)] bg-[#fffbea] p-4" data-print-root>
      <div className="flex flex-wrap items-center justify-between gap-2" data-print-hide>
        <div>
          <p className="font-semibold">บัตรเข้าใช้งาน {cards.length} ใบ</p>
          <p className="text-sm text-muted-foreground">พิมพ์หรือถ่ายรูปเก็บไว้ตอนนี้ รูปภาพรหัสจะไม่แสดงอีก (รีเซ็ตใหม่ได้)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> พิมพ์บัตร
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" /> ปิด
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.kidCode ?? c.name} className="break-inside-avoid rounded-2xl border-2 border-dashed border-[var(--kids-ink-soft)] bg-white p-4">
            <div className="flex items-center gap-2">
              <Mascot mood="happy" size={44} avatar={c.avatar} />
              <div>
                <p className="font-display text-xl font-bold leading-tight">{c.nickname || c.name}</p>
                <p className="text-xs text-muted-foreground">{c.nickname ? c.name : 'บัตรเข้าเล่น AI Physio Kids'}</p>
              </div>
            </div>
            {c.kidCode && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">รหัสของหนู</p>
                <p className="font-mono text-3xl font-bold tracking-[0.25em]">{c.kidCode}</p>
              </div>
            )}
            {c.pictures && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">แตะรูปตามลำดับ</p>
                <div className="mt-1 flex gap-2">
                  {c.pictures.map((id, i) => (
                    <div key={i} className="flex flex-col items-center rounded-xl bg-[var(--muted)] px-2.5 py-1.5">
                      <span className="text-3xl">{pic(id)?.emoji}</span>
                      <span className="text-[11px]">
                        {i + 1}. {pic(id)?.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {c.parentLinkCode && (
              <p className="mt-3 border-t border-dashed pt-2 text-xs text-muted-foreground">
                สำหรับผู้ปกครอง: สมัครที่หน้าเข้าสู่ระบบ › &quot;สมัครด้วยรหัสจากคุณครู&quot; รหัส{' '}
                <span className="font-mono font-semibold text-[var(--kids-ink)]">{c.parentLinkCode}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
