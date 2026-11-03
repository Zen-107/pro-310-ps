'use client';

import { avatarColors } from '@/lib/kids';

// "น้องยืด" — the kids mascot: a soft round mochi with a leaf sprout that
// sways, big shiny eyes that blink, and stretchy little arms.
// Spec: docs/KIDS-ART-UI.md §3. Body colour follows the child's avatar.

export type MascotMood = 'happy' | 'cheer' | 'stretch' | 'sleepy' | 'think' | 'wave';

const INK = '#3B2A4A';
const CHEEK = '#FF8FA8';
const LEAF = '#6CCB8A';
const LEAF_DARK = '#3E9E62';

export function Mascot({
  mood = 'happy',
  size = 120,
  avatar,
  className = '',
  title = 'น้องยืด',
}: {
  mood?: MascotMood;
  size?: number;
  /** Avatar colour key (lib/kids.ts AVATARS); default peach */
  avatar?: string | null;
  className?: string;
  title?: string;
}) {
  const { body, belly } = avatarColors(avatar);
  const stretch = mood === 'stretch';
  // Body geometry: "stretch" is taller and thinner
  const cy = stretch ? 134 : 146;
  const rx = stretch ? 66 : 76;
  const ry = stretch ? 80 : 66;
  const top = cy - ry;
  const eyeY = cy - (stretch ? 22 : 14);
  const footY = cy + ry - 6;

  return (
    <svg viewBox="0 0 240 240" width={size} height={size} className={className} role="img" aria-label={title}>
      {/* Ground shadow */}
      <ellipse cx={120} cy={226} rx={stretch ? 52 : 62} ry={7} fill={INK} opacity={0.1} />

      {/* Sprout (sways) */}
      <g className="mascot-sway" style={{ transformOrigin: `120px ${top + 4}px` }}>
        <path d={`M120 ${top + 4} Q118 ${top - 14} 122 ${top - 26}`} stroke={LEAF_DARK} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={`M122 ${top - 22} Q140 ${top - 44} 160 ${top - 30} Q142 ${top - 14} 122 ${top - 22} Z`} fill={LEAF} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d={`M120 ${top - 16} Q104 ${top - 36} 86 ${top - 26} Q100 ${top - 10} 120 ${top - 16} Z`} fill={LEAF} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      </g>

      {/* Arms (outlined capsules) */}
      <Arms mood={mood} cy={cy} rx={rx} top={top} body={body} />

      {/* Feet */}
      <g stroke={INK} strokeWidth={5}>
        <ellipse cx={92} cy={footY} rx={20} ry={11} fill={body} />
        <ellipse cx={148} cy={footY} rx={20} ry={11} fill={body} />
      </g>

      {/* Body + belly */}
      <ellipse cx={120} cy={cy} rx={rx} ry={ry} fill={body} stroke={INK} strokeWidth={6} />
      <ellipse cx={120} cy={cy + ry * 0.38} rx={rx * 0.55} ry={ry * 0.42} fill={belly} />
      {/* Soft shine */}
      <ellipse cx={86} cy={cy - ry * 0.55} rx={14} ry={8} fill="#fff" opacity={0.45} transform={`rotate(-30 86 ${cy - ry * 0.55})`} />

      {/* Cheeks */}
      <ellipse cx={80} cy={eyeY + 26} rx={12} ry={7} fill={CHEEK} opacity={0.75} />
      <ellipse cx={160} cy={eyeY + 26} rx={12} ry={7} fill={CHEEK} opacity={0.75} />

      <Eyes mood={mood} y={eyeY} />
      <Mouth mood={mood} y={eyeY + 24} />

      {/* Extras */}
      {mood === 'sleepy' && (
        <g fill={INK} fontFamily="var(--font-mali), sans-serif" fontWeight={700}>
          <text x={186} y={70} fontSize={28}>z</text>
          <text x={206} y={46} fontSize={20}>z</text>
        </g>
      )}
      {mood === 'think' && (
        <text x={190} y={76} fontSize={44} fontWeight={700} fill="#9B7BEA" stroke={INK} strokeWidth={2} fontFamily="var(--font-mali), sans-serif">
          ?
        </text>
      )}
      {mood === 'cheer' && (
        <g fill="#FFC93C" stroke={INK} strokeWidth={3} strokeLinejoin="round">
          <Star cx={34} cy={74} r={15} />
          <Star cx={206} cy={92} r={12} />
          <Star cx={196} cy={30} r={8} />
        </g>
      )}
    </svg>
  );
}

function Arms({ mood, cy, rx, top, body }: { mood: MascotMood; cy: number; rx: number; top: number; body: string }) {
  const lx = 120 - rx + 6;
  const rxx = 120 + rx - 6;
  let left: string;
  let right: string;
  switch (mood) {
    case 'cheer':
    case 'stretch':
      left = `M${lx + 4} ${cy - 10} Q${lx - 22} ${cy - 50} ${lx - 6} ${top - 6}`;
      right = `M${rxx - 4} ${cy - 10} Q${rxx + 22} ${cy - 50} ${rxx + 6} ${top - 6}`;
      break;
    case 'wave':
    case 'happy':
      left = `M${lx + 4} ${cy + 6} Q${lx - 18} ${cy + 16} ${lx - 12} ${cy + 34}`;
      right = `M${rxx - 4} ${cy - 4} Q${rxx + 24} ${cy - 20} ${rxx + 16} ${cy - 52}`;
      break;
    case 'think':
      left = `M${lx + 4} ${cy + 6} Q${lx - 18} ${cy + 16} ${lx - 12} ${cy + 34}`;
      right = `M${rxx - 4} ${cy + 10} Q${rxx - 4} ${cy - 6} ${rxx - 30} ${cy - 2}`;
      break;
    default:
      left = `M${lx + 4} ${cy + 6} Q${lx - 14} ${cy + 22} ${lx - 4} ${cy + 38}`;
      right = `M${rxx - 4} ${cy + 6} Q${rxx + 14} ${cy + 22} ${rxx + 4} ${cy + 38}`;
  }
  const waving = mood === 'wave';
  return (
    <g fill="none" strokeLinecap="round">
      {[left, right].map((d, i) => (
        <g key={i} className={waving && i === 1 ? 'mascot-wave' : undefined} style={waving && i === 1 ? { transformOrigin: `${rxx}px ${cy}px` } : undefined}>
          <path d={d} stroke={INK} strokeWidth={20} />
          <path d={d} stroke={body} strokeWidth={11} />
        </g>
      ))}
    </g>
  );
}

function Eyes({ mood, y }: { mood: MascotMood; y: number }) {
  if (mood === 'cheer') {
    return (
      <g stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={`M86 ${y + 4} L96 ${y - 7} L106 ${y + 4}`} />
        <path d={`M134 ${y + 4} L144 ${y - 7} L154 ${y + 4}`} />
      </g>
    );
  }
  if (mood === 'sleepy') {
    return (
      <g stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
        <path d={`M84 ${y} Q96 ${y + 9} 108 ${y}`} />
        <path d={`M132 ${y} Q144 ${y + 9} 156 ${y}`} />
      </g>
    );
  }
  // Big shiny eyes that blink
  return (
    <g className="mascot-blink" style={{ transformOrigin: `120px ${y}px` }}>
      {[96, 144].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={12} ry={15} fill={INK} />
          <circle cx={x + 4} cy={y - 6} r={5} fill="#fff" />
          <circle cx={x - 4} cy={y + 5} r={2.4} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Mouth({ mood, y }: { mood: MascotMood; y: number }) {
  switch (mood) {
    case 'cheer':
    case 'wave':
      return <path d={`M106 ${y - 2} Q120 ${y + 18} 134 ${y - 2} Z`} fill="#E65A6E" stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
    case 'sleepy':
      return <ellipse cx={120} cy={y + 2} rx={5} ry={4} fill="none" stroke={INK} strokeWidth={4} />;
    case 'think':
      return <path d={`M112 ${y + 2} Q120 ${y - 2} 128 ${y + 2}`} fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />;
    default:
      // Little "w" cat smile
      return <path d={`M108 ${y - 1} Q114 ${y + 7} 120 ${y} Q126 ${y + 7} 132 ${y - 1}`} fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />;
  }
}

function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  }).join(' ');
  return <polygon points={pts} />;
}

// Mascot with a speech bubble: the main way the UI talks to the child
export function MascotSays({
  mood,
  children,
  size = 110,
  avatar,
}: {
  mood?: MascotMood;
  children: React.ReactNode;
  size?: number;
  avatar?: string | null;
}) {
  return (
    <div className="flex items-end gap-3">
      <Mascot mood={mood} size={size} avatar={avatar} className="kids-bob shrink-0" />
      <div className="relative mb-6 rounded-[24px] border-2 border-[var(--border)] bg-white px-4 py-3 text-lg font-bold leading-snug shadow-[0_4px_0_rgba(59,42,74,0.08)]">
        <span
          aria-hidden
          className="absolute -left-2.5 bottom-4 h-4 w-4 rotate-45 border-b-2 border-l-2 border-[var(--border)] bg-white"
        />
        {children}
      </div>
    </div>
  );
}
