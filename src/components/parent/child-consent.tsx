'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { VIDEO_CONSENT_POINTS, VIDEO_CONSENT_TITLE } from '@/lib/consent';
import { TERMS_ACCEPT_LABEL, TERMS_VERSION, termsFor } from '@/lib/terms';

export interface ConsentState {
  canPlay: boolean;
  terms: boolean;
  schoolConsent: boolean;
  video: boolean;
}

// A parent's decisions for one child: the terms (lets the child play) and
// video recording (optional; withdrawing deletes every recorded video).
export function ChildConsent({
  childId,
  childName,
  consent,
  onChanged,
}: {
  childId: string;
  childName: string;
  consent: ConsentState;
  onChanged: () => void;
}) {
  const [reading, setReading] = useState(!consent.terms);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function post(body: Record<string, unknown>, ok: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/kids/${childId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        toast.info('ข้อตกลงมีการปรับปรุง กรุณาอ่านฉบับล่าสุด');
        return;
      }
      if (!res.ok) throw new Error();
      const d = await res.json();
      toast.success(d.videosDeleted ? `${ok} (ลบวิดีโอ ${d.videosDeleted} ไฟล์แล้ว)` : ok);
      onChanged();
    } catch {
      toast.error('บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4 text-[var(--kids-grass-deep)]" /> ข้อตกลงและความยินยอมแทน{childName}
            </p>
            <p className="text-sm text-muted-foreground">
              {consent.terms
                ? 'ยินยอมแล้ว น้องเล่นได้'
                : consent.schoolConsent
                  ? 'โรงเรียนได้รับหนังสือยินยอมแล้ว (ยืนยันออนไลน์ได้ด้านล่าง)'
                  : 'ต้องยินยอมก่อน น้องจึงจะเล่นได้'}
            </p>
          </div>
          {consent.terms && !reading && (
            <Button variant="outline" size="sm" onClick={() => setReading(true)}>
              อ่านข้อตกลง
            </Button>
          )}
        </div>

        {reading && (
          <div className="space-y-3">
            <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl bg-muted/40 p-3 text-sm">
              {termsFor('PARENT').map((s) => (
                <section key={s.heading}>
                  <p className="font-semibold">{s.heading}</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {consent.terms ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setReading(false)}>
                  ปิด
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  disabled={saving}
                  onClick={() => confirm(`ถอนความยินยอม? ${childName}จะเล่นต่อไม่ได้`) && post({ terms: false }, 'ถอนความยินยอมแล้ว')}
                >
                  ถอนความยินยอม
                </Button>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                  <span>{TERMS_ACCEPT_LABEL} แทน{childName}</span>
                </label>
                <Button disabled={!checked || saving} onClick={() => post({ terms: true, version: TERMS_VERSION }, `${childName}เล่นได้แล้ว`)}>
                  <ShieldCheck className="h-4 w-4" /> ยินยอมแทนบุตรหลาน
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-2xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 font-semibold">
              <Video className="h-4 w-4 text-[var(--kids-sky-deep)]" /> {VIDEO_CONSENT_TITLE}
            </p>
            <p className="text-sm text-muted-foreground">ไม่บังคับ · {consent.video ? 'บันทึกวิดีโอได้' : 'ไม่บันทึกวิดีโอ'}</p>
          </div>
          <Switch
            checked={consent.video}
            disabled={saving}
            aria-label="อนุญาตให้บันทึกวิดีโอ"
            onCheckedChange={(v) => {
              if (!v && !confirm('ปิดการบันทึกวิดีโอ? วิดีโอที่บันทึกไว้ทั้งหมดจะถูกลบถาวร')) return;
              void post({ video: v }, v ? 'อนุญาตให้บันทึกวิดีโอแล้ว' : 'ปิดการบันทึกวิดีโอแล้ว');
            }}
          />
        </div>
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {VIDEO_CONSENT_POINTS.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
