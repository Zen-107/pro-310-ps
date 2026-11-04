'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Mascot, type MascotMood } from '@/components/kids/mascot';

// The child's own น้องยืด that reacts when tapped: it squishes and jumps,
// changes face, says something and throws out little hearts and stars.
// Every so often it waves by itself. Reduced motion: face + words only.

const REACTIONS: { mood: MascotMood; say: string }[] = [
  { mood: 'cheer', say: 'เย้! ยืดกันเถอะ!' },
  { mood: 'wave', say: 'สวัสดีจ้า!' },
  { mood: 'happy', say: 'ฮิฮิ จั๊กจี้!' },
  { mood: 'stretch', say: 'ยืดดดดด~' },
  { mood: 'cheer', say: 'เก่งมากเลย!' },
  { mood: 'think', say: 'วันนี้เล่นท่าไหนดีนะ?' },
  { mood: 'happy', say: 'ชอบชุดนี้จัง!' },
];
const BITS = ['❤', '★', '❤', '★', '✦', '❤'];
const BIT_COLORS = ['#FF7A6B', '#FFC93C', '#FF8FA8', '#3BA7F5', '#9B7BEA', '#4CC38A'];

export function PlayfulMascot({
  avatar,
  size = 140,
  mood = 'happy',
  idleWave = true,
  bubbleSide = 'top',
  onReact,
  className = '',
}: {
  avatar?: string | null;
  size?: number;
  /** Face when not reacting */
  mood?: MascotMood;
  idleWave?: boolean;
  /** 'none': the parent shows the words itself (via onReact) */
  bubbleSide?: 'top' | 'none';
  /** Called with what the mascot says (null when the reaction ends) */
  onReact?: (say: string | null) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const [reaction, setReaction] = useState<{ mood: MascotMood; say: string; key: number } | null>(null);
  const [idle, setIdle] = useState<MascotMood | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(-1);

  // Waves by itself now and then
  useEffect(() => {
    if (!idleWave || reduce) return;
    const id = setInterval(() => {
      setIdle('wave');
      setTimeout(() => setIdle(null), 1800);
    }, 9000);
    return () => clearInterval(id);
  }, [idleWave, reduce]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function poke() {
    let i = Math.floor(Math.random() * REACTIONS.length);
    if (i === last.current) i = (i + 1) % REACTIONS.length;
    last.current = i;
    setReaction({ ...REACTIONS[i], key: Date.now() });
    onReact?.(REACTIONS[i].say);
    if (!reduce) {
      void controls.start({
        scaleX: [1, 1.18, 0.9, 1.04, 1],
        scaleY: [1, 0.8, 1.14, 0.97, 1],
        y: [0, 4, -size * 0.22, 0, 0],
        rotate: [0, 0, i % 2 ? 8 : -8, 0, 0],
        transition: { duration: 0.7, ease: 'easeOut' },
      });
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReaction(null);
      onReact?.(null);
    }, 1800);
  }

  const face = reaction?.mood ?? idle ?? mood;

  return (
    <div className={`relative inline-flex flex-col items-center ${className}`}>
      {bubbleSide === 'top' && (
        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <AnimatePresence>
            {reaction && (
              <motion.div
                key={reaction.key}
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="whitespace-nowrap rounded-2xl border-2 border-[var(--border)] bg-white px-3 py-1.5 text-base font-bold shadow-[0_3px_0_rgba(59,42,74,0.08)]"
              >
                {reaction.say}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <motion.button
        type="button"
        onClick={poke}
        animate={controls}
        whileTap={reduce ? undefined : { scale: 0.92 }}
        style={{ transformOrigin: '50% 90%' }}
        className="relative cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[var(--kids-sky)]"
        aria-label="แตะน้องยืด"
      >
        <Mascot avatar={avatar} mood={face} size={size} className={reduce ? '' : 'kids-bob'} />

        {/* Hearts and stars burst out */}
        <AnimatePresence>
          {reaction && !reduce &&
            BITS.map((b, i) => {
              const a = (Math.PI * 2 * i) / BITS.length - Math.PI / 2 + (reaction.key % 7) * 0.1;
              const d = size * 0.55;
              return (
                <motion.span
                  key={`${reaction.key}-${i}`}
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 text-xl font-bold"
                  style={{ color: BIT_COLORS[i % BIT_COLORS.length] }}
                  initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 0.4 }}
                  animate={{ x: `calc(-50% + ${Math.cos(a) * d}px)`, y: `calc(-50% + ${Math.sin(a) * d}px)`, opacity: 0, scale: 1.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                >
                  {b}
                </motion.span>
              );
            })}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
