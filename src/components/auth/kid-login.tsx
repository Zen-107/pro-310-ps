'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Delete, Loader2 } from 'lucide-react';
import { Mascot, type MascotMood } from '@/components/kids/mascot';
import { isKidCode, KID_CODE_LENGTH, normalizeCode, PICTURE_PIN_LENGTH, PICTURES, type PictureId } from '@/lib/kid-codes';

// Kid sign-in: 1) type the code from the card, 2) tap the 3 pictures in order.
// Big targets, almost no reading, the mascot gives the feedback.

export function KidLogin({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'code' | 'pictures'>('code');
  const [picked, setPicked] = useState<PictureId[]>([]);
  const [mood, setMood] = useState<MascotMood>('wave');
  const [message, setMessage] = useState('พิมพ์รหัสในบัตรของหนูนะ');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function nextFromCode() {
    if (!isKidCode(code)) {
      setMood('think');
      setMessage(`รหัสมี ${KID_CODE_LENGTH} ตัว ลองดูบัตรอีกทีนะ`);
      return;
    }
    setStep('pictures');
    setPicked([]);
    setMood('happy');
    setMessage('แตะรูป 3 รูป เรียงตามบัตรเลย');
  }

  async function pick(id: PictureId) {
    if (submitting || picked.length >= PICTURE_PIN_LENGTH) return;
    const next = [...picked, id];
    setPicked(next);
    if (next.length < PICTURE_PIN_LENGTH) return;

    setSubmitting(true);
    setMood('think');
    setMessage('กำลังเปิดประตู...');
    try {
      const res = await signIn('kid-code', { code, pictures: JSON.stringify(next), redirect: false });
      if (!res || res.error) {
        setMood('think');
        setMessage('ยังไม่ใช่ ลองใหม่อีกทีนะ (ถ้าลืม ถามคุณครูได้เลย)');
        setPicked([]);
        return;
      }
      setMood('cheer');
      setMessage('เย้! ไปเล่นกันเลย');
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setMessage('เชื่อมต่อไม่ได้ ลองใหม่อีกทีนะ');
      setPicked([]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <Mascot mood={mood} size={104} className="kids-bob shrink-0" />
        <p role="status" className="mb-5 rounded-[22px] border-2 border-[var(--border)] bg-white px-4 py-3 text-lg font-bold leading-snug">
          {message}
        </p>
      </div>

      {step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            nextFromCode();
          }}
          className="space-y-4"
        >
          <label htmlFor="kid-code" className="sr-only">
            รหัสเด็ก
          </label>
          {/* One real input under six visual boxes */}
          <div className="relative" onClick={() => inputRef.current?.focus()}>
            <input
              ref={inputRef}
              id="kid-code"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              maxLength={KID_CODE_LENGTH + 2}
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, KID_CODE_LENGTH))}
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
            <div className="grid grid-cols-6 gap-2" aria-hidden>
              {Array.from({ length: KID_CODE_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={`flex h-16 items-center justify-center rounded-2xl border-[3px] bg-white text-3xl font-bold ${
                    i === code.length ? 'border-[var(--kids-sky)]' : 'border-[var(--border)]'
                  }`}
                >
                  {code[i] ?? ''}
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="kids-btn kids-btn-sky w-full" disabled={code.length === 0}>
            ต่อไป <ArrowRight className="h-6 w-6" />
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3" aria-label={`เลือกแล้ว ${picked.length} จาก 3`}>
            {Array.from({ length: PICTURE_PIN_LENGTH }, (_, i) => {
              const p = PICTURES.find((x) => x.id === picked[i]);
              return (
                <div
                  key={i}
                  className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] text-4xl ${
                    p ? 'border-[var(--kids-grass)] bg-[#effaf4]' : 'border-dashed border-[var(--border)] bg-white'
                  }`}
                >
                  {p ? '⭐' : i + 1}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PICTURES.map((p) => (
              <motion.button
                key={p.id}
                type="button"
                whileTap={{ scale: 0.9 }}
                disabled={submitting}
                onClick={() => pick(p.id)}
                className="kids-card flex aspect-square flex-col items-center justify-center gap-1 text-5xl disabled:opacity-60"
                aria-label={p.label}
              >
                <span aria-hidden>{p.emoji}</span>
                <span className="text-base font-bold">{p.label}</span>
              </motion.button>
            ))}
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              className="flex min-h-12 items-center gap-1 rounded-full px-4 text-lg text-[var(--kids-ink-soft)]"
              onClick={() => {
                setStep('code');
                setMood('wave');
                setMessage('พิมพ์รหัสในบัตรของหนูนะ');
              }}
            >
              <ArrowLeft className="h-5 w-5" /> แก้รหัส
            </button>
            <button
              type="button"
              className="flex min-h-12 items-center gap-1 rounded-full px-4 text-lg text-[var(--kids-ink-soft)] disabled:opacity-40"
              disabled={picked.length === 0 || submitting}
              onClick={() => setPicked(picked.slice(0, -1))}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Delete className="h-5 w-5" />} ลบรูป
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
