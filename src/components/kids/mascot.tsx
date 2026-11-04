'use client';

import { avatarColors } from '@/lib/kids';
import { parseLook, type MascotLook } from '@/lib/mascot-look';

// "น้องยืด" — the kids mascot: a soft round mochi with a leaf sprout that
// sways, big shiny eyes that blink, and stretchy little arms.
// Spec: docs/KIDS-ART-UI.md §3. Each child dresses their own: `avatar` is a
// look string (src/lib/mascot-look.ts) — colour, eyes, mouth, hat, outfit,
// glasses. Moods with a strong expression (cheer, sleepy, think) override the
// chosen eyes/mouth while they show.

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
  /** Look string or colour key (lib/mascot-look.ts); default peach */
  avatar?: string | null;
  className?: string;
  title?: string;
}) {
  const { body, belly } = avatarColors(avatar);
  const look = parseLook(avatar);
  const coversHead = look.hat === 'cap' || look.hat === 'crown' || look.hat === 'party';
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

      {look.outfit === 'cape' && <Cape cy={cy} rx={rx} ry={ry} />}

      {/* Sprout (sways); hidden under a hat that covers the head */}
      {!coversHead && (
      <g className="mascot-sway" style={{ transformOrigin: `120px ${top + 4}px` }}>
        <path d={`M120 ${top + 4} Q118 ${top - 14} 122 ${top - 26}`} stroke={LEAF_DARK} strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d={`M122 ${top - 22} Q140 ${top - 44} 160 ${top - 30} Q142 ${top - 14} 122 ${top - 22} Z`} fill={LEAF} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d={`M120 ${top - 16} Q104 ${top - 36} 86 ${top - 26} Q100 ${top - 10} 120 ${top - 16} Z`} fill={LEAF} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      </g>
      )}

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

      <Outfit kind={look.outfit} cy={cy} rx={rx} />
      <Hat kind={look.hat} top={top} rx={rx} ry={ry} />

      {look.glasses !== 'sun' && <Eyes mood={mood} kind={look.eyes} y={eyeY} />}
      <Glasses kind={look.glasses} y={eyeY} />
      <Mouth mood={mood} kind={look.mouth} y={eyeY + 24} />

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

function Eyes({ mood, kind, y }: { mood: MascotMood; kind: MascotLook['eyes']; y: number }) {
  const arc = (x: number) => <path key={x} d={`M${x - 12} ${y + 4} Q${x} ${y - 10} ${x + 12} ${y + 4}`} />;
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
  const shiny = (x: number) => (
    <g key={x}>
      <ellipse cx={x} cy={y} rx={12} ry={15} fill={INK} />
      <circle cx={x + 4} cy={y - 6} r={5} fill="#fff" />
      <circle cx={x - 4} cy={y + 5} r={2.4} fill="#fff" />
    </g>
  );
  let eyes: React.ReactNode;
  switch (kind) {
    case 'smile':
      return (
        <g stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
          {[96, 144].map(arc)}
        </g>
      );
    case 'wink':
      return (
        <g>
          {shiny(96)}
          <g stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none">
            {arc(144)}
          </g>
        </g>
      );
    case 'dot':
      eyes = [96, 144].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y + 2} r={7.5} fill={INK} />
          <circle cx={x + 2.5} cy={y - 1} r={2.4} fill="#fff" />
        </g>
      ));
      break;
    case 'star':
      eyes = [96, 144].map((x) => (
        <g key={x}>
          <g fill={INK}>
            <Star cx={x} cy={y} r={15} />
          </g>
          <circle cx={x + 3} cy={y - 3} r={3} fill="#fff" />
        </g>
      ));
      break;
    case 'heart':
      eyes = [96, 144].map((x) => (
        <path
          key={x}
          d={`M${x} ${y + 12} C${x - 20} ${y} ${x - 12} ${y - 16} ${x} ${y - 6} C${x + 12} ${y - 16} ${x + 20} ${y} ${x} ${y + 12} Z`}
          fill="#E65A6E"
          stroke={INK}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      ));
      break;
    default:
      eyes = [96, 144].map(shiny);
  }
  // Open eyes blink
  return (
    <g className="mascot-blink" style={{ transformOrigin: `120px ${y}px` }}>
      {eyes}
    </g>
  );
}

function Mouth({ mood, kind, y }: { mood: MascotMood; kind: MascotLook['mouth']; y: number }) {
  const open = <path d={`M106 ${y - 2} Q120 ${y + 18} 134 ${y - 2} Z`} fill="#E65A6E" stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
  if (mood === 'cheer' || mood === 'wave') return open;
  if (mood === 'sleepy') return <ellipse cx={120} cy={y + 2} rx={5} ry={4} fill="none" stroke={INK} strokeWidth={4} />;
  if (mood === 'think') return <path d={`M112 ${y + 2} Q120 ${y - 2} 128 ${y + 2}`} fill="none" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />;
  switch (kind) {
    case 'grin':
      return open;
    case 'o':
      return <ellipse cx={120} cy={y + 4} rx={7} ry={8} fill="#E65A6E" stroke={INK} strokeWidth={4} />;
    case 'tongue':
      return (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d={`M114 ${y + 2} Q114 ${y + 16} 121 ${y + 16} Q128 ${y + 16} 128 ${y + 2} Z`} fill="#FF8FA8" stroke={INK} strokeWidth={3.5} />
          <path d={`M106 ${y - 1} Q120 ${y + 8} 134 ${y - 1}`} fill="none" stroke={INK} strokeWidth={4.5} />
        </g>
      );
    case 'teeth':
      return (
        <g strokeLinejoin="round">
          <path d={`M106 ${y - 2} Q120 ${y + 16} 134 ${y - 2} Z`} fill="#E65A6E" stroke={INK} strokeWidth={4} />
          <rect x={114} y={y - 2} width={12} height={8} rx={2} fill="#fff" stroke={INK} strokeWidth={2.5} />
          <line x1={120} y1={y - 2} x2={120} y2={y + 6} stroke={INK} strokeWidth={2} />
        </g>
      );
    default:
      // Little "w" cat smile
      return (
        <path
          d={`M108 ${y - 1} Q114 ${y + 7} 120 ${y} Q126 ${y + 7} 132 ${y - 1}`}
          fill="none"
          stroke={INK}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
  }
}

const LINE = { stroke: INK, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Hats sit on the top of the body; `top` = body top, rx/ry = body radii */
function Hat({ kind, top, rx, ry }: { kind: MascotLook['hat']; top: number; rx: number; ry: number }) {
  // Where the head curve is at 66 % of the half width (cap / bow edges)
  const edgeX = rx * 0.66;
  const edgeY = top + ry * (1 - Math.sqrt(1 - 0.66 * 0.66));
  switch (kind) {
    case 'cap':
      return (
        <g {...LINE} strokeWidth={5}>
          <path
            d={`M${120 + edgeX - 6} ${edgeY + 2} Q${120 + rx + 34} ${edgeY - 2} ${120 + rx + 30} ${edgeY + 12} Q${120 + rx} ${edgeY + 16} ${120 + edgeX - 10} ${edgeY + 10} Z`}
            fill="#E0564A"
          />
          <path d={`M${120 - edgeX} ${edgeY + 4} Q120 ${top - 40} ${120 + edgeX} ${edgeY + 4} Z`} fill="#FF7A6B" />
          <path d={`M120 ${top - 14} L120 ${edgeY}`} fill="none" strokeWidth={3} />
          <circle cx={120} cy={top - 15} r={5} fill="#FFC93C" strokeWidth={3} />
        </g>
      );
    case 'crown':
      return (
        <g {...LINE} strokeWidth={5}>
          <path d={`M92 ${top + 12} L86 ${top - 18} L104 ${top - 4} L120 ${top - 28} L136 ${top - 4} L154 ${top - 18} L148 ${top + 12} Z`} fill="#FFC93C" />
          <circle cx={120} cy={top + 2} r={5} fill="#E65A6E" strokeWidth={3} />
          <circle cx={100} cy={top + 5} r={3.5} fill="#3BA7F5" strokeWidth={2.5} />
          <circle cx={140} cy={top + 5} r={3.5} fill="#4CC38A" strokeWidth={2.5} />
        </g>
      );
    case 'party':
      return (
        <g {...LINE} strokeWidth={5}>
          <path d={`M96 ${top + 14} L120 ${top - 40} L144 ${top + 14} Z`} fill="#9B7BEA" />
          <path d={`M106 ${top - 8} L130 ${top + 2} M112 ${top - 22} L126 ${top - 16}`} stroke="#FFC93C" strokeWidth={5} fill="none" />
          <circle cx={120} cy={top - 44} r={8} fill="#FF8FA8" strokeWidth={4} />
        </g>
      );
    case 'bow':
      return (
        <g {...LINE} strokeWidth={4} transform={`rotate(18 ${120 + edgeX} ${edgeY})`}>
          <path d={`M${120 + edgeX} ${edgeY} L${120 + edgeX - 22} ${edgeY - 14} L${120 + edgeX - 22} ${edgeY + 14} Z`} fill="#FF8FA8" />
          <path d={`M${120 + edgeX} ${edgeY} L${120 + edgeX + 22} ${edgeY - 14} L${120 + edgeX + 22} ${edgeY + 14} Z`} fill="#FF8FA8" />
          <circle cx={120 + edgeX} cy={edgeY} r={6} fill="#E65A6E" />
        </g>
      );
    case 'flower': {
      const fx = 120 - edgeX;
      const fy = edgeY - 4;
      return (
        <g stroke={INK} strokeWidth={3.5}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            return <circle key={i} cx={fx + Math.cos(a) * 10} cy={fy + Math.sin(a) * 10} r={8} fill="#FFFFFF" />;
          })}
          <circle cx={fx} cy={fy} r={6.5} fill="#FFC93C" />
        </g>
      );
    }
    case 'headband': {
      const bx = rx * 0.9;
      const by = top + ry * (1 - Math.sqrt(1 - 0.9 * 0.9)) + 4;
      const d = `M${120 - bx} ${by} Q120 ${top - 8} ${120 + bx} ${by}`;
      return (
        <g fill="none" strokeLinecap="round">
          <path d={d} stroke={INK} strokeWidth={19} />
          <path d={d} stroke="#3BA7F5" strokeWidth={10} />
          <g fill="#FFC93C" stroke={INK} strokeWidth={2.5} strokeLinejoin="round">
            <Star cx={120} cy={top + 6} r={9} />
          </g>
        </g>
      );
    }
    default:
      return null;
  }
}

/** Wear on the body: scarf, bow tie, medal (the cape is drawn behind the body) */
function Outfit({ kind, cy, rx }: { kind: MascotLook['outfit']; cy: number; rx: number }) {
  const y = cy + 30;
  switch (kind) {
    case 'scarf': {
      const d = `M${120 - rx * 0.86} ${y - 6} Q120 ${y + 22} ${120 + rx * 0.86} ${y - 6}`;
      return (
        <g {...LINE}>
          <path d={`M138 ${y + 4} L134 ${y + 38} L152 ${y + 36} L150 ${y + 2} Z`} fill="#E0564A" strokeWidth={4} />
          <path d={d} fill="none" strokeWidth={20} />
          <path d={d} fill="none" stroke="#FF7A6B" strokeWidth={12} />
        </g>
      );
    }
    case 'bowtie':
      return (
        <g {...LINE} strokeWidth={4}>
          <path d={`M120 ${y} L100 ${y - 12} L100 ${y + 12} Z`} fill="#3BA7F5" />
          <path d={`M120 ${y} L140 ${y - 12} L140 ${y + 12} Z`} fill="#3BA7F5" />
          <circle cx={120} cy={y} r={5.5} fill="#2B7FC4" />
        </g>
      );
    case 'medal':
      return (
        <g {...LINE} strokeWidth={4}>
          <path d={`M100 ${y - 14} L114 ${y + 14} L120 ${y + 10} L126 ${y + 14} L140 ${y - 14}`} fill="none" stroke="#3BA7F5" strokeWidth={8} />
          <circle cx={120} cy={y + 24} r={13} fill="#FFC93C" />
          <g fill="#FFF5D1" strokeWidth={2}>
            <Star cx={120} cy={y + 24} r={7} />
          </g>
        </g>
      );
    default:
      return null;
  }
}

function Cape({ cy, rx, ry }: { cy: number; rx: number; ry: number }) {
  const bottom = cy + ry + 8;
  return (
    <path
      d={`M${120 - rx + 10} ${cy - 18} Q${120 - rx - 26} ${bottom - 10} ${120 - rx - 6} ${bottom} L${120 + rx + 6} ${bottom} Q${120 + rx + 26} ${bottom - 10} ${120 + rx - 10} ${cy - 18} Z`}
      fill="#E0564A"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

function Glasses({ kind, y }: { kind: MascotLook['glasses']; y: number }) {
  if (kind === 'round') {
    return (
      <g fill="none" stroke={INK} strokeWidth={4}>
        <circle cx={96} cy={y} r={18} fill="#fff" fillOpacity={0.18} />
        <circle cx={144} cy={y} r={18} fill="#fff" fillOpacity={0.18} />
        <path d={`M114 ${y - 2} Q120 ${y - 7} 126 ${y - 2}`} />
      </g>
    );
  }
  if (kind === 'sun') {
    return (
      <g stroke={INK} strokeWidth={4} strokeLinejoin="round">
        <path d={`M74 ${y - 12} H116 Q116 ${y + 16} 95 ${y + 16} Q74 ${y + 16} 74 ${y - 12} Z`} fill={INK} />
        <path d={`M124 ${y - 12} H166 Q166 ${y + 16} 145 ${y + 16} Q124 ${y + 16} 124 ${y - 12} Z`} fill={INK} />
        <path d={`M116 ${y - 8} H124`} fill="none" />
        <path d={`M82 ${y - 6} L92 ${y - 6} M132 ${y - 6} L142 ${y - 6}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      </g>
    );
  }
  return null;
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
