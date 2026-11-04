'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Dices, Glasses, Lock, Palette, Shirt, Smile, Sparkles, Eye, Crown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Mascot } from '@/components/kids/mascot';
import { PlayfulMascot } from '@/components/kids/playful-mascot';
import {
  encodeLook,
  LOOK_PARTS,
  parseLook,
  randomLook,
  type LookOption,
  type LookPart,
  type MascotLook,
} from '@/lib/mascot-look';

// Wardrobe: the child picks colour, eyes, mouth, hat, outfit and glasses for
// their own น้องยืด. Some items unlock after more completed rounds — a reason
// to keep playing. Every option is shown as a small mascot wearing it.

const CATEGORIES: { part: LookPart; label: string; icon: React.ElementType; color: string }[] = [
  { part: 'color', label: 'สีตัว', icon: Palette, color: 'var(--kids-coral)' },
  { part: 'eyes', label: 'ตา', icon: Eye, color: 'var(--kids-sky)' },
  { part: 'mouth', label: 'ปาก', icon: Smile, color: 'var(--kids-grape)' },
  { part: 'hat', label: 'หมวก', icon: Crown, color: 'var(--kids-sun)' },
  { part: 'outfit', label: 'ชุด', icon: Shirt, color: 'var(--kids-grass)' },
  { part: 'glasses', label: 'แว่น', icon: Glasses, color: 'var(--kids-sky)' },
];

export function KidsWardrobe() {
  const [saved, setSaved] = useState<string | null>(null);
  const [look, setLook] = useState<MascotLook | null>(null);
  const [rounds, setRounds] = useState(0);
  const [part, setPart] = useState<LookPart>('color');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/avatar')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setRounds(d.rounds ?? 0);
        const l = parseLook(d.avatar);
        setLook(l);
        setSaved(encodeLook(l));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!look) return <Skeleton className="h-[520px] rounded-[28px]" />;

  const current = encodeLook(look);
  const changed = current !== saved;
  const cat = CATEGORIES.find((c) => c.part === part)!;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/me/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: current }),
      });
      if (!res.ok) throw new Error();
      setSaved(current);
      toast.success('น้องยืดแต่งตัวเสร็จแล้ว!');
    } catch {
      toast.error('บันทึกไม่ได้ ลองอีกครั้งนะ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl font-bold">แต่งตัวน้องยืด</h2>
        <span className="flex items-center gap-1 rounded-full bg-[var(--kids-sun)] px-3 py-1 text-base font-bold">
          <Sparkles className="h-4 w-4" /> เล่นแล้ว {rounds} รอบ
        </span>
      </div>

      {/* Big preview: tap it to see a reaction */}
      <div className="kids-card flex flex-col items-center gap-2 px-4 pb-5 pt-14">
        <PlayfulMascot avatar={current} size={200} idleWave={false} />
        <p className="text-sm text-[var(--kids-ink-soft)]">แตะน้องยืดดูสิ!</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="kids-btn kids-btn-grape px-5 py-3 text-lg"
            onClick={() => setLook(randomLook(rounds))}
          >
            <Dices className="h-5 w-5" /> สุ่มชุด
          </button>
          <button type="button" className="kids-btn kids-btn-grass px-6 py-3 text-lg" disabled={!changed || saving} onClick={save}>
            {changed ? 'แต่งเสร็จแล้ว!' : 'ใส่ชุดนี้อยู่'}
          </button>
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = c.part === part;
          return (
            <button
              key={c.part}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPart(c.part)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-4 py-2 text-base font-bold transition-colors ${
                active ? 'border-transparent text-white' : 'border-[var(--border)] bg-white'
              }`}
              style={active ? { background: c.color } : undefined}
            >
              <Icon className="h-5 w-5" /> {c.label}
            </button>
          );
        })}
      </div>

      {/* Options: each one is a small mascot wearing it */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" role="tabpanel" aria-label={cat.label}>
        {(LOOK_PARTS[part] as LookOption[]).map((o) => {
          const locked = (o.unlock ?? 0) > rounds;
          const picked = look[part] === o.id;
          const preview = encodeLook({ ...look, [part]: o.id });
          return (
            <motion.button
              key={o.id}
              type="button"
              whileTap={locked ? { x: [0, -6, 6, -4, 0] } : { scale: 0.94 }}
              onClick={() => {
                if (locked) {
                  toast.info(`เล่นอีก ${o.unlock! - rounds} รอบ เพื่อปลดล็อก "${o.label}"`);
                  return;
                }
                setLook({ ...look, [part]: o.id });
              }}
              aria-pressed={picked}
              aria-label={locked ? `${o.label} (ล็อกอยู่)` : o.label}
              className={`relative flex flex-col items-center gap-1 rounded-[22px] border-2 bg-white p-2 pb-3 ${
                picked ? 'border-[var(--kids-grass-deep)] shadow-[0_0_0_3px_var(--kids-grass)]' : 'border-[var(--border)]'
              }`}
            >
              <span className={locked ? 'opacity-40 grayscale' : ''}>
                <Mascot avatar={preview} size={84} />
              </span>
              <span className="text-sm font-bold">{o.label}</span>
              {locked && (
                <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-[var(--kids-ink)] px-2 py-0.5 text-xs font-bold text-white">
                  <Lock className="h-3 w-3" /> {o.unlock}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
